# Webview

## Rendering model
The webview is a vanilla DOM app (no framework). It renders a full board from the latest `StatePayload`.

State payload shape:
```
{
  columns: [{ id, title }],
  order: { [columnId]: string[] },
  cards: { [cardId]: { id, title, detail, due, createdAt, updatedAt } }
}
```

## UI structure
- Header: title + "Add Column" button
- Search widget (toggle with Ctrl/Cmd+F)
- Board: columns and cards
- Dialog: create/edit card

## User interactions
- Add column: posts `kanban:column:create:request` (extension prompts for name).
- Edit column title: posts `kanban:column:update` on change.
- Delete column: posts `kanban:column:delete:request` (extension confirms).
- Add card: dialog -> `kanban:card:create`.
- Edit card: double click -> dialog -> `kanban:card:update`.
- Delete card: dialog -> `kanban:card:delete`.
- Drag cards: `kanban:card:reorder` (same column) or `kanban:card:move` (different column).
- Drag columns: `kanban:column:reorder`.

## Search
- Open: Ctrl/Cmd+F (if no dialog open).
- Filters cards by title/detail/due text (lowercased).
- Highlights matches and shows a count.

## Input safety
Card content is escaped before insertion into HTML to avoid injection (`escapeHtml` in `src/webview.ts`).
