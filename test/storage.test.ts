import path from "path";
import { describe, expect, it } from "vitest";
import { createStorage, type FileSystem } from "../src/storage";

type FileEntry = {
  data: Uint8Array;
  ctime: number;
  mtime: number;
};

function createInMemoryFileSystem(): FileSystem<string> {
  const files = new Map<string, FileEntry>();
  const dirs = new Set<string>();
  const fileType = { File: 1, Directory: 2 };

  const normalize = (value: string) => {
    const normalized = path.posix.normalize(value);
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  };

  const ensureDir = (value: string) => {
    const normalized = normalize(value);
    const parts = normalized.split("/").filter(Boolean);
    let current = "/";
    dirs.add(current);
    for (const part of parts) {
      current = path.posix.join(current, part);
      dirs.add(current);
    }
  };

  const readFile = async (value: string) => {
    const target = normalize(value);
    const entry = files.get(target);
    if (!entry) {
      throw new Error("File not found");
    }
    return entry.data;
  };

  const writeFile = async (value: string, data: Uint8Array) => {
    const target = normalize(value);
    ensureDir(path.posix.dirname(target));
    const now = Date.now();
    const existing = files.get(target);
    files.set(target, {
      data,
      ctime: existing?.ctime ?? now,
      mtime: now,
    });
  };

  const readDirectory = async (value: string) => {
    const target = normalize(value);
    if (!dirs.has(target)) {
      throw new Error("Directory not found");
    }
    const entries = new Map<string, number>();
    for (const [filePath] of files) {
      if (path.posix.dirname(filePath) === target) {
        entries.set(path.posix.basename(filePath), fileType.File);
      }
    }
    for (const dirPath of dirs) {
      if (dirPath !== target && path.posix.dirname(dirPath) === target) {
        entries.set(path.posix.basename(dirPath), fileType.Directory);
      }
    }
    return Array.from(entries.entries());
  };

  const stat = async (value: string) => {
    const target = normalize(value);
    const entry = files.get(target);
    if (!entry) {
      throw new Error("File not found");
    }
    return { ctime: entry.ctime, mtime: entry.mtime };
  };

  const deleteFile = async (value: string) => {
    const target = normalize(value);
    if (!files.delete(target)) {
      throw new Error("File not found");
    }
  };

  return {
    fileType: { File: fileType.File },
    joinPath: (base, ...paths) => normalize(path.posix.join(base, ...paths)),
    createDirectory: async (value) => ensureDir(value),
    readFile,
    writeFile,
    readDirectory,
    stat,
    delete: async (value, _options) => deleteFile(value),
  };
}

describe("storage with in-memory fs", () => {
  it("creates, reads, updates, and deletes cards", async () => {
    const fs = createInMemoryFileSystem();
    const storage = createStorage(fs, "/workspace");

    await storage.createCard({
      title: "First",
      detail: "Hello",
      checklist: [{ id: "item-1", text: "Read", done: false }],
    });
    let state = await storage.readState();
    const [cardId] = Object.keys(state.cards);
    expect(cardId).toBeTruthy();
    expect(state.order.todo).toEqual([cardId]);
    expect(state.cards[cardId].title).toBe("First");
    expect(state.cards[cardId].checklist).toEqual([
      { id: "item-1", text: "Read", done: false },
    ]);

    await storage.updateCard({
      cardId,
      title: "Updated",
      detail: "Next",
      checklist: [{ id: "item-1", text: "Read", done: true }],
    });
    state = await storage.readState();
    expect(state.cards[cardId].title).toBe("Updated");
    expect(state.cards[cardId].detail).toBe("Next");
    expect(state.cards[cardId].checklist).toEqual([
      { id: "item-1", text: "Read", done: true },
    ]);

    await storage.deleteCard({ cardId });
    state = await storage.readState();
    expect(state.order.todo).toEqual([]);
    expect(Object.keys(state.cards)).toEqual([]);
  });

  it("manages labels and removes deleted labels from cards", async () => {
    const fs = createInMemoryFileSystem();
    const storage = createStorage(fs, "/workspace");

    await storage.createLabel({ name: "Bug", color: "#ff0000" });
    let state = await storage.readState();
    expect(state.labels.length).toBe(1);
    const labelId = state.labels[0]?.id;
    expect(labelId).toBeTruthy();

    await storage.createCard({
      title: "Fix issue",
      detail: "Details",
      labels: [labelId],
    });
    state = await storage.readState();
    const [cardId] = Object.keys(state.cards);
    expect(state.cards[cardId].labels).toEqual([labelId]);

    await storage.updateLabel({ labelId, name: "Bugfix", color: "#00ff00" });
    state = await storage.readState();
    expect(state.labels[0].name).toBe("Bugfix");

    await storage.deleteLabel({ labelId });
    state = await storage.readState();
    expect(state.labels).toEqual([]);
    expect(state.cards[cardId].labels).toEqual([]);
  });
});
