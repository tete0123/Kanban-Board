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
        <button class="add-column" id="addColumn">+ Add Column</button>
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
          <div class="dialog-actions">
            <button id="deleteCard" class="danger hidden">Delete</button>
            <button id="cancelCard">Cancel</button>
            <button id="saveCard">Save</button>
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
