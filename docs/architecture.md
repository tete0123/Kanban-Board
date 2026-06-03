# Architecture

## High-level components
- Extension host (Node): owns VS Code APIs, storage, and command registration.
- Webview (browser sandbox): renders UI, manages user interactions, and sends mutation requests.

## Responsibilities
- `src/extension.ts`
  - Registers command `kanban.openBoard` and creates a webview panel.
  - Builds webview HTML and wires message handling.
  - Routes webview messages to storage operations and returns updated state.
  - Writes a Markdown export before clearing column cards when configured.
  - Handles `kanban:card:openFile` to open `.vscode-kanban/cards/<cardId>.md` in VS Code editor.
- `src/storage.ts`
  - Encapsulates filesystem layout and all CRUD operations.
  - Normalizes and repairs state if files drift from the index.
  - Validates parent-child assignments and clears child `parentId` values when parent cards are removed.
- `src/core.ts`
  - Pure helpers: slugify, front matter, default columns, and index normalization.
- `src/webview.ts`
  - DOM rendering, drag-and-drop, dialogs, search.
  - Sends message events and applies new state.
  - Provides "Open" / "Open .md" actions to open a card markdown file in editor.
  - Renders parent/children controls and derives direct child cards from the state payload.
  - Re-fetches state on focus/visibility restore to reflect external file edits.

## Data flow
```
User Action -> Webview JS -> postMessage({ type, data })
           -> Extension -> storage.* mutation
           -> storage.readState()
           -> Webview receives { type: "kanban:state", data }
```

## Message types
Webview -> Extension
- `kanban:init`
- `kanban:card:create`
- `kanban:card:update` (also used for parent-child assignments through `parentId`)
- `kanban:card:delete`
- `kanban:card:move`
- `kanban:card:reorder`
- `kanban:card:openFile` (open card markdown in editor)
- `kanban:column:create`
- `kanban:column:create:request` (shows VS Code input box)
- `kanban:column:update`
- `kanban:column:clearCards`
- `kanban:column:delete`
- `kanban:column:delete:request` (shows confirmation dialog)
- `kanban:column:reorder`

Extension -> Webview
- `kanban:state` (full payload)
- `kanban:error` (string message)

## Error handling
The extension catches errors from storage and returns `kanban:error`. The webview shows an alert with the message.
This also covers file-open failures (for example, card file missing).
