declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
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
  columns: { id: string; title: string }[];
  order: Record<string, string[]>;
  cards: Record<string, CardData>;
};

const vscode = acquireVsCodeApi();
const board = document.getElementById("board") as HTMLDivElement;
const addColumnButton = document.getElementById("addColumn") as HTMLButtonElement;
const backdrop = document.getElementById("dialogBackdrop") as HTMLDivElement;
const dialogTitle = document.getElementById("dialogTitle") as HTMLHeadingElement;
const cardTitle = document.getElementById("cardTitle") as HTMLInputElement;
const cardDetail = document.getElementById("cardDetail") as HTMLTextAreaElement;
const cardDue = document.getElementById("cardDue") as HTMLInputElement;
const cancelButton = document.getElementById("cancelCard") as HTMLButtonElement;
const saveButton = document.getElementById("saveCard") as HTMLButtonElement;
const deleteButton = document.getElementById("deleteCard") as HTMLButtonElement;

let activeColumn: string | null = null;
let editingCardId: string | null = null;
let currentState: StatePayload | null = null;
let dragFromColumnId: string | null = null;
let draggingCardId: string | null = null;
let editDirty = false;
let draggingColumnId: string | null = null;

const clearDialog = () => {
  cardTitle.value = "";
  cardDetail.value = "";
  cardDue.value = "";
};

const openCreateDialog = (column: string) => {
  activeColumn = column;
  editingCardId = null;
  editDirty = false;
  dialogTitle.textContent = "Add Card";
  saveButton.textContent = "Save";
  deleteButton.classList.add("hidden");
  document.body.classList.add("dialog-open");
  backdrop.classList.remove("hidden");
  cardTitle.focus();
};

const openEditDialog = (cardId: string) => {
  const card = currentState?.cards[cardId];
  if (!card) {
    return;
  }
  activeColumn = null;
  editingCardId = cardId;
  editDirty = false;
  dialogTitle.textContent = "Edit Card";
  saveButton.textContent = "Update";
  deleteButton.classList.remove("hidden");
  document.body.classList.add("dialog-open");
  cardTitle.value = card.title;
  cardDetail.value = card.detail;
  cardDue.value = card.due ?? "";
  backdrop.classList.remove("hidden");
  cardTitle.focus();
};

const closeDialog = () => {
  backdrop.classList.add("hidden");
  activeColumn = null;
  editingCardId = null;
  editDirty = false;
  deleteButton.classList.add("hidden");
  document.body.classList.remove("dialog-open");
  clearDialog();
};

const isDialogOpen = () => !backdrop.classList.contains("hidden");

const renderState = (state: StatePayload) => {
  currentState = state;
  board.innerHTML = "";
  state.columns.forEach((column) => {
    const columnElement = buildColumnElement(column, state);
    board.appendChild(columnElement);
  });
};

addColumnButton.addEventListener("click", () => {
  vscode.postMessage({ type: "kanban:column:create:request" });
});

board.addEventListener("dragover", (event) => {
  if (!draggingColumnId) {
    return;
  }
  event.preventDefault();
  const after = getColumnAfterElement(board, event.clientX);
  const dragged = document.querySelector<HTMLElement>(".column.dragging");
  if (dragged) {
    if (after) {
      board.insertBefore(dragged, after);
    } else {
      board.appendChild(dragged);
    }
  }
});

board.addEventListener("drop", () => {
  if (!draggingColumnId) {
    return;
  }
  const orderedIds = Array.from(
    board.querySelectorAll<HTMLElement>(".column")
  )
    .map((column) => column.dataset.column)
    .filter((id): id is string => Boolean(id));
  draggingColumnId = null;
  vscode.postMessage({
    type: "kanban:column:reorder",
    data: { orderedIds },
  });
});

cancelButton.addEventListener("click", closeDialog);
backdrop.addEventListener("click", (event) => {
  if (event.target === backdrop) {
    closeDialog();
  }
});

saveButton.addEventListener("click", () => {
  const title = cardTitle.value.trim();
  const detail = cardDetail.value.trim();
  const due = cardDue.value.trim();

  if (!title) {
    cardTitle.focus();
    return;
  }

  if (editingCardId) {
    vscode.postMessage({
      type: "kanban:card:update",
      data: {
        cardId: editingCardId,
        title,
        detail,
        due: due || null,
      },
    });
    closeDialog();
    return;
  }

  if (!activeColumn) {
    return;
  }
  vscode.postMessage({
    type: "kanban:card:create",
    data: {
      columnId: activeColumn,
      title,
      detail,
      due: due || null,
    },
  });
  closeDialog();
});

deleteButton.addEventListener("click", () => {
  if (!editingCardId) {
    return;
  }
  vscode.postMessage({
    type: "kanban:card:delete",
    data: { cardId: editingCardId },
  });
  closeDialog();
});

[cardTitle, cardDetail, cardDue].forEach((field) => {
  field.addEventListener("input", () => {
    if (isDialogOpen()) {
      editDirty = true;
    }
  });
  field.addEventListener("blur", () => {
    if (!isDialogOpen() || !editDirty) {
      return;
    }
    requestAnimationFrame(() => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (!activeElement || activeElement === document.body) {
        saveButton.focus();
      }
    });
  });
});

document.addEventListener("dragstart", (event) => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".card");
  if (!target) {
    return;
  }
  draggingCardId = target.dataset.cardId ?? null;
  dragFromColumnId =
    target.closest<HTMLDivElement>(".card-list")?.dataset.column ?? null;
  target.classList.add("dragging");
});

document.addEventListener("dragend", (event) => {
  const target = (event.target as HTMLElement | null)?.closest(".card");
  if (!target) {
    return;
  }
  target.classList.remove("dragging");
  draggingCardId = null;
  dragFromColumnId = null;
  document.querySelectorAll(".card-list").forEach((list) => {
    list.classList.remove("drop-target");
  });
});

const getDragAfterElement = (container: HTMLElement, y: number) => {
  const draggableElements = Array.from(
    container.querySelectorAll<HTMLElement>(".card:not(.dragging)")
  );

  let closest = {
    offset: Number.NEGATIVE_INFINITY,
    element: null as HTMLElement | null,
  };
  draggableElements.forEach((element) => {
    const box = element.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element };
    }
  });

  return closest.element;
};

const getColumnAfterElement = (container: HTMLElement, x: number) => {
  const draggableElements = Array.from(
    container.querySelectorAll<HTMLElement>(".column:not(.dragging)")
  );

  let closest = {
    offset: Number.NEGATIVE_INFINITY,
    element: null as HTMLElement | null,
  };
  draggableElements.forEach((element) => {
    const box = element.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element };
    }
  });

  return closest.element;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildCardElement = (card: CardData) => {
  const cardElement = document.createElement("article");
  cardElement.className = "card";
  cardElement.draggable = true;
  cardElement.dataset.cardId = card.id;
  const detailText = card.detail ? card.detail : "No details";
  const dueText = card.due ? `Due: ${card.due}` : "Due: None";
  cardElement.innerHTML = `
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(detailText)}</p>
      <div class="due">${escapeHtml(dueText)}</div>
    `;
  cardElement.addEventListener("dblclick", () => {
    openEditDialog(card.id);
  });
  return cardElement;
};

const buildColumnElement = (
  column: { id: string; title: string },
  state: StatePayload
) => {
  const columnElement = document.createElement("section");
  columnElement.className = "column";
  columnElement.dataset.column = column.id;

  const header = document.createElement("div");
  header.className = "column-header";

  const titleInput = document.createElement("input");
  titleInput.className = "column-title";
  titleInput.dataset.column = column.id;
  titleInput.value = column.title;
  titleInput.addEventListener("change", () => {
    const title = titleInput.value.trim();
    if (!title) {
      return;
    }
    vscode.postMessage({
      type: "kanban:column:update",
      data: { columnId: column.id, title },
    });
  });

  const addButton = document.createElement("button");
  addButton.className = "add-card";
  addButton.dataset.column = column.id;
  addButton.textContent = "+ Add";
  addButton.addEventListener("click", () => {
    clearDialog();
    openCreateDialog(column.id);
  });

  const handleButton = document.createElement("button");
  handleButton.className = "column-handle";
  handleButton.type = "button";
  handleButton.textContent = "::";
  handleButton.title = "Drag to move column";
  handleButton.draggable = true;
  handleButton.addEventListener("dragstart", () => {
    draggingColumnId = column.id;
    columnElement.classList.add("dragging");
  });
  handleButton.addEventListener("dragend", () => {
    draggingColumnId = null;
    columnElement.classList.remove("dragging");
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-column";
  deleteButton.dataset.column = column.id;
  deleteButton.textContent = "Delete";
  deleteButton.type = "button";
  deleteButton.disabled = false;
  deleteButton.removeAttribute("disabled");
  deleteButton.addEventListener("click", () => {
    if (state.columns.length <= 1) {
      window.alert("Cannot delete the last column.");
      return;
    }
    vscode.postMessage({
      type: "kanban:column:delete:request",
      data: { columnId: column.id },
    });
  });

  header.appendChild(handleButton);
  header.appendChild(titleInput);
  header.appendChild(addButton);
  header.appendChild(deleteButton);

  const list = document.createElement("div");
  list.className = "card-list";
  list.dataset.column = column.id;
  list.addEventListener("dragover", (event) => {
    event.preventDefault();
    list.classList.add("drop-target");
    const after = getDragAfterElement(list, event.clientY);
    const dragged = document.querySelector<HTMLElement>(".card.dragging");
    if (dragged) {
      if (after) {
        list.insertBefore(dragged, after);
      } else {
        list.appendChild(dragged);
      }
    }
  });
  list.addEventListener("dragleave", () => {
    list.classList.remove("drop-target");
  });
  list.addEventListener("drop", () => {
    list.classList.remove("drop-target");
    if (!draggingCardId) {
      return;
    }
    const targetColumnId = list.dataset.column;
    if (!targetColumnId || !dragFromColumnId) {
      return;
    }
    const orderedIds = Array.from(list.querySelectorAll<HTMLElement>(".card"))
      .map((card) => card.dataset.cardId)
      .filter((id): id is string => Boolean(id));
    if (dragFromColumnId === targetColumnId) {
      vscode.postMessage({
        type: "kanban:card:reorder",
        data: { columnId: targetColumnId, orderedIds },
      });
    } else {
      const toIndex = orderedIds.indexOf(draggingCardId);
      vscode.postMessage({
        type: "kanban:card:move",
        data: {
          cardId: draggingCardId,
          fromColumnId: dragFromColumnId,
          toColumnId: targetColumnId,
          toIndex,
        },
      });
    }
  });

  const ids = state.order[column.id] ?? [];
  ids.forEach((cardId) => {
    const card = state.cards[cardId];
    if (!card) {
      return;
    }
    list.appendChild(buildCardElement(card));
  });

  columnElement.appendChild(header);
  columnElement.appendChild(list);
  return columnElement;
};

window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message.type !== "string") {
    return;
  }
  if (message.type === "kanban:state") {
    renderState(message.data as StatePayload);
    return;
  }
  if (message.type === "kanban:error") {
    const errorMessage =
      typeof message.data?.message === "string"
        ? message.data.message
        : "An error occurred.";
    window.alert(errorMessage);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !isDialogOpen()) {
    return;
  }
  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement && activeElement !== document.body) {
    activeElement.blur();
    return;
  }
  closeDialog();
});

vscode.postMessage({ type: "kanban:init" });
