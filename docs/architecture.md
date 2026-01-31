# Architecture

## High-level components
- Extension host (Node): owns VS Code APIs, storage, and command registration.
- Webview (browser sandbox): renders UI, manages user interactions, and sends mutation requests.

## Responsibilities
- `src/extension.ts`
  - Registers command `kanban.openBoard` and creates a webview panel.
  - Builds webview HTML and wires message handling.
  - Routes webview messages to storage operations and returns updated state.
- `src/storage.ts`
  - Encapsulates filesystem layout and all CRUD operations.
  - Normalizes and repairs state if files drift from the index.
- `src/core.ts`
  - Pure helpers: slugify, front matter, default columns, and index normalization.
- `src/webview.ts`
  - DOM rendering, drag-and-drop, dialogs, search.
  - Sends message events and applies new state.

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
- `kanban:card:update`
- `kanban:card:delete`
- `kanban:card:move`
- `kanban:card:reorder`
- `kanban:column:create`
- `kanban:column:create:request` (shows VS Code input box)
- `kanban:column:update`
- `kanban:column:delete`
- `kanban:column:delete:request` (shows confirmation dialog)
- `kanban:column:reorder`

Extension -> Webview
- `kanban:state` (full payload)
- `kanban:error` (string message)

## Error handling
The extension catches errors from storage and returns `kanban:error`. The webview shows an alert with the message.
