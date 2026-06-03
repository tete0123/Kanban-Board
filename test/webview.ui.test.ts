// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

type PostedMessage = {
  type: string;
  data?: Record<string, unknown>;
};

type MockApi = {
  postMessage: ReturnType<typeof vi.fn<[PostedMessage], void>>;
};

const createWebviewDom = () => `
  <header class="header">
    <h1>Kanban Board</h1>
    <div class="header-actions">
      <button class="ghost" id="openLabels">Labels</button>
      <button class="add-column" id="addColumn">+ Add Column</button>
    </div>
  </header>
  <div class="search-widget hidden" id="searchWidget" role="search">
    <div class="search-input">
      <input id="searchInput" type="text" />
      <span class="search-count" id="searchCount"></span>
    </div>
    <button class="search-close" id="searchClose">×</button>
  </div>
  <main class="board" id="board"></main>
  <div class="dialog-backdrop hidden" id="dialogBackdrop">
    <div class="dialog">
      <h2 id="dialogTitle">Add Card</h2>
      <label>Title <input id="cardTitle" type="text" /></label>
      <label>Details <textarea id="cardDetail" rows="4"></textarea></label>
      <label>Due Date <input id="cardDue" type="date" /></label>
      <div class="checklist-section">
        <div class="checklist-header"><span>Checklist</span></div>
        <div id="checklistList" class="checklist-list"></div>
        <div class="checklist-add">
          <input id="checklistText" type="text" />
          <button id="addChecklistItem" type="button">Add</button>
        </div>
      </div>
      <div class="relationship-section hidden" id="relationshipSection">
        <div class="relationship-header"><span>Parent / Children</span></div>
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
        <button id="createChildCard" type="button">New Child</button>
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
      <label>List <select id="moveList"></select></label>
      <label>Position <select id="movePosition"></select></label>
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
        <input id="labelSearchInput" type="text" />
      </div>
      <div id="labelManagerList" class="label-manager-list"></div>
      <div class="label-form">
        <label>Name <input id="labelName" type="text" /></label>
        <label>Color <input id="labelColor" type="color" value="#3fb3a2" /></label>
        <div class="label-form-actions">
          <button id="labelSave" type="button">Save Label</button>
          <button id="labelCancel" type="button" class="secondary">Cancel</button>
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
`;

const postMessageOf = (api: MockApi, type: string) =>
  api.postMessage.mock.calls
    .map(([message]) => message)
    .find((message) => message.type === type);

const renderState = (state: Record<string, unknown>) => {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "kanban:state",
        data: state,
      },
    })
  );
};

const baseState = {
  columns: [{ id: "todo", title: "Todo" }],
  order: { todo: [] as string[] },
  cards: {} as Record<string, unknown>,
  labels: [],
};

describe("webview ui", () => {
  let api: MockApi;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = createWebviewDom();
    window.alert = vi.fn();
    api = { postMessage: vi.fn<[PostedMessage], void>() };
    (globalThis as typeof globalThis & { acquireVsCodeApi: () => MockApi })
      .acquireVsCodeApi = () => api;
    await import("../src/webview");
  });

  it("renders columns and cards from kanban:state message", () => {
    const state = {
      ...baseState,
      order: { todo: ["card-1"] },
      cards: {
        "card-1": {
          id: "card-1",
          title: "Task A",
          detail: "Detail A",
          parentId: null,
          due: null,
          labels: [],
          checklist: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      },
    };

    renderState(state);

    expect(document.querySelectorAll(".column")).toHaveLength(1);
    expect(document.querySelectorAll(".card")).toHaveLength(1);
    expect(document.querySelector(".card h3")?.textContent).toBe("Task A");
    expect(document.querySelector(".card .due")?.textContent).toContain("Due: None");
  });

  it("confirms before clearing all cards from a column", () => {
    const state = {
      ...baseState,
      order: { todo: ["card-1", "card-2"] },
      cards: {
        "card-1": {
          id: "card-1",
          title: "Task A",
          detail: "",
          parentId: null,
          due: null,
          labels: [],
          checklist: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
        "card-2": {
          id: "card-2",
          title: "Task B",
          detail: "",
          parentId: null,
          due: null,
          labels: [],
          checklist: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      },
    };

    renderState(state);
    (document.querySelector(".clear-column-cards") as HTMLButtonElement).click();

    expect(document.getElementById("confirmMessage")?.textContent).toBe(
      'Delete 2 cards from "Todo"?'
    );
    (document.getElementById("confirmOk") as HTMLButtonElement).click();

    expect(postMessageOf(api, "kanban:column:clearCards")).toEqual({
      type: "kanban:column:clearCards",
      data: { columnId: "todo" },
    });
  });

  it("posts kanban:card:create with due date from dialog", () => {
    renderState(baseState);

    (document.querySelector(".add-card") as HTMLButtonElement).click();
    (document.getElementById("cardTitle") as HTMLInputElement).value = "New task";
    (document.getElementById("cardDetail") as HTMLTextAreaElement).value = "details";
    (document.getElementById("cardDue") as HTMLInputElement).value = "2026-03-10";
    (document.getElementById("saveCard") as HTMLButtonElement).click();

    expect(postMessageOf(api, "kanban:card:create")).toEqual({
      type: "kanban:card:create",
      data: {
        columnId: "todo",
        title: "New task",
        detail: "details",
        due: "2026-03-10",
        parentId: null,
        labels: [],
        checklist: [],
      },
    });
  });

  it("adds checklist items to created cards", () => {
    renderState(baseState);

    (document.querySelector(".add-card") as HTMLButtonElement).click();
    (document.getElementById("cardTitle") as HTMLInputElement).value = "New task";
    (document.getElementById("checklistText") as HTMLInputElement).value = "Review";
    (document.getElementById("addChecklistItem") as HTMLButtonElement).click();
    (document.getElementById("saveCard") as HTMLButtonElement).click();

    const message = postMessageOf(api, "kanban:card:create");
    expect(message?.type).toBe("kanban:card:create");
    expect(message?.data?.checklist).toEqual([
      expect.objectContaining({ text: "Review", done: false }),
    ]);
  });

  it("clears checklist add text after adding an item", () => {
    renderState(baseState);

    (document.querySelector(".add-card") as HTMLButtonElement).click();
    const input = document.getElementById("checklistText") as HTMLInputElement;
    input.value = "Review";
    (document.getElementById("addChecklistItem") as HTMLButtonElement).click();

    expect(input.value).toBe("");
  });

  it("posts kanban:card:update with edited due date", () => {
    const state = {
      ...baseState,
      order: { todo: ["card-1"] },
      cards: {
        "card-1": {
          id: "card-1",
          title: "Task A",
          detail: "Detail A",
          parentId: null,
          due: "2026-03-01",
          labels: [],
          checklist: [{ id: "item-1", text: "Review", done: false }],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      },
    };
    renderState(state);

    document
      .querySelector(".card")
      ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    (document.getElementById("cardDue") as HTMLInputElement).value = "2026-03-20";
    (document.getElementById("saveCard") as HTMLButtonElement).click();

    expect(postMessageOf(api, "kanban:card:update")).toEqual({
      type: "kanban:card:update",
      data: {
        cardId: "card-1",
        title: "Task A",
        detail: "Detail A",
        due: "2026-03-20",
        parentId: null,
        labels: [],
        checklist: [{ id: "item-1", text: "Review", done: false }],
      },
    });
  });

  it("focuses and shows the start of the title when editing a card", () => {
    const state = {
      ...baseState,
      order: { todo: ["card-1"] },
      cards: {
        "card-1": {
          id: "card-1",
          title: "Task A",
          detail: "Detail A",
          parentId: null,
          due: null,
          labels: [],
          checklist: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      },
    };
    renderState(state);

    document
      .querySelector(".card")
      ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    const title = document.getElementById("cardTitle") as HTMLInputElement;
    expect(document.activeElement).toBe(title);
    expect(title.selectionStart).toBe(0);
    expect(title.selectionEnd).toBe(0);
    expect(title.scrollLeft).toBe(0);
  });

  it("saves selected parent and child relationships from the card dialog", () => {
    const state = {
      ...baseState,
      order: { todo: ["parent", "child", "new-parent"] },
      cards: {
        parent: {
          id: "parent",
          title: "Parent",
          detail: "",
          parentId: null,
          due: null,
          labels: [],
          checklist: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
        child: {
          id: "child",
          title: "Child",
          detail: "",
          parentId: null,
          due: null,
          labels: [],
          checklist: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
        "new-parent": {
          id: "new-parent",
          title: "New Parent",
          detail: "",
          parentId: null,
          due: null,
          labels: [],
          checklist: [],
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      },
    };
    renderState(state);

    document
      .querySelector<HTMLElement>('[data-card-id="parent"]')
      ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    (document.getElementById("parentCardSelect") as HTMLSelectElement).value =
      "new-parent";
    (document.getElementById("childCardSelect") as HTMLSelectElement).value =
      "child";
    (document.getElementById("saveCard") as HTMLButtonElement).click();

    const updates = api.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === "kanban:card:update");
    expect(updates).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          cardId: "parent",
          parentId: "new-parent",
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          cardId: "child",
          parentId: "parent",
        }),
      }),
    ]);
  });

  it("closes card dialog on Escape key", () => {
    renderState(baseState);
    (document.querySelector(".add-card") as HTMLButtonElement).click();
    const backdrop = document.getElementById("dialogBackdrop") as HTMLDivElement;
    expect(backdrop.classList.contains("hidden")).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(backdrop.classList.contains("hidden")).toBe(true);
  });
});
