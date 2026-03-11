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

## Version upgrade checklist
When bumping the extension version, list and apply the following edits:

1. `package.json`
- Edit target: `version`
- 対応内容: increase the version (for example `1.0.6` -> `1.0.7`).
- Additional check: if minimum VS Code support changes, also update `engines.vscode`.

2. `CHANGELOG.md`
- Edit target: new top entry
- 対応内容: add `## [x.y.z] - YYYY-MM-DD` at the top and summarize user-visible changes in bullets.
- Additional check: date must match the release day.

3. `README.md`
- Edit target: requirement and feature descriptions affected by the release
- 対応内容: update `Requirements` (`VS Code ^...`) and any changed feature/usage text.

4. Release artifact (`*.vsix`)
- Edit target: package output
- 対応内容: generate a new VSIX whose filename includes the bumped version (for example `kanban-board-1.0.7.vsix`).

5. Verification before release
- Edit target: local validation step
- 対応内容: run `npm test` and `npm run compile` and confirm both pass before publishing.
