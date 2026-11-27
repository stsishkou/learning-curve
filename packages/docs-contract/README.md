# @lc/docs-contract

The public contract of the docs app: the API its federated features expose, their events, and the catalog of chapters
every consumer links to (`PINNED_COMMIT`, `sourceUrl`). Types and pure helpers only, so importing it puts no code of the
guide in a host. Semver; changes are listed in `CHANGELOG.md`, and a major version is built into a new `remote/v<major>/`.

- `.` (`src/index.ts`): the types; `src/catalog.ts` holds the chapters.

Imports nothing: no workspace package, no React, no `node:*` (Oxlint). It is the `contract` layer, so the docs app, the
harness, the app and `@lc/remote-host/docs` all depend on it.

Tested with Vitest: `pnpm exec nx run @lc/docs-contract:test`.

Owns no data files.
