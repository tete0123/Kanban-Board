# Commands and Settings

## VS Code commands
Declared in `package.json`:
- `kanban.openBoard` (title: "Kanban: Open Board")

Activation:
- `onCommand:kanban.openBoard`

## Entry point
- `src/extension.ts` registers the command and creates the webview.

## Webview resources
- Script: `media/webview.js`
- Styles: `media/styles.css`

Local resource roots are locked to the `media/` directory for security.
