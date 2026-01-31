# Testing

## Test runner
- `vitest` (see `vitest.config.ts`)

## Commands
- Run tests: `npm test`
- Watch mode: `npm run test:watch`

## Current coverage
- `test/core.test.ts` covers core helpers (front matter, slugify, normalization).
- `test/storage.test.ts` covers storage CRUD using an in-memory filesystem.

## Gaps / risk areas
- Webview UI logic is not unit-tested.
- Extension message routing is not integration-tested.
