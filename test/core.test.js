"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const core_1 = require("../src/core");
(0, vitest_1.describe)("normalizeIndex", () => {
    (0, vitest_1.it)("uses default columns when none provided", () => {
        const result = (0, core_1.normalizeIndex)({});
        (0, vitest_1.expect)(result.columns.map((col) => col.id)).toEqual([
            "todo",
            "doing",
            "done",
        ]);
        (0, vitest_1.expect)(result.order).toEqual({
            todo: [],
            doing: [],
            done: [],
        });
    });
    (0, vitest_1.it)("filters invalid columns and order entries", () => {
        const result = (0, core_1.normalizeIndex)({
            columns: [
                { id: "a", title: "A" },
                { id: 1, title: "B" },
            ],
            order: { a: ["x", 2, "y"] },
        });
        (0, vitest_1.expect)(result.columns).toEqual([{ id: "a", title: "A" }]);
        (0, vitest_1.expect)(result.order).toEqual({ a: ["x", "y"] });
    });
});
(0, vitest_1.describe)("front matter helpers", () => {
    (0, vitest_1.it)("parses front matter and body", () => {
        const input = ["---", "title: Sample", "due: null", "---", "Body"].join("\n");
        const parsed = (0, core_1.parseFrontMatter)(input);
        (0, vitest_1.expect)(parsed.meta).toEqual({ title: "Sample", due: null });
        (0, vitest_1.expect)(parsed.body).toBe("Body");
    });
    (0, vitest_1.it)("serializes front matter with known keys first", () => {
        const output = (0, core_1.serializeFrontMatter)({ title: "Hello", id: "1", extra: "note", due: null }, "Details");
        const lines = output.split("\n");
        (0, vitest_1.expect)(lines[0]).toBe("---");
        (0, vitest_1.expect)(lines[1]).toBe("id: 1");
        (0, vitest_1.expect)(lines[2]).toBe("title: Hello");
        (0, vitest_1.expect)(lines[3]).toBe("due: null");
        (0, vitest_1.expect)(lines[4]).toBe("extra: note");
        (0, vitest_1.expect)(lines[lines.length - 1]).toBe("Details");
    });
});
(0, vitest_1.describe)("string helpers", () => {
    (0, vitest_1.it)("picks the first non-empty line", () => {
        const text = "\n\n  \nFirst\nSecond";
        (0, vitest_1.expect)((0, core_1.firstNonEmptyLine)(text)).toBe("First");
    });
    (0, vitest_1.it)("slugifies values and falls back to column", () => {
        (0, vitest_1.expect)((0, core_1.slugify)("  Hello World  ")).toBe("hello-world");
        (0, vitest_1.expect)((0, core_1.slugify)("###")).toBe("column");
    });
    (0, vitest_1.it)("ensures unique column ids", () => {
        const columns = [
            { id: "todo", title: "TODO" },
            { id: "todo-1", title: "TODO 1" },
        ];
        (0, vitest_1.expect)((0, core_1.ensureUniqueColumnId)(columns, "todo")).toBe("todo-2");
    });
});
//# sourceMappingURL=core.test.js.map