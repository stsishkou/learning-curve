# @lc/calendar-export

Exporting the plan to `.ics` files for Google Calendar and Outlook, as a microfrontend: one dialog. Feature-Sliced layers
inside; `src/index.ts` is the only entry.

- `ExportDialog`: the app renders it in the planner's `slots`, so the planner never imports this module. The files are
  built by `@lc/plan-domain/ics`, in the browser or behind the app's download routes.

May import: `@lc/plan-domain` (and its entries), `@lc/ui`, `@lc/i18n`. Never another module, `@lc/plan-data`,
`@lc/plan-service`, `@lc/plan-content`, `node:*` or server functions.

Has no tests of its own (the `.ics` rules are tested in `@lc/plan-domain`); its story is in the stand. Type-checked with
`pnpm exec nx run @lc/calendar-export:typecheck`.

Owns no data files.
