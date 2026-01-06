export type Column = { id: string; title: string };

export type IndexData = {
  columns: Column[];
  order: Record<string, string[]>;
};

const DEFAULT_COLUMNS: Column[] = [
  { id: "todo", title: "TODO" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];

export function normalizeIndex(raw: Partial<IndexData>): IndexData {
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

export function parseFrontMatter(content: string): {
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

export function serializeFrontMatter(
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

export function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

export function slugify(value: string): string {
  const trimmed = value.toLowerCase().trim();
  const normalized = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "column";
}

export function ensureUniqueColumnId(columns: Column[], baseId: string): string {
  let candidate = baseId;
  let counter = 1;
  const existing = new Set(columns.map((column) => column.id));
  while (existing.has(candidate)) {
    candidate = `${baseId}-${counter++}`;
  }
  return candidate;
}
