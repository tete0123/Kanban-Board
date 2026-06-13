# Webview

## Rendering model
The webview is a vanilla DOM app (no framework). It renders a full board from the latest `StatePayload`.

State payload shape:
```
{
  columns: [{ id, title }],
  order: { [columnId]: string[] },
  cards: { [cardId]: { id, title, detail, parentId, due, labels, checklist, createdAt, updatedAt } },
  labels: [{ id, name, color }]
}
```

## UI structure
- Header: title + "Add Column" button
- Search widget (toggle with Ctrl/Cmd+F)
- Board: columns and cards
- Dialog: create/edit card (`Open .md` is shown only in edit mode)
- Parent/children section in the card dialog for assigning, removing, and opening directly related cards

## Parent/children dialog behavior
- The relationship section is shown when editing an existing card and hidden while creating a normal card.
- `Set Parent` assigns the selected card as the edited card's parent.
- `Attach Child` assigns the edited card as the selected card's parent.
- `New Child` opens the create-card dialog in the edited card's current column and preselects the edited card as the new card's parent.
- Related card titles in the section open that card's edit dialog.
- `Remove` clears the `parentId` on the child side of the relationship.
- Parent choices exclude the edited card and its descendants; child choices exclude the edited card and its ancestors, preventing circular relationships from the UI.
- Cards on the board show `Parent`, `Children: N`, or both when they have direct relationships.

## User interactions
- Add column: posts `kanban:column:create:request` (extension prompts for name).
- Edit column title: posts `kanban:column:update` on change.
- Clear column cards: confirms in the webview, then posts `kanban:column:clearCards`; if `kanban.clear.exportBeforeDelete` is enabled, the extension writes an export file to `kanban.clear.exportFolder` before deleting cards.
- Delete column: posts `kanban:column:delete:request` (extension confirms).
- Add card: dialog -> `kanban:card:create`.
- Edit card: double click -> dialog -> `kanban:card:update`; the Title input is focused with the cursor and visible text at the start of the title.
- Parent/child changes: dialog -> `kanban:card:update` with the child's `parentId`.
- Delete card: dialog -> `kanban:card:delete`.
- Open card markdown in editor:
  - Card row "Open" button -> `kanban:card:openFile`.
  - Edit dialog "Open .md" button -> `kanban:card:openFile`.
- Drag cards: `kanban:card:reorder` (same column) or `kanban:card:move` (different column).
- Drag columns: `kanban:column:reorder`.
- Drag auto-scroll: while dragging a card or column over the board, holding the pointer within 60px of a viewport side scrolls the board horizontally at a constant speed. Leaving the board stops horizontal auto-scroll; vertical card-list auto-scroll remains active.

## State refresh after external edit
- When the webview regains focus (or becomes visible), it posts `kanban:init` again.
- This keeps board UI in sync after editing a card `.md` in a normal editor tab.

## Search
- Open: Ctrl/Cmd+F (if no dialog open).
- Filters cards by title/detail/due text (lowercased).
- Highlights matches and shows a count.

## Input safety
Card content is escaped before insertion into HTML to avoid injection (`escapeHtml` in `src/webview.ts`).
