# Commands and Settings

## VS Code commands
Declared in `package.json`:
- `kanban.openBoard` (title: "Kanban: Open Board")

## VS Code settings
Declared in `package.json`:
- `kanban.clear.exportBeforeDelete`: when enabled, clearing a column first writes the column's cards to `yyyymmdd.md`.
- `kanban.clear.exportFolder`: folder for Markdown files exported before clearing a column. If empty, the extension prompts once and saves the selected folder in workspace settings.

Set these in workspace `settings.json`, opened with `Preferences: Open Workspace Settings (JSON)`:

```json
{
  "kanban.clear.exportBeforeDelete": true,
  "kanban.clear.exportFolder": "exports/kanban"
}
```

`kanban.clear.exportFolder` accepts either an absolute path or a path relative to the workspace root. The export only runs when `kanban.clear.exportBeforeDelete` is `true`.

Activation:
- `onCommand:kanban.openBoard`

## Entry point
- `src/extension.ts` registers the command and creates the webview.

## Webview resources
- Script: `media/webview.js`
- Styles: `media/styles.css`

Local resource roots are locked to the `media/` directory for security.
