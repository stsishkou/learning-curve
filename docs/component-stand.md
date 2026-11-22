# The component stand

A separate app, `apps/stand`, that shows every component of the workspace on its own, with fixed data and
generated documentation. It is built with **Storybook 10**.

```bash
pnpm run stand         # dev server, http://localhost:6006
pnpm run stand:build   # static site in apps/stand/dist
```

## Which tool, and why

The request was for the option that is both the most widely used and current. The numbers below were fetched
on 2026-11-22 from the npm registry (`pnpm view <pkg> version time peerDependencies dependencies`) and the npm
downloads API (`api.npmjs.org/downloads/point/last-week/<pkg>`, week of 2026-11-15 to 2026-11-21).

| | Storybook | Ladle | React Cosmos | Histoire | React Styleguidist |
|---|---|---|---|---|---|
| Package | `storybook` + `@storybook/react-vite` | `@ladle/react` | `react-cosmos` | `histoire` | `react-styleguidist` |
| Latest version | 10.6.8 | 5.1.1 | 7.5.0 | 1.0.0-beta.1 (last stable 0.17.17) | 13.1.4 |
| Last release | 2026-11-20 | 2025-11-04 | 2026-11-19 | 2026-01-07 (stable: 2024-04-09) | 2025-01-07 |
| Stable releases in 12 months | 80 | 0 | 7 | 0 | 0 |
| Downloads per week | 38,904,693 (`@storybook/react-vite`: 28,395,398) | 521,873 | 92,088 | 133,190 | 78,038 |
| React 19 | yes: peer `^16.8 … ^19` | yes: peer `>=18` | yes: peer `>=18` | no React plugin: `@histoire/plugin-react` is not on npm | peer `>=18` |
| Vite 8 | yes: peer `^5 … ^8` | no: ships its own `vite ^6` and `@vitejs/plugin-react ^4` | yes: plugin peer `vite >=5` | no: peer `vite ^7.3` | no: webpack |
| Written pages (MDX) | yes | yes | no | Markdown | Markdown |
| Generated prop tables | yes (`react-docgen`, no compiler needed) | no | no (a props panel to edit values, no docs) | Vue only | yes, webpack loader |
| Interaction tests | `play` functions in the browser; Vitest addon for CI | none built in | none built in | none | none |
| Accessibility checks | `@storybook/addon-a11y` (axe), 20,041,830 downloads per week | built in (axe) | not in its docs | none | none |
| Maintenance | a release every few days; 11.0 in beta | no release for a year | active | in beta since 2025, no stable release since 2024 | no release since 2025-01 |

Also looked at and dropped: **Docz** (2.4.0 from 2023, React 16/17 only, 7,140 downloads), **Preview.js**
(`@previewjs/api`, last release 2024-12, 676 downloads). I found nothing newer than these that has both React
support and a documentation layer.

### The choice: Storybook 10.6

1. **It is the most used by a wide margin.** 38.9 M downloads a week against 0.52 M for Ladle, the runner-up:
   about 75 times more. Every component library a newcomer has seen is documented this way.
2. **It is also the most current.** 80 stable releases in the last twelve months, the latest two days before
   this was written, and its peer ranges already name React 19 and Vite 8. Ladle has not released for a year
   and bundles Vite 6; Histoire has no React support at all.
3. **It is the only one that covers the whole request in one tool:** stories, prop tables generated from the
   components' own types and JSDoc, written pages, a toolbar for theme and language, accessibility checks and
   scripted interactions. React Cosmos is a good, actively maintained sandbox, but it has no documentation
   layer: the "own documentation" would have to be a second tool.

So "most common" and "cutting-edge" do not conflict here: one tool is both. The one real trade-off is inside
Storybook. Version **11 is in beta** (11.0.0-beta.3, 2026-11-13) and brings a much smaller install and prop
docs read through the TypeScript 7.1 native API. The stand uses the stable 10.6 line; moving up is a version
bump in the catalog once 11.0 is released.

What Storybook costs: it is the heaviest option (96 packages added on install) and a static build of 9 MB. For a stand that is its own app and never ships with the product, that is acceptable.

### Decisions inside the setup

- **Prop docs use `react-docgen`.** The other generator, `react-docgen-typescript`, calls the TypeScript
  compiler API, which TypeScript 7 does not have. `react-docgen` parses each component file on its own. The
  limit: it documents the props declared in that file. Props that come from another type are not expanded, so
  `Button` lists `primary` but not the native `<button>` attributes it also accepts.
- **Telemetry is off** (`core.disableTelemetry` in `apps/stand/.storybook/main.ts`). Storybook otherwise
  reports anonymous usage data.
- **Every story is a test.** `pnpm run stand:test` runs `@storybook/addon-vitest`: Vitest opens each story
  in headless Chromium (Playwright), fails it when it does not render, when its `play` function fails or when
  axe finds an accessibility violation. The whole run takes about five seconds. The browser is installed once
  with `pnpm --filter @lc/stand exec playwright install chromium`.
- **Known accessibility findings are marked, not hidden.** A story file whose component has a finding sets
  `parameters.a11y.test` to `'todo'` with a comment naming it: the Accessibility panel still shows the
  violation, the test run does not fail on it. Remove the parameter when the component is fixed.

## How it is put together

```
apps/stand/
  .storybook/main.ts          where stories are found, addons, docgen
  .storybook/preview.tsx      the theme and language toolbar, the docs theme
  .storybook/preview-head.html  the fonts and <meta name="color-scheme">
  vitest.config.ts            the story tests: every story in headless Chromium
  src/styles.css              Tailwind and the theme, the stand's copy of apps/web/src/styles.css
  src/docs/*.mdx              written pages: Introduction, Design tokens
packages/ui/src/*.stories.tsx                       stories live next to their components
modules/*/src/**/ui/*.stories.tsx
packages/plan-domain/src/fixtures.ts                the plan every story uses
```

- **Theme switch.** The toolbar rewrites `<meta name="color-scheme">` in the preview, the same mechanism as
  `apps/web/src/shell/theme.ts`, so `packages/ui/src/theme.css` is exercised as in the app.
- **Language switch.** The toolbar value is given to Paraglide with `overwriteGetLocale`, and the story is
  rendered again. The app takes the locale from the URL instead.
- **Framed stories.** A dialog story on a docs page runs in its own frame, which the toolbar does not reach.
  The page passes its theme and language down with `postMessage` (`apps/stand/src/globals.ts`).
- **Data.** `@lc/plan-domain/fixtures` builds the real schedule in memory with `buildPlan()` and fixes "now"
  at 2026-12-02 12:40. Stories never read `packages/plan-data`, so editing the plan in the app does not
  change them.
- **Nx.** `@lc/stand:dev` is a continuous target and `@lc/stand:build` is cached, both through the existing
  `targetDefaults`. `pnpm run build` builds the stand as well as the app, one after the other
  (`parallelism: false`): the app's build rewrites the compiled messages in `packages/i18n/src/paraglide`,
  and a stand build running beside it would read them half-written.

## Adding a story

Put `Name.stories.tsx` next to `Name.tsx`. Nothing has to be registered: the stand picks up every
`*.stories.tsx` under `packages/ui/src` and `modules/*/src`.

```tsx
// modules/planner/src/widgets/budget-panel/ui/BudgetPanel.stories.tsx
import { DAY, occurrences } from '@lc/plan-domain'
import { fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { BudgetPanel } from './BudgetPanel'

const meta = {
  title: 'Planner/Widgets/BudgetPanel', // the place in the sidebar
  component: BudgetPanel, // the docs page and the prop table come from this
  args: {
    plan: fixturePlan,
    weekItems: occurrences(fixturePlan, fixtureWeek, fixtureWeek + 7 * DAY, new Set()),
  },
  argTypes: { plan: { control: false }, weekItems: { control: false } },
} satisfies Meta<typeof BudgetPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const EmptyWeek: Story = { args: { weekItems: [] } }
```

Rules that keep `pnpm run check` green:

- A story imports its own component by relative path and other packages by name, like any file of that
  package. A module's story must not import another module.
- Callbacks are `fn()` from `storybook/test`: calls show up in the Actions panel and can be asserted in `play`.
- A dialog covers the whole document. Give its stories their own frame on the docs page:
  `parameters: { docs: { story: { inline: false, iframeHeight: 520 } } }`. A dialog opens in an effect, so a
  `play` function waits for it with `findByRole`, not `getByRole`.
- In a `play` function, fill a text field with `fireEvent.change(input, { target: { value } })`, not
  `userEvent.type`. With React 19 the user-event build inside `storybook/test` writes the value through the
  tracker React keeps on a controlled input, so React sees no change and `onChange` never runs. Clicks and
  `userEvent.keyboard` work.
- Use React hooks in a story, not Storybook's (`useArgs`): the language switch renders the story again
  outside Storybook's hook context.
- Turn the control off for big objects (`plan`, `items`): `argTypes: { plan: { control: false } }`.
- The description on the docs page is the JSDoc comment above the component, and each prop's description is
  the comment above it in the props interface. Write them there, not in the story.
- Story names and sample text are plain English. Do not call `m.…()` in a story: the text a component shows
  is its own job.
- A new module needs `@storybook/react-vite` and `storybook` in its `devDependencies` (`catalog:`) and has to
  be added to `apps/stand/package.json`.

A written page is an `.mdx` file in `apps/stand/src/docs` that starts with `<Meta title="…" />`.
