import * as vscode from "vscode";
import * as path from "path";

type Column = { id: string; title: string };
type IndexData = {
  columns: Column[];
  order: Record<string, string[]>;
};
type CardData = {
  id: string;
  title: string;
  detail: string;
  due: string | null;
  createdAt: string;
  updatedAt: string;
};
type StatePayload = {
  columns: Column[];
  order: Record<string, string[]>;
  cards: Record<string, CardData>;
};

const DEFAULT_COLUMNS: Column[] = [
  { id: "todo", title: "TODO" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];

export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand("kanban.openBoard", () => {
    const panel = vscode.window.createWebviewPanel(
      "kanbanBoard",
      "Kanban Board",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, "media")),
        ],
      }
    );

    panel.webview.onDidReceiveMessage(async (message) => {
      try {
        const state = await handleMessage(message);
        if (state) {
          panel.webview.postMessage({ type: "kanban:state", data: state });
        }
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : "Unknown error";
        panel.webview.postMessage({
          type: "kanban:error",
          data: { message: messageText },
        });
      }
    });

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, "media", "webview.js"))
    );
    const styleUri = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, "media", "styles.css"))
    );

    panel.webview.html = getWebviewHtml(scriptUri, styleUri);
  });

  context.subscriptions.push(command);
}

export function deactivate() {}

function getWebviewHtml(scriptUri: vscode.Uri, styleUri: vscode.Uri): string {
  return `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Kanban Board</title>
      <link rel="stylesheet" href="${styleUri}" />
    </head>
    <body>
      <header class="header">
        <h1>Kanban Board</h1>
        <button class="add-column" id="addColumn">+ Add Column</button>
      </header>
      <main class="board" id="board"></main>
      <div class="dialog-backdrop hidden" id="dialogBackdrop">
        <div class="dialog">
          <h2 id="dialogTitle">Add Card</h2>
          <label>
            Title
            <input id="cardTitle" type="text" />
          </label>
          <label>
            Details
            <textarea id="cardDetail" rows="4"></textarea>
          </label>
          <label>
            Due Date
            <input id="cardDue" type="date" />
          </label>
          <div class="dialog-actions">
            <button id="deleteCard" class="danger hidden">Delete</button>
            <button id="cancelCard">Cancel</button>
            <button id="saveCard">Save</button>
          </div>
        </div>
      </div>
      <script src="${scriptUri}"></script>
    </body>
  </html>`;
}

async function handleMessage(message: {
  type: string;
  data?: Record<string, unknown>;
}): Promise<StatePayload | null> {
  const root = getWorkspaceRoot();
  if (!root) {
    throw new Error("No workspace is open.");
  }

  switch (message.type) {
    case "kanban:init":
      return await readState(root);
    case "kanban:card:create":
      await createCard(root, message.data ?? {});
      return await readState(root);
    case "kanban:card:update":
      await updateCard(root, message.data ?? {});
      return await readState(root);
    case "kanban:card:delete":
      await deleteCard(root, message.data ?? {});
      return await readState(root);
    case "kanban:card:move":
      await moveCard(root, message.data ?? {});
      return await readState(root);
    case "kanban:card:reorder":
      await reorderCards(root, message.data ?? {});
      return await readState(root);
    case "kanban:column:update":
      await updateColumn(root, message.data ?? {});
      return await readState(root);
    case "kanban:column:reorder":
      await reorderColumns(root, message.data ?? {});
      return await readState(root);
    case "kanban:column:create":
      await createColumn(root, message.data ?? {});
      return await readState(root);
    case "kanban:column:create:request": {
      const title = await vscode.window.showInputBox({
        prompt: "Enter a column name",
        placeHolder: "New Column",
      });
      if (!title || !title.trim()) {
        return null;
      }
      await createColumn(root, { title: title.trim() });
      return await readState(root);
    }
    case "kanban:column:delete":
      await deleteColumn(root, message.data ?? {});
      return await readState(root);
    case "kanban:column:delete:request": {
      const columnId =
        typeof message.data?.columnId === "string"
          ? message.data.columnId
          : null;
      if (!columnId) {
        return null;
      }
      const confirmed = await vscode.window.showWarningMessage(
        "Delete this column?",
        { modal: true },
        "Delete"
      );
      if (confirmed !== "Delete") {
        return null;
      }
      await deleteColumn(root, { columnId });
      return await readState(root);
    }
    default:
      return null;
  }
}

function getWorkspaceRoot(): vscode.Uri | null {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? folder.uri : null;
}

function getStorageUris(root: vscode.Uri) {
  const base = vscode.Uri.joinPath(root, ".vscode-kanban");
  return {
    base,
    cardsDir: vscode.Uri.joinPath(base, "cards"),
    indexFile: vscode.Uri.joinPath(base, "index.json"),
  };
}

async function ensureStorage(root: vscode.Uri) {
  const { base, cardsDir } = getStorageUris(root);
  await vscode.workspace.fs.createDirectory(base);
  await vscode.workspace.fs.createDirectory(cardsDir);
}

async function readIndex(root: vscode.Uri): Promise<IndexData> {
  await ensureStorage(root);
  const { indexFile } = getStorageUris(root);
  try {
    const content = await vscode.workspace.fs.readFile(indexFile);
    const parsed = JSON.parse(Buffer.from(content).toString("utf8"));
    return normalizeIndex(parsed);
  } catch {
    const index = normalizeIndex({});
    await writeIndex(root, index);
    return index;
  }
}

function normalizeIndex(raw: Partial<IndexData>): IndexData {
  let columns: Column[] = DEFAULT_COLUMNS;
  if (Array.isArray(raw.columns) && raw.columns.length > 0) {
    const parsed = raw.columns
      .map((column) =>
        column &&
        typeof column.id === "string" &&
        typeof column.title === "string"
          ? { id: column.id, title: column.title }
          : null
      )
      .filter((column): column is Column => column !== null);
    if (parsed.length > 0) {
      columns = parsed;
    }
  }

  const order: Record<string, string[]> = {};
  const rawOrder = raw.order ?? {};
  columns.forEach((column) => {
    const list = Array.isArray(rawOrder[column.id])
      ? rawOrder[column.id].filter((id) => typeof id === "string")
      : [];
    order[column.id] = list;
  });

  return { columns, order };
}

async function writeIndex(root: vscode.Uri, index: IndexData) {
  const { indexFile } = getStorageUris(root);
  const buffer = Buffer.from(JSON.stringify(index, null, 2), "utf8");
  await vscode.workspace.fs.writeFile(indexFile, buffer);
}

async function readState(root: vscode.Uri): Promise<StatePayload> {
  const index = await readIndex(root);
  const { cardsDir } = getStorageUris(root);
  let entries: [string, vscode.FileType][] = [];
  try {
    entries = await vscode.workspace.fs.readDirectory(cardsDir);
  } catch {
    entries = [];
  }
  const cardFileIds = new Set<string>(
    entries
      .filter((entry: [string, vscode.FileType]) => entry[1] === vscode.FileType.File)
      .map((entry: [string, vscode.FileType]) => entry[0])
      .filter((name: string) => name.endsWith(".md"))
      .map((name: string) => name.replace(/\.md$/, ""))
  );

  const order: Record<string, string[]> = {};
  let orderChanged = false;
  const orderedIds = new Set<string>();
  index.columns.forEach((column) => {
    const list = (index.order[column.id] ?? []).filter((id) => {
      const exists = cardFileIds.has(id);
      if (!exists) {
        orderChanged = true;
      }
      return exists;
    });
    list.forEach((id) => orderedIds.add(id));
    order[column.id] = list;
  });

  const fallbackColumnId = index.columns[0]?.id ?? "todo";
  cardFileIds.forEach((id: string) => {
    if (!orderedIds.has(id)) {
      order[fallbackColumnId] = order[fallbackColumnId] ?? [];
      order[fallbackColumnId].push(id);
      orderChanged = true;
    }
  });

  if (orderChanged) {
    await writeIndex(root, { columns: index.columns, order });
  }

  const cards: Record<string, CardData> = {};
  const seen = new Set<string>();
  for (const column of index.columns) {
    for (const cardId of order[column.id] ?? []) {
      if (seen.has(cardId)) {
        continue;
      }
      seen.add(cardId);
      const card = await loadCard(root, cardId);
      if (card) {
        cards[cardId] = card;
      }
    }
  }

  return { columns: index.columns, order, cards };
}

async function loadCard(root: vscode.Uri, cardId: string): Promise<CardData | null> {
  const { cardsDir } = getStorageUris(root);
  const cardFile = vscode.Uri.joinPath(cardsDir, `${cardId}.md`);
  try {
    const content = await vscode.workspace.fs.readFile(cardFile);
    const text = Buffer.from(content).toString("utf8");
    const stat = await vscode.workspace.fs.stat(cardFile);
    const parsed = parseFrontMatter(text);
    const meta = parsed.meta;
    const detail = parsed.body;
    const title =
      typeof meta.title === "string" && meta.title.trim().length > 0
        ? meta.title
        : firstNonEmptyLine(detail) ?? "Untitled";
    const createdAt =
      typeof meta.createdAt === "string" && meta.createdAt
        ? meta.createdAt
        : new Date(stat.ctime).toISOString();
    const updatedAt =
      typeof meta.updatedAt === "string" && meta.updatedAt
        ? meta.updatedAt
        : new Date(stat.mtime).toISOString();
    const due = typeof meta.due === "string" ? meta.due : null;
    return {
      id: cardId,
      title,
      detail,
      due,
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

function parseFrontMatter(content: string): {
  meta: Record<string, string | null>;
  body: string;
} {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return { meta: {}, body: content };
  }
  const endIndex = lines.indexOf("---", 1);
  if (endIndex === -1) {
    return { meta: {}, body: content };
  }
  const metaLines = lines.slice(1, endIndex);
  const meta: Record<string, string | null> = {};
  for (const line of metaLines) {
    if (!line.trim()) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    meta[key] = value === "" || value === "null" ? null : value;
  }
  const body = lines.slice(endIndex + 1).join("\n");
  return { meta, body };
}

function serializeFrontMatter(
  meta: Record<string, string | null>,
  body: string
): string {
  const knownKeys = ["id", "title", "due", "createdAt", "updatedAt"];
  const lines: string[] = [];
  knownKeys.forEach((key) => {
    if (key in meta) {
      lines.push(`${key}: ${meta[key] ?? "null"}`);
    }
  });
  Object.keys(meta)
    .filter((key) => !knownKeys.includes(key))
    .forEach((key) => {
      lines.push(`${key}: ${meta[key] ?? "null"}`);
    });
  return ["---", ...lines, "---", body].join("\n");
}

function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

async function createCard(root: vscode.Uri, data: Record<string, unknown>) {
  const columnId = typeof data.columnId === "string" ? data.columnId : "todo";
  const title = typeof data.title === "string" ? data.title : "";
  const detail = typeof data.detail === "string" ? data.detail : "";
  const due = typeof data.due === "string" ? data.due : null;
  if (!title.trim()) {
    throw new Error("Title is empty.");
  }
  const index = await readIndex(root);
  const safeColumnId =
    index.columns.find((column) => column.id === columnId)?.id ??
    index.columns[0]?.id ??
    "todo";
  const cardId = generateId();
  const now = new Date().toISOString();
  const meta: Record<string, string | null> = {
    id: cardId,
    title: title.trim(),
    due: due && due.trim() ? due : null,
    createdAt: now,
    updatedAt: now,
  };
  const content = serializeFrontMatter(meta, detail);
  const { cardsDir } = getStorageUris(root);
  const cardFile = vscode.Uri.joinPath(cardsDir, `${cardId}.md`);
  await vscode.workspace.fs.writeFile(cardFile, Buffer.from(content, "utf8"));
  index.order[safeColumnId] = index.order[safeColumnId] ?? [];
  index.order[safeColumnId].push(cardId);
  await writeIndex(root, index);
}

async function updateCard(root: vscode.Uri, data: Record<string, unknown>) {
  const cardId = typeof data.cardId === "string" ? data.cardId : null;
  if (!cardId) {
    throw new Error("Missing card ID.");
  }
  const title = typeof data.title === "string" ? data.title : "";
  const detail = typeof data.detail === "string" ? data.detail : "";
  const due = typeof data.due === "string" ? data.due : null;
  if (!title.trim()) {
    throw new Error("Title is empty.");
  }
  const { cardsDir } = getStorageUris(root);
  const cardFile = vscode.Uri.joinPath(cardsDir, `${cardId}.md`);
  let parsed = { meta: {} as Record<string, string | null>, body: "" };
  try {
    const content = await vscode.workspace.fs.readFile(cardFile);
    parsed = parseFrontMatter(Buffer.from(content).toString("utf8"));
  } catch {
    throw new Error("Card not found.");
  }
  const now = new Date().toISOString();
  const meta = { ...parsed.meta };
  meta.id = cardId;
  meta.title = title.trim();
  meta.due = due && due.trim() ? due : null;
  meta.createdAt =
    typeof meta.createdAt === "string" && meta.createdAt
      ? meta.createdAt
      : now;
  meta.updatedAt = now;
  const content = serializeFrontMatter(meta, detail);
  await vscode.workspace.fs.writeFile(cardFile, Buffer.from(content, "utf8"));
}

async function deleteCard(root: vscode.Uri, data: Record<string, unknown>) {
  const cardId = typeof data.cardId === "string" ? data.cardId : null;
  if (!cardId) {
    throw new Error("Missing card ID.");
  }
  const index = await readIndex(root);
  index.columns.forEach((column) => {
    index.order[column.id] = (index.order[column.id] ?? []).filter(
      (id) => id !== cardId
    );
  });
  await writeIndex(root, index);
  await deleteCardFiles(root, [cardId]);
}

async function moveCard(root: vscode.Uri, data: Record<string, unknown>) {
  const cardId = typeof data.cardId === "string" ? data.cardId : null;
  const fromColumnId =
    typeof data.fromColumnId === "string" ? data.fromColumnId : null;
  const toColumnId =
    typeof data.toColumnId === "string" ? data.toColumnId : null;
  const toIndex = typeof data.toIndex === "number" ? data.toIndex : null;
  if (!cardId || !fromColumnId || !toColumnId || toIndex === null) {
    throw new Error("Missing move information.");
  }
  const index = await readIndex(root);
  const fromList = index.order[fromColumnId] ?? [];
  index.order[fromColumnId] = fromList.filter((id) => id !== cardId);
  const toList = index.order[toColumnId] ?? [];
  const insertIndex = Math.max(0, Math.min(toIndex, toList.length));
  toList.splice(insertIndex, 0, cardId);
  index.order[toColumnId] = toList;
  await writeIndex(root, index);
}

async function reorderCards(root: vscode.Uri, data: Record<string, unknown>) {
  const columnId =
    typeof data.columnId === "string" ? data.columnId : null;
  const orderedIds = Array.isArray(data.orderedIds)
    ? data.orderedIds.filter((id) => typeof id === "string")
    : null;
  if (!columnId || !orderedIds) {
    throw new Error("Missing reorder information.");
  }
  const index = await readIndex(root);
  index.order[columnId] = orderedIds;
  await writeIndex(root, index);
}

async function updateColumn(root: vscode.Uri, data: Record<string, unknown>) {
  const columnId =
    typeof data.columnId === "string" ? data.columnId : null;
  const title = typeof data.title === "string" ? data.title : "";
  if (!columnId || !title.trim()) {
    throw new Error("Missing column information.");
  }
  const index = await readIndex(root);
  const column = index.columns.find((item) => item.id === columnId);
  if (!column) {
    throw new Error("Column not found.");
  }
  column.title = title.trim();
  await writeIndex(root, index);
}

async function reorderColumns(root: vscode.Uri, data: Record<string, unknown>) {
  const orderedIds = Array.isArray(data.orderedIds)
    ? data.orderedIds.filter((id) => typeof id === "string")
    : null;
  if (!orderedIds) {
    throw new Error("Missing column order information.");
  }
  const index = await readIndex(root);
  const columnMap = new Map(index.columns.map((column) => [column.id, column]));
  const nextColumns: Column[] = [];
  orderedIds.forEach((id) => {
    const column = columnMap.get(id);
    if (column) {
      nextColumns.push(column);
      columnMap.delete(id);
    }
  });
  columnMap.forEach((column) => {
    nextColumns.push(column);
  });
  index.columns = nextColumns;
  await writeIndex(root, index);
}

async function createColumn(root: vscode.Uri, data: Record<string, unknown>) {
  const title = typeof data.title === "string" ? data.title : "";
  if (!title.trim()) {
    throw new Error("Column name is empty.");
  }
  const index = await readIndex(root);
  const baseId = slugify(title.trim());
  const columnId = ensureUniqueColumnId(index.columns, baseId);
  index.columns.push({ id: columnId, title: title.trim() });
  index.order[columnId] = [];
  await writeIndex(root, index);
}

async function deleteColumn(root: vscode.Uri, data: Record<string, unknown>) {
  const columnId =
    typeof data.columnId === "string" ? data.columnId : null;
  if (!columnId) {
    throw new Error("Missing column ID.");
  }
  const index = await readIndex(root);
  if (index.columns.length <= 1) {
    throw new Error("Cannot delete the last column.");
  }
  const removeIndex = index.columns.findIndex(
    (column) => column.id === columnId
  );
  if (removeIndex === -1) {
    throw new Error("Column not found.");
  }
  const removedCards = index.order[columnId] ?? [];
  index.columns.splice(removeIndex, 1);
  delete index.order[columnId];
  await writeIndex(root, index);
  await deleteCardFiles(root, removedCards);
}

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function slugify(value: string): string {
  const trimmed = value.toLowerCase().trim();
  const normalized = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "column";
}

function ensureUniqueColumnId(columns: Column[], baseId: string): string {
  let candidate = baseId;
  let counter = 1;
  const existing = new Set(columns.map((column) => column.id));
  while (existing.has(candidate)) {
    candidate = `${baseId}-${counter++}`;
  }
  return candidate;
}

async function deleteCardFiles(root: vscode.Uri, cardIds: string[]) {
  const { cardsDir } = getStorageUris(root);
  for (const id of cardIds) {
    const cardFile = vscode.Uri.joinPath(cardsDir, `${id}.md`);
    try {
      await vscode.workspace.fs.delete(cardFile, {
        recursive: false,
        useTrash: false,
      });
    } catch {
      // Ignore missing file.
    }
  }
}
