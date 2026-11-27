# @lc/docs-harness

A minimal host that mimics the planner (React 19.3, the UI kit's tokens and shortcuts, runtime-only federation) with
hostile CSS and window shortcuts, to prove the docs remote end to end: lazy loading, a single React, language and theme,
links, styles and keys both ways, and the fallback when the remote is down.

- `src/`: the host page, built on `@lc/remote-host/docs`.
- `tests/remote.spec.ts`: the Playwright tests. `playwright.config.ts` serves the built guide (`preview` of `@lc/docs`) and the harness.

May import: `@lc/docs-contract`, `@lc/remote-host`, `@lc/ui`. It never imports `@lc/docs`: it loads the guide through
federation, as a host does.

Run `pnpm run docs:test` from the root (Nx builds both apps first, then Playwright); `pnpm --filter @lc/docs-harness dev` serves it
on port 4320.

Owns no data files.
