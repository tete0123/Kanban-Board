# Testing

## Test runner
- `vitest` (see `vitest.config.ts`)

## Commands
- Run tests: `npm test`
- Watch mode: `npm run test:watch`

## Current coverage
- `test/core.test.ts` covers core helpers (front matter, slugify, normalization).
- `test/storage.test.ts` covers storage CRUD using an in-memory filesystem, including parent-child persistence and orphaning child cards when a parent is deleted.
- `test/webview.ui.test.ts` covers jsdom webview behavior, including saving selected parent and child relationships from the card dialog.

## Gaps / risk areas
- Extension message routing is not integration-tested.
- Visual layout behavior still needs manual verification in the VS Code webview.
