# @lc/dashboard

The progress dashboard as a microfrontend: stat tiles and charts over the plan, read-only. Feature-Sliced layers inside;
`src/index.ts` is the only entry.

- `DashboardPage`, `parseDashboardSearch`: the page and its URL state. The plan and what is derived from it arrive as
  props.

May import: `@lc/plan-domain` (and its entries), `@lc/ui`, `@lc/i18n`. Never another module, `@lc/plan-data`,
`@lc/plan-service`, `@lc/plan-content`, `node:*` or server functions.

Tested with Vitest: `pnpm exec nx run @lc/dashboard:test`; its stories are in the stand.

Owns no data files.
