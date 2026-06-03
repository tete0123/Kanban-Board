import * as vscode from "vscode";
import * as path from "path";
import {
  type FileSystem,
  type StatePayload,
  createStorage,
} from "./storage";

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
        <div class="header-actions">
          <button class="ghost" id="openLabels">Labels</button>
          <button class="add-column" id="addColumn">+ Add Column</button>
        </div>
      </header>
      <div class="search-widget hidden" id="searchWidget" role="search">
        <div class="search-input">
          <input
            id="searchInput"
            type="text"
            placeholder="Search"
            autocomplete="off"
          />
          <span class="search-count" id="searchCount"></span>
        </div>
        <button class="search-close" id="searchClose" title="Close">
          ×
        </button>
      </div>
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
          <div class="checklist-section">
            <div class="checklist-header">
              <span>Checklist</span>
            </div>
            <div id="checklistList" class="checklist-list"></div>
            <div class="checklist-add">
              <input id="checklistText" type="text" placeholder="Checklist item" />
              <button id="addChecklistItem" type="button">Add</button>
            </div>
          </div>
          <div class="relationship-section hidden" id="relationshipSection">
            <div class="relationship-header">
              <span>Parent / Children</span>
            </div>
            <div id="parentCardRow" class="relationship-row"></div>
            <div id="childCardList" class="relationship-list"></div>
            <div class="relationship-actions">
              <select id="parentCardSelect"></select>
              <button id="setParentCard" type="button">Set Parent</button>
            </div>
            <div class="relationship-actions">
              <select id="childCardSelect"></select>
              <button id="attachChildCard" type="button">Attach Child</button>
            </div>
            <button id="createChildCard" class="secondary" type="button">
              New Child
            </button>
          </div>
          <div class="label-section">
            <div class="label-header">
              <span>Labels</span>
              <button id="openLabelManager" type="button">Manage</button>
            </div>
            <div id="labelList" class="label-list"></div>
          </div>
          <div class="dialog-actions">
            <button id="openCardFile" class="secondary hidden">Open .md</button>
            <button id="openMoveCard" class="secondary hidden">Move</button>
            <button id="deleteCard" class="danger hidden">Delete</button>
            <button id="cancelCard">Cancel</button>
            <button id="saveCard">Save</button>
          </div>
        </div>
      </div>
      <div class="dialog-backdrop hidden" id="moveBackdrop">
        <div class="dialog move-dialog">
          <h2>Move Card</h2>
          <p id="moveCurrent" class="move-current"></p>
          <label>
            List
            <select id="moveList"></select>
          </label>
          <label>
            Position
            <select id="movePosition"></select>
          </label>
          <div class="dialog-actions">
            <button id="cancelMoveCard" class="secondary">Cancel</button>
            <button id="confirmMoveCard">Move</button>
          </div>
        </div>
      </div>
      <div class="dialog-backdrop hidden" id="labelBackdrop">
        <div class="dialog label-dialog">
          <div class="label-dialog-header">
            <h2>Labels</h2>
            <button id="closeLabels" type="button" class="ghost">Close</button>
          </div>
          <div class="label-search">
            <input id="labelSearchInput" type="text" placeholder="Search labels" />
          </div>
          <div id="labelManagerList" class="label-manager-list"></div>
          <div class="label-form">
            <label>
              Name
              <input id="labelName" type="text" placeholder="Label name" />
            </label>
            <label>
              Color
              <input id="labelColor" type="color" value="#3fb3a2" />
            </label>
            <div class="label-form-actions">
              <button id="labelSave" type="button">Save Label</button>
              <button id="labelCancel" type="button" class="secondary">
                Cancel
              </button>
            </div>
          </div>
          <div class="label-filter-section">
            <div class="label-filter-header">
              <span>Filter cards by labels</span>
              <button id="clearLabelFilter" type="button" class="ghost">Clear</button>
            </div>
            <div id="labelFilterList" class="label-filter-list"></div>
          </div>
        </div>
      </div>
      <div class="dialog-backdrop hidden" id="confirmBackdrop">
        <div class="dialog confirm-dialog">
          <h2 id="confirmTitle">Confirm</h2>
          <p id="confirmMessage"></p>
          <div class="dialog-actions">
            <button id="confirmCancel" class="secondary">Cancel</button>
            <button id="confirmOk" class="danger">Delete</button>
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
  const storage = createStorage(getVscodeFileSystem(), root);

  switch (message.type) {
    case "kanban:init":
      return await storage.readState();
    case "kanban:card:create":
      await storage.createCard(message.data ?? {});
      return await storage.readState();
    case "kanban:card:update":
      await storage.updateCard(message.data ?? {});
      return await storage.readState();
    case "kanban:card:delete":
      await storage.deleteCard(message.data ?? {});
      return await storage.readState();
    case "kanban:card:move":
      await storage.moveCard(message.data ?? {});
      return await storage.readState();
    case "kanban:card:reorder":
      await storage.reorderCards(message.data ?? {});
      return await storage.readState();
    case "kanban:card:openFile": {
      const cardId =
        typeof message.data?.cardId === "string" ? message.data.cardId : null;
      if (!cardId) {
        throw new Error("Missing card ID.");
      }
      await openCardFile(root, cardId);
      return null;
    }
    case "kanban:column:update":
      await storage.updateColumn(message.data ?? {});
      return await storage.readState();
    case "kanban:column:reorder":
      await storage.reorderColumns(message.data ?? {});
      return await storage.readState();
    case "kanban:column:create":
      await storage.createColumn(message.data ?? {});
      return await storage.readState();
    case "kanban:column:create:request": {
      const title = await vscode.window.showInputBox({
        prompt: "Enter a column name",
        placeHolder: "New Column",
      });
      if (!title || !title.trim()) {
        return null;
      }
      await storage.createColumn({ title: title.trim() });
      return await storage.readState();
    }
    case "kanban:column:delete":
      await storage.deleteColumn(message.data ?? {});
      return await storage.readState();
    case "kanban:column:clearCards":
      if (isExportBeforeColumnClearEnabled()) {
        const exported = await exportColumnCardsBeforeClear(
          storage,
          root,
          message.data ?? {}
        );
        if (!exported) {
          return null;
        }
      }
      await storage.clearColumnCards(message.data ?? {});
      return await storage.readState();
    case "kanban:label:create":
      await storage.createLabel(message.data ?? {});
      return await storage.readState();
    case "kanban:label:update":
      await storage.updateLabel(message.data ?? {});
      return await storage.readState();
    case "kanban:label:delete":
      await storage.deleteLabel(message.data ?? {});
      return await storage.readState();
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
      await storage.deleteColumn({ columnId });
      return await storage.readState();
    }
    default:
      return null;
  }
}

function isExportBeforeColumnClearEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("kanban")
    .get<boolean>("clear.exportBeforeDelete", false);
}

async function exportColumnCardsBeforeClear(
  storage: ReturnType<typeof createStorage<vscode.Uri>>,
  root: vscode.Uri,
  data: Record<string, unknown>
): Promise<boolean> {
  const columnId = typeof data.columnId === "string" ? data.columnId : null;
  if (!columnId) {
    throw new Error("Missing column ID.");
  }
  const exportData = await storage.getColumnCardsMarkdown({
    columnId,
    exportedAt: new Date(),
  });
  const folder = await getColumnClearExportFolder(root);
  if (!folder) {
    return false;
  }
  await vscode.workspace.fs.createDirectory(folder);
  const target = vscode.Uri.joinPath(folder, exportData.fileName);
  if (await fileExists(target)) {
    const confirmed = await vscode.window.showWarningMessage(
      `Overwrite ${exportData.fileName}?`,
      { modal: true },
      "Overwrite"
    );
    if (confirmed !== "Overwrite") {
      return false;
    }
  }
  await vscode.workspace.fs.writeFile(
    target,
    Buffer.from(exportData.content, "utf8")
  );
  return true;
}

async function getColumnClearExportFolder(
  root: vscode.Uri
): Promise<vscode.Uri | null> {
  const config = vscode.workspace.getConfiguration("kanban");
  const configured = config.get<string>("clear.exportFolder", "").trim();
  if (configured) {
    return resolveExportFolder(root, configured);
  }

  const folders = await vscode.window.showOpenDialog({
    title: "Select a folder for exported Markdown files",
    openLabel: "Use Folder",
    defaultUri: root,
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
  });
  const folder = folders?.[0];
  if (!folder) {
    return null;
  }
  await config.update(
    "clear.exportFolder",
    folder.scheme === "file" ? folder.fsPath : folder.toString(),
    vscode.ConfigurationTarget.Workspace
  );
  return folder;
}

function resolveExportFolder(root: vscode.Uri, value: string): vscode.Uri {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return vscode.Uri.parse(value);
  }
  if (path.isAbsolute(value)) {
    return vscode.Uri.file(value);
  }
  const segments = value.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments.length > 0 ? vscode.Uri.joinPath(root, ...segments) : root;
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function getWorkspaceRoot(): vscode.Uri | null {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? folder.uri : null;
}

function getVscodeFileSystem(): FileSystem<vscode.Uri> {
  return {
    fileType: { File: vscode.FileType.File },
    joinPath: (base, ...paths) => vscode.Uri.joinPath(base, ...paths),
    createDirectory: (path) => vscode.workspace.fs.createDirectory(path),
    readFile: (path) => vscode.workspace.fs.readFile(path),
    writeFile: (path, data) => vscode.workspace.fs.writeFile(path, data),
    readDirectory: (path) => vscode.workspace.fs.readDirectory(path),
    stat: (path) => vscode.workspace.fs.stat(path),
    delete: (path, options) => vscode.workspace.fs.delete(path, options),
  };
}

async function openCardFile(root: vscode.Uri, cardId: string): Promise<void> {
  const cardUri = vscode.Uri.joinPath(
    root,
    ".vscode-kanban",
    "cards",
    `${cardId}.md`
  );
  try {
    await vscode.workspace.fs.stat(cardUri);
  } catch {
    throw new Error(`Card file not found: ${cardId}`);
  }
  const document = await vscode.workspace.openTextDocument(cardUri);
  await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
  });
}
