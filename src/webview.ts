declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
};

type CardData = {
  id: string;
  title: string;
  detail: string;
  due: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

type Label = {
  id: string;
  name: string;
  color: string;
};

type StatePayload = {
  columns: { id: string; title: string }[];
  order: Record<string, string[]>;
  cards: Record<string, CardData>;
  labels: Label[];
};

const vscode = acquireVsCodeApi();
const board = document.getElementById("board") as HTMLDivElement;
const addColumnButton = document.getElementById("addColumn") as HTMLButtonElement;
const openLabelsButton = document.getElementById(
  "openLabels"
) as HTMLButtonElement;
const backdrop = document.getElementById("dialogBackdrop") as HTMLDivElement;
const dialogTitle = document.getElementById("dialogTitle") as HTMLHeadingElement;
const cardTitle = document.getElementById("cardTitle") as HTMLInputElement;
const cardDetail = document.getElementById("cardDetail") as HTMLTextAreaElement;
const cardDue = document.getElementById("cardDue") as HTMLInputElement;
const cancelButton = document.getElementById("cancelCard") as HTMLButtonElement;
const saveButton = document.getElementById("saveCard") as HTMLButtonElement;
const deleteButton = document.getElementById("deleteCard") as HTMLButtonElement;
const searchWidget = document.getElementById("searchWidget") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const searchCount = document.getElementById("searchCount") as HTMLSpanElement;
const searchClose = document.getElementById("searchClose") as HTMLButtonElement;
const labelList = document.getElementById("labelList") as HTMLDivElement;
const openLabelManager = document.getElementById(
  "openLabelManager"
) as HTMLButtonElement;
const labelBackdrop = document.getElementById(
  "labelBackdrop"
) as HTMLDivElement;
const confirmBackdrop = document.getElementById(
  "confirmBackdrop"
) as HTMLDivElement;
const confirmTitle = document.getElementById("confirmTitle") as HTMLHeadingElement;
const confirmMessage = document.getElementById(
  "confirmMessage"
) as HTMLParagraphElement;
const confirmOk = document.getElementById("confirmOk") as HTMLButtonElement;
const confirmCancel = document.getElementById(
  "confirmCancel"
) as HTMLButtonElement;
const closeLabelsButton = document.getElementById(
  "closeLabels"
) as HTMLButtonElement;
const labelSearchInput = document.getElementById(
  "labelSearchInput"
) as HTMLInputElement;
const labelManagerList = document.getElementById(
  "labelManagerList"
) as HTMLDivElement;
const labelFilterList = document.getElementById(
  "labelFilterList"
) as HTMLDivElement;
const clearLabelFilter = document.getElementById(
  "clearLabelFilter"
) as HTMLButtonElement;
const labelName = document.getElementById("labelName") as HTMLInputElement;
const labelColor = document.getElementById("labelColor") as HTMLInputElement;
const labelSave = document.getElementById("labelSave") as HTMLButtonElement;
const labelCancel = document.getElementById("labelCancel") as HTMLButtonElement;

let activeColumn: string | null = null;
let editingCardId: string | null = null;
let currentState: StatePayload | null = null;
let dragFromColumnId: string | null = null;
let draggingCardId: string | null = null;
let editDirty = false;
let draggingColumnId: string | null = null;
let searchQuery = "";
let autoScrollRaf: number | null = null;
let lastPointer: { x: number; y: number } | null = null;
let dialogLabelIds: string[] = [];
let editingLabelId: string | null = null;
let labelFilterIds: string[] = [];
let confirmAction: (() => void) | null = null;

const AUTO_SCROLL_MARGIN = 60;
const AUTO_SCROLL_SPEED = 18;

const requestAutoScroll = (x: number, y: number) => {
  lastPointer = { x, y };
  if (autoScrollRaf !== null) {
    return;
  }
  const step = () => {
    if (!lastPointer || (!draggingCardId && !draggingColumnId)) {
      autoScrollRaf = null;
      return;
    }
    const { x: pointerX, y: pointerY } = lastPointer;
    let deltaX = 0;
    let deltaY = 0;
    if (pointerX < AUTO_SCROLL_MARGIN) {
      deltaX = -AUTO_SCROLL_SPEED;
    } else if (pointerX > window.innerWidth - AUTO_SCROLL_MARGIN) {
      deltaX = AUTO_SCROLL_SPEED;
    }
    if (pointerY < AUTO_SCROLL_MARGIN) {
      deltaY = -AUTO_SCROLL_SPEED;
    } else if (pointerY > window.innerHeight - AUTO_SCROLL_MARGIN) {
      deltaY = AUTO_SCROLL_SPEED;
    }
    if (deltaX !== 0 || deltaY !== 0) {
      window.scrollBy(deltaX, deltaY);
    }
    autoScrollRaf = requestAnimationFrame(step);
  };
  autoScrollRaf = requestAnimationFrame(step);
};

const stopAutoScroll = () => {
  if (autoScrollRaf !== null) {
    cancelAnimationFrame(autoScrollRaf);
    autoScrollRaf = null;
  }
  lastPointer = null;
};

const autoScrollList = (list: HTMLElement, clientY: number) => {
  if (list.scrollHeight <= list.clientHeight) {
    return;
  }
  const rect = list.getBoundingClientRect();
  const topZone = rect.top + AUTO_SCROLL_MARGIN;
  const bottomZone = rect.bottom - AUTO_SCROLL_MARGIN;
  if (clientY < topZone) {
    list.scrollTop = Math.max(0, list.scrollTop - AUTO_SCROLL_SPEED);
  } else if (clientY > bottomZone) {
    list.scrollTop = Math.min(
      list.scrollHeight - list.clientHeight,
      list.scrollTop + AUTO_SCROLL_SPEED
    );
  }
};

const clearDialog = () => {
  cardTitle.value = "";
  cardDetail.value = "";
  cardDue.value = "";
};

const isLabelManagerOpen = () => !labelBackdrop.classList.contains("hidden");
const isConfirmOpen = () => !confirmBackdrop.classList.contains("hidden");

const openConfirm = (message: string, action: () => void) => {
  confirmTitle.textContent = "Confirm";
  confirmMessage.textContent = message;
  confirmAction = action;
  confirmBackdrop.classList.remove("hidden");
  confirmOk.focus();
};

const closeConfirm = () => {
  confirmBackdrop.classList.add("hidden");
  confirmAction = null;
};

const openLabelManagerModal = () => {
  labelBackdrop.classList.remove("hidden");
  document.body.classList.add("label-open");
  labelSearchInput.focus();
  renderLabelManager();
  renderLabelFilterList();
};

const closeLabelManagerModal = () => {
  labelBackdrop.classList.add("hidden");
  document.body.classList.remove("label-open");
  labelSearchInput.value = "";
  resetLabelForm();
};

const openCreateDialog = (column: string) => {
  activeColumn = column;
  editingCardId = null;
  editDirty = false;
  dialogLabelIds = [];
  dialogTitle.textContent = "Add Card";
  saveButton.textContent = "Save";
  deleteButton.classList.add("hidden");
  document.body.classList.add("dialog-open");
  backdrop.classList.remove("hidden");
  cardTitle.focus();
  renderLabelList();
};

const openEditDialog = (cardId: string) => {
  const card = currentState?.cards[cardId];
  if (!card) {
    return;
  }
  activeColumn = null;
  editingCardId = cardId;
  editDirty = false;
  dialogLabelIds = [...card.labels];
  dialogTitle.textContent = "Edit Card";
  saveButton.textContent = "Update";
  deleteButton.classList.remove("hidden");
  document.body.classList.add("dialog-open");
  cardTitle.value = card.title;
  cardDetail.value = card.detail;
  cardDue.value = card.due ?? "";
  backdrop.classList.remove("hidden");
  cardTitle.focus();
  renderLabelList();
};

const closeDialog = () => {
  backdrop.classList.add("hidden");
  activeColumn = null;
  editingCardId = null;
  editDirty = false;
  deleteButton.classList.add("hidden");
  document.body.classList.remove("dialog-open");
  clearDialog();
  resetLabelForm();
};

const isDialogOpen = () => !backdrop.classList.contains("hidden");
const isSearchOpen = () => !searchWidget.classList.contains("hidden");

const applyLabelFilter = () => {
  const activeFilters = new Set(labelFilterIds);
  document.querySelectorAll<HTMLElement>(".card").forEach((card) => {
    const raw = card.dataset.labels ?? "";
    if (activeFilters.size === 0) {
      card.classList.remove("label-filter-hidden");
      return;
    }
    const cardLabels = raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const matches = cardLabels.some((id) => activeFilters.has(id));
    if (matches) {
      card.classList.remove("label-filter-hidden");
    } else {
      card.classList.add("label-filter-hidden");
    }
  });
};

const applySearch = (value: string) => {
  searchQuery = value.trim().toLowerCase();
  let matches = 0;
  document.querySelectorAll<HTMLElement>(".card").forEach((card) => {
    const text = card.dataset.searchText ?? "";
    if (!searchQuery) {
      card.classList.remove("search-hidden", "search-match");
      return;
    }
    if (text.includes(searchQuery)) {
      card.classList.remove("search-hidden");
      card.classList.add("search-match");
      matches += 1;
    } else {
      card.classList.add("search-hidden");
      card.classList.remove("search-match");
    }
  });
  if (!searchQuery) {
    searchCount.textContent = "";
    return;
  }
  searchCount.textContent = `${matches} result${matches === 1 ? "" : "s"}`;
};

const openSearch = () => {
  searchWidget.classList.remove("hidden");
  searchInput.focus();
  searchInput.select();
  applySearch(searchInput.value);
};

const closeSearch = () => {
  searchWidget.classList.add("hidden");
  searchInput.value = "";
  applySearch("");
};

const syncDialogLabels = (labels: Label[]) => {
  const allowed = new Set(labels.map((label) => label.id));
  dialogLabelIds = dialogLabelIds.filter((id) => allowed.has(id));
  labelFilterIds = labelFilterIds.filter((id) => allowed.has(id));
};

const resetLabelForm = () => {
  editingLabelId = null;
  labelName.value = "";
  labelColor.value = "#3fb3a2";
  labelSave.textContent = "Save Label";
};

const renderLabelList = () => {
  if (!labelList) {
    return;
  }
  labelList.innerHTML = "";
  const labels = currentState?.labels ?? [];
  const selected = new Set(dialogLabelIds);
  labels.forEach((label) => {
    const row = document.createElement("div");
    row.className = "label-row label-row-simple";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(label.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selected.add(label.id);
      } else {
        selected.delete(label.id);
      }
      dialogLabelIds = Array.from(selected);
    });

    const swatch = document.createElement("span");
    swatch.className = "label-swatch";
    swatch.style.backgroundColor = label.color;

    const name = document.createElement("span");
    name.className = "label-name";
    name.textContent = label.name;

    row.appendChild(checkbox);
    row.appendChild(swatch);
    row.appendChild(name);
    labelList.appendChild(row);
  });
};

const renderLabelManager = () => {
  if (!labelManagerList) {
    return;
  }
  const query = labelSearchInput.value.trim().toLowerCase();
  labelManagerList.innerHTML = "";
  const labels = currentState?.labels ?? [];
  labels
    .filter((label) => label.name.toLowerCase().includes(query))
    .forEach((label) => {
      const row = document.createElement("div");
      row.className = "label-row label-row-manager";

      const swatch = document.createElement("span");
      swatch.className = "label-swatch";
      swatch.style.backgroundColor = label.color;

      const name = document.createElement("span");
      name.className = "label-name";
      name.textContent = label.name;

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "label-edit";
      editButton.textContent = "Edit";
      editButton.dataset.action = "edit";
      editButton.dataset.labelId = label.id;

      const deleteLabelButton = document.createElement("button");
      deleteLabelButton.type = "button";
      deleteLabelButton.className = "label-delete";
      deleteLabelButton.textContent = "Delete";
      deleteLabelButton.dataset.action = "delete";
      deleteLabelButton.dataset.labelId = label.id;

      row.appendChild(swatch);
      row.appendChild(name);
      row.appendChild(editButton);
      row.appendChild(deleteLabelButton);
      labelManagerList.appendChild(row);
    });
};

const renderLabelFilterList = () => {
  if (!labelFilterList) {
    return;
  }
  labelFilterList.innerHTML = "";
  const labels = currentState?.labels ?? [];
  const selected = new Set(labelFilterIds);
  labels.forEach((label) => {
    const row = document.createElement("div");
    row.className = "label-row label-row-filter";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(label.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selected.add(label.id);
      } else {
        selected.delete(label.id);
      }
      labelFilterIds = Array.from(selected);
      applyLabelFilter();
    });

    const swatch = document.createElement("span");
    swatch.className = "label-swatch";
    swatch.style.backgroundColor = label.color;

    const name = document.createElement("span");
    name.className = "label-name";
    name.textContent = label.name;

    row.appendChild(checkbox);
    row.appendChild(swatch);
    row.appendChild(name);
    labelFilterList.appendChild(row);
  });
};

const renderState = (state: StatePayload) => {
  currentState = state;
  board.innerHTML = "";
  const labelMap = new Map(state.labels.map((label) => [label.id, label]));
  state.columns.forEach((column) => {
    const columnElement = buildColumnElement(column, state, labelMap);
    board.appendChild(columnElement);
  });
  syncDialogLabels(state.labels);
  renderLabelList();
  renderLabelManager();
  renderLabelFilterList();
  if (searchQuery) {
    applySearch(searchQuery);
  }
  applyLabelFilter();
};

addColumnButton.addEventListener("click", () => {
  vscode.postMessage({ type: "kanban:column:create:request" });
});

openLabelsButton.addEventListener("click", () => {
  openLabelManagerModal();
});

openLabelManager.addEventListener("click", () => {
  openLabelManagerModal();
});

board.addEventListener("dragover", (event) => {
  if (!draggingColumnId) {
    return;
  }
  event.preventDefault();
  requestAutoScroll(event.clientX, event.clientY);
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
  stopAutoScroll();
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

labelBackdrop.addEventListener("click", (event) => {
  if (event.target === labelBackdrop) {
    closeLabelManagerModal();
  }
});

confirmBackdrop.addEventListener("click", (event) => {
  if (event.target === confirmBackdrop) {
    closeConfirm();
  }
});

confirmCancel.addEventListener("click", () => {
  closeConfirm();
});

confirmOk.addEventListener("click", () => {
  if (confirmAction) {
    confirmAction();
  }
  closeConfirm();
});

closeLabelsButton.addEventListener("click", () => {
  closeLabelManagerModal();
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
        labels: dialogLabelIds,
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
      labels: dialogLabelIds,
    },
  });
  closeDialog();
});

deleteButton.addEventListener("click", () => {
  if (!editingCardId) {
    return;
  }
  openConfirm("Delete this card?", () => {
    vscode.postMessage({
      type: "kanban:card:delete",
      data: { cardId: editingCardId },
    });
    closeDialog();
  });
});

searchInput.addEventListener("input", () => {
  applySearch(searchInput.value);
});

searchClose.addEventListener("click", () => {
  closeSearch();
});

labelCancel.addEventListener("click", () => {
  resetLabelForm();
});

labelSave.addEventListener("click", () => {
  const name = labelName.value.trim();
  const color = labelColor.value.trim();
  if (!name) {
    labelName.focus();
    return;
  }
  if (!color) {
    labelColor.focus();
    return;
  }
  if (editingLabelId) {
    vscode.postMessage({
      type: "kanban:label:update",
      data: { labelId: editingLabelId, name, color },
    });
  } else {
    vscode.postMessage({
      type: "kanban:label:create",
      data: { name, color },
    });
  }
  resetLabelForm();
});

labelSearchInput.addEventListener("input", () => {
  renderLabelManager();
});

labelManagerList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>("button[data-action]");
  if (!button) {
    return;
  }
  const labelId = button.dataset.labelId ?? null;
  if (!labelId) {
    return;
  }
  const labels = currentState?.labels ?? [];
  const label = labels.find((item) => item.id === labelId);
  if (!label) {
    return;
  }
  const action = button.dataset.action;
  if (action === "edit") {
    editingLabelId = label.id;
    labelName.value = label.name;
    labelColor.value = label.color;
    labelSave.textContent = "Update Label";
    labelName.focus();
    return;
  }
  if (action === "delete") {
    openConfirm("Delete this label?", () => {
      vscode.postMessage({
        type: "kanban:label:delete",
        data: { labelId: label.id },
      });
      if (editingLabelId === label.id) {
        resetLabelForm();
      }
    });
  }
});

clearLabelFilter.addEventListener("click", () => {
  labelFilterIds = [];
  renderLabelFilterList();
  applyLabelFilter();
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
  stopAutoScroll();
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

const pad2 = (value: number) => value.toString().padStart(2, "0");

const getTodayLocalIsoDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(
    today.getDate()
  )}`;
};

const getDueStatus = (due: string | null): "overdue" | "today" | null => {
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    return null;
  }
  const today = getTodayLocalIsoDate();
  if (due === today) {
    return "today";
  }
  if (due < today) {
    return "overdue";
  }
  return null;
};

const buildCardElement = (card: CardData, labelMap: Map<string, Label>) => {
  const cardElement = document.createElement("article");
  cardElement.className = "card";
  cardElement.draggable = true;
  cardElement.dataset.cardId = card.id;
  cardElement.dataset.labels = card.labels.join(",");
  const labels = card.labels
    .map((id) => labelMap.get(id))
    .filter((label): label is Label => Boolean(label));
  const labelText = labels.map((label) => label.name).join(" ");
  cardElement.dataset.searchText = `${card.title} ${card.detail} ${
    card.due ?? ""
  } ${labelText}`.toLowerCase();
  if (labels.length > 0) {
    const labelsContainer = document.createElement("div");
    labelsContainer.className = "card-labels";
    labels.forEach((label) => {
      const chip = document.createElement("span");
      chip.className = "card-label";
      chip.textContent = label.name;
      chip.style.backgroundColor = label.color;
      labelsContainer.appendChild(chip);
    });
    cardElement.appendChild(labelsContainer);
  }

  const title = document.createElement("h3");
  title.textContent = card.title;
  cardElement.appendChild(title);

  const detail = document.createElement("p");
  detail.textContent = card.detail ? card.detail : "No details";
  cardElement.appendChild(detail);

  const due = document.createElement("div");
  due.className = "due";
  const dueStatus = getDueStatus(card.due);
  if (dueStatus) {
    due.classList.add(`due-${dueStatus}`);
  }
  due.textContent = card.due ? `Due: ${card.due}` : "Due: None";
  cardElement.appendChild(due);

  cardElement.addEventListener("dblclick", () => {
    openEditDialog(card.id);
  });
  return cardElement;
};

const buildColumnElement = (
  column: { id: string; title: string },
  state: StatePayload,
  labelMap: Map<string, Label>
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
    stopAutoScroll();
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
    requestAutoScroll(event.clientX, event.clientY);
    autoScrollList(list, event.clientY);
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
    list.appendChild(buildCardElement(card, labelMap));
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
  if (event.key === "f" && (event.metaKey || event.ctrlKey)) {
    if (isDialogOpen()) {
      return;
    }
    event.preventDefault();
    openSearch();
    return;
  }
  if (event.key === "Escape" && isSearchOpen()) {
    event.preventDefault();
    closeSearch();
    return;
  }
  if (event.key === "Escape" && isLabelManagerOpen()) {
    event.preventDefault();
    closeLabelManagerModal();
    return;
  }
  if (event.key === "Escape" && isConfirmOpen()) {
    event.preventDefault();
    closeConfirm();
    return;
  }
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
