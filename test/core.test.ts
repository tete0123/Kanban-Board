import { describe, expect, it } from "vitest";
import {
  ensureUniqueColumnId,
  firstNonEmptyLine,
  normalizeIndex,
  parseFrontMatter,
  serializeFrontMatter,
  slugify,
} from "../src/core";

describe("normalizeIndex", () => {
  it("uses default columns when none provided", () => {
    const result = normalizeIndex({});
    expect(result.columns.map((col) => col.id)).toEqual([
      "todo",
      "doing",
      "done",
    ]);
    expect(result.order).toEqual({
      todo: [],
      doing: [],
      done: [],
    });
  });

  it("filters invalid columns and order entries", () => {
    const result = normalizeIndex({
      columns: [
        { id: "a", title: "A" },
        { id: 1, title: "B" } as unknown as { id: string; title: string },
      ],
      order: { a: ["x", 2, "y"] as unknown as string[] },
    });
    expect(result.columns).toEqual([{ id: "a", title: "A" }]);
    expect(result.order).toEqual({ a: ["x", "y"] });
  });
});

describe("front matter helpers", () => {
  it("parses front matter and body", () => {
    const input = ["---", "title: Sample", "due: null", "---", "Body"].join(
      "\n"
    );
    const parsed = parseFrontMatter(input);
    expect(parsed.meta).toEqual({ title: "Sample", due: null });
    expect(parsed.body).toBe("Body");
  });

  it("serializes front matter with known keys first", () => {
    const output = serializeFrontMatter(
      { title: "Hello", id: "1", extra: "note", due: null },
      "Details"
    );
    const lines = output.split("\n");
    expect(lines[0]).toBe("---");
    expect(lines[1]).toBe("id: 1");
    expect(lines[2]).toBe("title: Hello");
    expect(lines[3]).toBe("due: null");
    expect(lines[4]).toBe("extra: note");
    expect(lines[lines.length - 1]).toBe("Details");
  });
});

describe("string helpers", () => {
  it("picks the first non-empty line", () => {
    const text = "\n\n  \nFirst\nSecond";
    expect(firstNonEmptyLine(text)).toBe("First");
  });

  it("slugifies values and falls back to column", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
    expect(slugify("###")).toBe("column");
  });

  it("ensures unique column ids", () => {
    const columns = [
      { id: "todo", title: "TODO" },
      { id: "todo-1", title: "TODO 1" },
    ];
    expect(ensureUniqueColumnId(columns, "todo")).toBe("todo-2");
  });
});
