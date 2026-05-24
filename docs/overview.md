# Overview

This extension provides a lightweight Kanban board inside a VS Code webview. The board state is stored inside the current workspace under `.vscode-kanban/`, so it is project-local and versionable if desired.

## Goals
- Minimal UX for quick task management.
- Workspace-local persistence via files.
- No external services.

## User flow (happy path)
1. User runs the command `Kanban: Open Board`.
2. A webview opens and requests initial state with `kanban:init`.
3. The extension loads state from `.vscode-kanban/` and posts it back.
4. User edits columns/cards; webview posts mutations; extension updates storage and returns updated state.

## Parent-child card relationships
- A card can have one direct parent card and any number of direct child cards.
- Parent-child relationships support splitting a large card into smaller cards while keeping navigation available from either side.
- The board shows a compact relationship summary on cards that have a parent or child cards.
- Relationship changes do not move cards between columns and do not imply completion or progress.

## Key files
- `src/extension.ts` - extension activation and message router.
- `src/storage.ts` - persistence layer and state aggregation.
- `src/core.ts` - shared helpers (front matter parsing, IDs, normalization).
- `src/webview.ts` - webview UI logic, rendering, and message dispatch.
- `media/webview.js` - compiled webview script (do not edit).
- `media/styles.css` - webview styles.

## Non-goals
- Multi-workspace aggregation.
- Sync across machines.
- Rich text / markdown rendering.
