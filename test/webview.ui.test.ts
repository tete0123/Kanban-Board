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
          due: null,
          labels: [],
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
        labels: [],
      },
    });
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
          due: "2026-03-01",
          labels: [],
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
        labels: [],
      },
    });
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
