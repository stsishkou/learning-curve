# @lc/ui

The UI kit: the app bar, buttons, segmented control, menus, popovers, modal, tooltip, icons, keyboard shortcut helpers and
the Tailwind theme tokens. It knows nothing about the plan.

- `.` (`src/index.ts`): the components and helpers.
- `./testing`: stand-ins for browser features (full screen) in stories and tests.
- `./theme.css`: the design tokens, imported by each app.

Imports no workspace package and no `node:*` (Oxlint). Every component has a story in the stand.

Tested through the stand: `pnpm run stand:test`. Type-checked with `pnpm exec nx run @lc/ui:typecheck`.

Owns no data files.
