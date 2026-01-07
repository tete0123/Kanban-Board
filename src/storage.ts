import {
  type Column,
  type IndexData,
  ensureUniqueColumnId,
  firstNonEmptyLine,
  normalizeIndex,
  parseFrontMatter,
  serializeFrontMatter,
  slugify,
} from "./core";

export type CardData = {
  id: string;
  title: string;
  detail: string;
  due: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StatePayload = {
  columns: Column[];
  order: Record<string, string[]>;
  cards: Record<string, CardData>;
};

export type FileStat = {
  ctime: number;
  mtime: number;
};

export type FileType = {
  File: number;
};

export type FileSystem<PathType> = {
  fileType: FileType;
  joinPath: (base: PathType, ...paths: string[]) => PathType;
  createDirectory: (path: PathType) => Promise<void>;
  readFile: (path: PathType) => Promise<Uint8Array>;
  writeFile: (path: PathType, data: Uint8Array) => Promise<void>;
  readDirectory: (path: PathType) => Promise<[string, number][]>;
  stat: (path: PathType) => Promise<FileStat>;
  delete: (
    path: PathType,
    options: { recursive: boolean; useTrash: boolean }
  ) => Promise<void>;
};

type StoragePaths<PathType> = {
  base: PathType;
  cardsDir: PathType;
  indexFile: PathType;
};

export function createStorage<PathType>(
  fs: FileSystem<PathType>,
  root: PathType
) {
  const getStoragePaths = (): StoragePaths<PathType> => {
    const base = fs.joinPath(root, ".vscode-kanban");
    return {
      base,
      cardsDir: fs.joinPath(base, "cards"),
      indexFile: fs.joinPath(base, "index.json"),
    };
  };

  const ensureStorage = async (): Promise<void> => {
    const { base, cardsDir } = getStoragePaths();
    await fs.createDirectory(base);
    await fs.createDirectory(cardsDir);
  };

  const writeIndex = async (index: IndexData): Promise<void> => {
    const { indexFile } = getStoragePaths();
    const buffer = Buffer.from(JSON.stringify(index, null, 2), "utf8");
    await fs.writeFile(indexFile, buffer);
  };

  const readIndex = async (): Promise<IndexData> => {
    await ensureStorage();
    const { indexFile } = getStoragePaths();
    try {
      const content = await fs.readFile(indexFile);
      const parsed = JSON.parse(Buffer.from(content).toString("utf8"));
      return normalizeIndex(parsed);
    } catch {
      const index = normalizeIndex({});
      await writeIndex(index);
      return index;
    }
  };

  const loadCard = async (cardId: string): Promise<CardData | null> => {
    const { cardsDir } = getStoragePaths();
    const cardFile = fs.joinPath(cardsDir, `${cardId}.md`);
    try {
      const content = await fs.readFile(cardFile);
      const text = Buffer.from(content).toString("utf8");
      const stat = await fs.stat(cardFile);
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
  };

  const readState = async (): Promise<StatePayload> => {
    const index = await readIndex();
    const { cardsDir } = getStoragePaths();
    let entries: [string, number][] = [];
    try {
      entries = await fs.readDirectory(cardsDir);
    } catch {
      entries = [];
    }
    const cardFileIds = new Set<string>(
      entries
        .filter((entry) => entry[1] === fs.fileType.File)
        .map((entry) => entry[0])
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.replace(/\.md$/, ""))
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
    cardFileIds.forEach((id) => {
      if (!orderedIds.has(id)) {
        order[fallbackColumnId] = order[fallbackColumnId] ?? [];
        order[fallbackColumnId].push(id);
        orderChanged = true;
      }
    });

    if (orderChanged) {
      await writeIndex({ columns: index.columns, order });
    }

    const cards: Record<string, CardData> = {};
    const seen = new Set<string>();
    for (const column of index.columns) {
      for (const cardId of order[column.id] ?? []) {
        if (seen.has(cardId)) {
          continue;
        }
        seen.add(cardId);
        const card = await loadCard(cardId);
        if (card) {
          cards[cardId] = card;
        }
      }
    }

    return { columns: index.columns, order, cards };
  };

  const createCard = async (data: Record<string, unknown>): Promise<void> => {
    const columnId = typeof data.columnId === "string" ? data.columnId : "todo";
    const title = typeof data.title === "string" ? data.title : "";
    const detail = typeof data.detail === "string" ? data.detail : "";
    const due = typeof data.due === "string" ? data.due : null;
    if (!title.trim()) {
      throw new Error("Title is empty.");
    }
    const index = await readIndex();
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
    const { cardsDir } = getStoragePaths();
    const cardFile = fs.joinPath(cardsDir, `${cardId}.md`);
    await fs.writeFile(cardFile, Buffer.from(content, "utf8"));
    index.order[safeColumnId] = index.order[safeColumnId] ?? [];
    index.order[safeColumnId].push(cardId);
    await writeIndex(index);
  };

  const updateCard = async (data: Record<string, unknown>): Promise<void> => {
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
    const { cardsDir } = getStoragePaths();
    const cardFile = fs.joinPath(cardsDir, `${cardId}.md`);
    let parsed = { meta: {} as Record<string, string | null>, body: "" };
    try {
      const content = await fs.readFile(cardFile);
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
    await fs.writeFile(cardFile, Buffer.from(content, "utf8"));
  };

  const deleteCard = async (data: Record<string, unknown>): Promise<void> => {
    const cardId = typeof data.cardId === "string" ? data.cardId : null;
    if (!cardId) {
      throw new Error("Missing card ID.");
    }
    const index = await readIndex();
    index.columns.forEach((column) => {
      index.order[column.id] = (index.order[column.id] ?? []).filter(
        (id) => id !== cardId
      );
    });
    await writeIndex(index);
    await deleteCardFiles([cardId]);
  };

  const moveCard = async (data: Record<string, unknown>): Promise<void> => {
    const cardId = typeof data.cardId === "string" ? data.cardId : null;
    const fromColumnId =
      typeof data.fromColumnId === "string" ? data.fromColumnId : null;
    const toColumnId =
      typeof data.toColumnId === "string" ? data.toColumnId : null;
    const toIndex = typeof data.toIndex === "number" ? data.toIndex : null;
    if (!cardId || !fromColumnId || !toColumnId || toIndex === null) {
      throw new Error("Missing move information.");
    }
    const index = await readIndex();
    const fromList = index.order[fromColumnId] ?? [];
    index.order[fromColumnId] = fromList.filter((id) => id !== cardId);
    const toList = index.order[toColumnId] ?? [];
    const insertIndex = Math.max(0, Math.min(toIndex, toList.length));
    toList.splice(insertIndex, 0, cardId);
    index.order[toColumnId] = toList;
    await writeIndex(index);
  };

  const reorderCards = async (data: Record<string, unknown>): Promise<void> => {
    const columnId = typeof data.columnId === "string" ? data.columnId : null;
    const orderedIds = Array.isArray(data.orderedIds)
      ? data.orderedIds.filter((id) => typeof id === "string")
      : null;
    if (!columnId || !orderedIds) {
      throw new Error("Missing reorder information.");
    }
    const index = await readIndex();
    index.order[columnId] = orderedIds;
    await writeIndex(index);
  };

  const updateColumn = async (data: Record<string, unknown>): Promise<void> => {
    const columnId = typeof data.columnId === "string" ? data.columnId : null;
    const title = typeof data.title === "string" ? data.title : "";
    if (!columnId || !title.trim()) {
      throw new Error("Missing column information.");
    }
    const index = await readIndex();
    const column = index.columns.find((item) => item.id === columnId);
    if (!column) {
      throw new Error("Column not found.");
    }
    column.title = title.trim();
    await writeIndex(index);
  };

  const reorderColumns = async (
    data: Record<string, unknown>
  ): Promise<void> => {
    const orderedIds = Array.isArray(data.orderedIds)
      ? data.orderedIds.filter((id) => typeof id === "string")
      : null;
    if (!orderedIds) {
      throw new Error("Missing column order information.");
    }
    const index = await readIndex();
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
    await writeIndex(index);
  };

  const createColumn = async (data: Record<string, unknown>): Promise<void> => {
    const title = typeof data.title === "string" ? data.title : "";
    if (!title.trim()) {
      throw new Error("Column name is empty.");
    }
    const index = await readIndex();
    const baseId = slugify(title.trim());
    const columnId = ensureUniqueColumnId(index.columns, baseId);
    index.columns.push({ id: columnId, title: title.trim() });
    index.order[columnId] = [];
    await writeIndex(index);
  };

  const deleteColumn = async (data: Record<string, unknown>): Promise<void> => {
    const columnId = typeof data.columnId === "string" ? data.columnId : null;
    if (!columnId) {
      throw new Error("Missing column ID.");
    }
    const index = await readIndex();
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
    await writeIndex(index);
    await deleteCardFiles(removedCards);
  };

  const deleteCardFiles = async (cardIds: string[]): Promise<void> => {
    const { cardsDir } = getStoragePaths();
    for (const id of cardIds) {
      const cardFile = fs.joinPath(cardsDir, `${id}.md`);
      try {
        await fs.delete(cardFile, { recursive: false, useTrash: false });
      } catch {
        // Ignore missing file.
      }
    }
  };

  return {
    readState,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
    reorderCards,
    updateColumn,
    reorderColumns,
    createColumn,
    deleteColumn,
  };
}

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
