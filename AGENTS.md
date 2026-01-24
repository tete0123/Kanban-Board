# AGENTS

## Project summary
- VS Code extension that provides a lightweight Kanban board stored in the workspace.

## Key paths
- `src/` extension source (TypeScript)
- `media/` webview assets
- `out/` compiled extension output
- `test/` Vitest tests

## Commands
- Build extension: `npm run compile`
- Watch extension: `npm run watch`
- Build webview only: `npm run compile:webview`
- Tests: `npm test`

## Notes
- Data is stored under `.vscode-kanban/` in the workspace when the extension runs.
- No linting is configured (see `npm run lint`).
- Do not edit `.js` files.
