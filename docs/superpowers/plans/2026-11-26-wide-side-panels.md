# Wide Side Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Plan page's wide layout (Expand / full screen), the Next panel and the Insights panel can each be shown or hidden from a side-panel menu, and the choice is remembered in the browser.

**Architecture:** A small hook in the planner page model keeps which panels are shown in localStorage. The page
shows the side column in wide when at least one panel is on; Regular always shows both. The two switches are
declared once as planner actions, so the toolbar's new menu, the `⋮` menu on a narrow screen and the command
search all read the same list. `Menu` in `@lc/ui` learns to show an icon other than `⋮` on its trigger.

**Tech Stack:** React 19, TypeScript 7 (strict, no `as`/`!`/`any`), Tailwind, Paraglide messages, Storybook 10
stories as browser tests (`apps/stand`), Vitest for pure functions.

**Spec:** `docs/superpowers/specs/2026-11-26-wide-side-panels-design.md`

## Global Constraints

- Default: both panels hidden in wide, so wide looks as today until a panel is turned on.
- Remembered in this browser (localStorage), not in the URL; read after mount, like `use-second-zone.ts`.
- Regular is unchanged: it always shows both panels, whatever is stored.
- Full screen uses the wide layout (`expanded = nav.expanded || fullscreen.on` in `PlannerPage.tsx`), so the same panels.
- Shown panels sit in the existing 280px right column (`lg:grid-cols-[1fr_280px]`); below `lg` the Regular one-column rules apply.
- No shortcut keys for the switches. The week budget line stays in the pinned toolbar.
- Every UI string is in `packages/i18n/messages/{ru,en,es}.json`, called as `m.key()`; run `pnpm run check:i18n`.
- Comments only for *why*. No `as`, `!`, `any`. Commits are Conventional Commits; commit straight to `develop`.
  Do not stage `packages/plan-data/data/edits.json` or `plan.json`: they hold the user's own uncommitted edits.
- Finish with `pnpm run check`, `pnpm run test`, `pnpm run stand:test`.

## Review Focus

- A stored value that is not a list of known panel names (`"1"`, `{}`, `["next","bogus"]`, invalid JSON) must
  read as "only the known names in it", never throw. Pinned by `parseWidePanels` tests in Task 2.
- Storage blocked (private window): switching still works until the page is closed; no error reaches the page.
  Checked by reading: the hook wraps every storage call in `try/catch` as `use-second-zone.ts` does.
- What is stored for wide must not leak into Regular: Regular shows both panels even when nothing is stored.
  Pinned by the Collapse step of the `WideSidePanels` story in Task 3.
- A choice made in one visit is there on the next: pinned by the `WideSidePanelsRemembered` story in Task 3.
- With only Insights on, it fills the column to the bottom of the window (about 650px at 1440×900). `useFillHeight`
  re-measures on body resize; check on the running app with a screenshot at the end of Task 3.

---

### Task 1: A menu trigger with its own icon

**Files:**
- Modify: `packages/ui/src/menu.tsx` (Props, the trigger `<button>`)
- Modify: `packages/ui/src/icons.ts` (add `PanelRight` to the Lucide re-export list)
- Test: `packages/ui/src/menu.stories.tsx`

**Interfaces:**
- Produces: `Menu` accepts `icon?: ReactNode` (the trigger's icon; `EllipsisVertical` when absent). `PanelRight`
  exported from `@lc/ui`.

- [ ] **Step 1: Write the failing story**

In `menu.stories.tsx` add:

```tsx
/** A menu of its own in a toolbar shows its own icon instead of the `⋮`, and keeps its name. */
export const WithIcon: Story = {
  args: { label: 'Side panels', icon: <Calendar size={17} aria-hidden /> },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Side panels' })
    await expect(trigger.querySelector('.lucide-calendar')).not.toBeNull()
    await expect(trigger.querySelector('.lucide-ellipsis-vertical')).toBeNull()
  },
}
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @lc/stand exec vitest run menu.stories`
Expected: FAIL in `WithIcon` (no `.lucide-calendar` in the trigger), and a type error on `icon` in the editor.

- [ ] **Step 3: Add `icon?: ReactNode` to `Props` in `menu.tsx`**

JSDoc: `/** The trigger's icon, for a menu of its own in a toolbar; the \`⋮\` when absent */`. The trigger renders
`icon ?? <EllipsisVertical size={18} aria-hidden />`. Add `PanelRight` to `icons.ts` (keep the list's order style).

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm --filter @lc/stand exec vitest run menu.stories icons.stories`
Expected: PASS, 3 tests in `menu.stories` and the icons story.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/menu.tsx packages/ui/src/menu.stories.tsx packages/ui/src/icons.ts
git commit -m "feat(ui): a menu trigger can show its own icon"
```

---

### Task 2: Which side panels the wide layout shows, remembered

**Files:**
- Create: `modules/planner/src/pages/planner/model/use-wide-panels.ts`
- Test: `modules/planner/src/pages/planner/model/use-wide-panels.test.ts`

**Interfaces:**
- Produces:
  - `export type WidePanel = 'next' | 'insights'`
  - `export type WidePanels = Record<WidePanel, boolean>`
  - `export const WIDE_PANELS_KEY = 'learning-curve:wide-panels'` (stored value: JSON array of shown names, e.g. `["insights"]`)
  - `export function parseWidePanels(raw: string | null): WidePanels`
  - `export function useWidePanels(): { shown: WidePanels; toggle: (panel: WidePanel) => void }` — both `false`
    until read after mount.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'

import { parseWidePanels } from './use-wide-panels'

describe('parseWidePanels', () => {
  it('shows nothing when nothing is stored', () => {
    expect(parseWidePanels(null)).toEqual({ next: false, insights: false })
  })
  it('shows the panels the list names', () => {
    expect(parseWidePanels('["insights"]')).toEqual({ next: false, insights: true })
    expect(parseWidePanels('["next","insights"]')).toEqual({ next: true, insights: true })
  })
  it('ignores names it does not know', () => {
    expect(parseWidePanels('["next","bogus",3]')).toEqual({ next: true, insights: false })
  })
  it('reads anything that is not a list as nothing shown', () => {
    for (const raw of ['1', '{}', '"next"', 'not json']) {
      expect(parseWidePanels(raw)).toEqual({ next: false, insights: false })
    }
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @lc/planner exec vitest run use-wide-panels`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement the file**

`parseWidePanels` catches the `JSON.parse` error and reads `unknown` with `Array.isArray`, as
`features/plan-reviews/model/use-dismissed-reviews.ts` does. `useWidePanels` follows
`features/second-zone/model/use-second-zone.ts`: state starts `{ next: false, insights: false }`, a mount effect
reads `parseWidePanels(localStorage.getItem(WIDE_PANELS_KEY))` in `try/catch`, and `toggle` flips one panel, sets
state and writes the JSON array of shown names (removing the key when none is shown) in `try/catch`.

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm --filter @lc/planner exec vitest run use-wide-panels`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add modules/planner/src/pages/planner/model/use-wide-panels.ts modules/planner/src/pages/planner/model/use-wide-panels.test.ts
git commit -m "feat(planner): remember which side panels the wide layout shows"
```

---

### Task 3: Show Next and Insights next to the expanded calendar

**Files:**
- Modify: `packages/i18n/messages/{ru,en,es}.json` (new keys next to `expand`; `expand_hint` reworded)
- Modify: `modules/planner/src/pages/planner/model/planner-actions.ts` (extract `toMenuItem`)
- Modify: `modules/planner/src/pages/planner/model/build-actions.tsx` (`Context.panels`, two actions after `fullscreen`)
- Modify: `modules/planner/src/pages/planner/ui/PlannerToolbar.tsx` (`panels` prop, the menu)
- Modify: `modules/planner/src/pages/planner/ui/PlannerPage.tsx` (hook, side column, `data-panel` wrappers)
- Modify: `modules/planner/src/pages/planner/model/search.ts` (JSDoc of `expanded`)
- Test: `modules/planner/src/pages/planner/ui/PlannerPage.stories.tsx`

**Interfaces:**
- Consumes: `Menu`'s `icon` and `PanelRight` (Task 1); `useWidePanels`, `WidePanel`, `WidePanels`, `WIDE_PANELS_KEY` (Task 2).
- Produces:
  - `export const toMenuItem = (a: PlannerAction): MenuItem` — every field `toMenuItems` maps today except
    `className`; `toMenuItems` becomes `filter(a => a.menu)` + `{ ...toMenuItem(a), className }`.
  - `Context.panels?: { shown: WidePanels; toggle: (panel: WidePanel) => void } | undefined` — present only in wide.
  - Actions `panel-next` and `panel-insights` (group `view`, `icon: <PanelRight {...ICON} />`, `checked` from
    `shown`, `menu: 'narrow'` like `expand`: on `md` and up the toolbar has their button). Label: the `_hide`
    message when shown, else `_show`; `menuLabel`: `panel_next` / `panel_insights`.
  - `PlannerToolbar` prop `panels?: MenuItem[] | undefined` — "Present in the wide layout: the switches of the side
    panels". Rendered as `<Menu label={m.side_panels()} icon={<PanelRight size={17} aria-hidden />} items={panels} />`
    inside the `md:flex` view group, right before `<ScreenButtons>`.
  - Page wrappers of the two panels carry `data-panel="next"` and `data-panel="insights"` (the stories query them,
    as they query `data-slot` and `data-key`).

- [ ] **Step 1: Add the messages**

| key | en | ru | es |
|---|---|---|---|
| `side_panels` | Side panels | Боковые панели | Paneles laterales |
| `panel_next` | Next panel | Панель «Дальше» | Panel «Siguiente» |
| `panel_insights` | Insights panel | Панель «Сводка» | Panel «Resumen» |
| `panel_next_show` | Show the Next panel beside the expanded calendar | Показать панель «Дальше» рядом с развёрнутым календарём | Mostrar el panel «Siguiente» junto al calendario ampliado |
| `panel_next_hide` | Hide the Next panel | Скрыть панель «Дальше» | Ocultar el panel «Siguiente» |
| `panel_insights_show` | Show the Insights panel beside the expanded calendar | Показать панель «Сводка» рядом с развёрнутым календарём | Mostrar el panel «Resumen» junto al calendario ampliado |
| `panel_insights_hide` | Hide the Insights panel | Скрыть панель «Сводка» | Ocultar el panel «Resumen» |
| `expand_hint` (reworded) | Calendar across the whole window: no header or runway, side panels only when turned on | Календарь на всё окно: без шапки и шкалы, боковые панели — по желанию | El calendario ocupa toda la ventana: sin cabecera ni línea de tiempo, y los paneles laterales solo si los activas |

Run: `pnpm run check:i18n`
Expected: passes.

- [ ] **Step 2: Write the failing stories**

In `PlannerPage.stories.tsx` (import `WIDE_PANELS_KEY` from `../model/use-wide-panels`):

```tsx
const storePanels = (value: string | null) => () => {
  if (value === null) localStorage.removeItem(WIDE_PANELS_KEY)
  else localStorage.setItem(WIDE_PANELS_KEY, value)
  return () => localStorage.removeItem(WIDE_PANELS_KEY)
}
const panel = (root: HTMLElement, name: string) => root.querySelector(`[data-panel="${name}"]`)

/**
 * The expanded calendar opens without its side panels; the side-panel menu brings back Next and Insights one by
 * one, and the choice is remembered. Collapsing shows both again, whatever is remembered for the wide layout.
 */
export const WideSidePanels: Story = {
  beforeEach: storePanels(null),
  args: { search: { week: ymd(fixtureWeek), expanded: true } },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(panel(canvasElement, 'next')).toBeNull()
    await expect(panel(canvasElement, 'insights')).toBeNull()
    await userEvent.click(page.getByRole('button', { name: m.side_panels() }))
    const insights = await page.findByRole('menuitemcheckbox', { name: m.panel_insights() })
    await expect(insights).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(insights)
    await expect(insights).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(panel(canvasElement, 'insights')).not.toBeNull())
    await expect(panel(canvasElement, 'next')).toBeNull()
    await expect(localStorage.getItem(WIDE_PANELS_KEY)).toBe('["insights"]')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(page.getByRole('button', { name: m.collapse() }))
    await waitFor(() => expect(panel(canvasElement, 'next')).not.toBeNull())
    await expect(panel(canvasElement, 'insights')).not.toBeNull()
  },
}

/** A panel turned on in an earlier visit is there when the expanded calendar opens again. */
export const WideSidePanelsRemembered: Story = {
  beforeEach: storePanels('["next"]'),
  args: { search: { week: ymd(fixtureWeek), expanded: true } },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(panel(canvasElement, 'next')).not.toBeNull())
    await expect(panel(canvasElement, 'insights')).toBeNull()
  },
}
```

Also reword the JSDoc of `FullDayExpanded`: "…the header and the runway are hidden, and the side panels until
they are turned on."

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm --filter @lc/stand exec vitest run PlannerPage.stories`
Expected: FAIL in both new stories (no button named `m.side_panels()`; no `data-panel` element).

- [ ] **Step 4: Wire it up**

- `planner-actions.ts`: extract `toMenuItem` as in Interfaces.
- `build-actions.tsx`: add `Context.panels` and the two actions as in Interfaces; import `PanelRight` from `@lc/ui`.
- `PlannerToolbar.tsx`: the `panels` prop and its `Menu` as in Interfaces.
- `PlannerPage.tsx`:
  - `const widePanels = useWidePanels()`;
  - pass `panels: expanded ? widePanels : undefined` to `buildActions`;
  - pass the toolbar `actions.filter((a) => a.id === 'panel-next' || a.id === 'panel-insights').map(toMenuItem)`,
    only when `expanded`;
  - `const side: WidePanels = expanded ? widePanels.shown : { next: true, insights: true }`. The grid gets
    `lg:grid-cols-[1fr_280px]` when `side.next || side.insights`. The `<aside>` renders under the same condition,
    and each wrapper `<div>` renders only when its panel is on, with `data-panel` and its existing classes.
- `search.ts`: the JSDoc of `expanded` becomes "The calendar takes the whole window: the header and the runway are
  hidden, the side panels show only when turned on".

- [ ] **Step 5: Run the stories and see them pass**

Run: `pnpm --filter @lc/stand exec vitest run PlannerPage.stories menu.stories`
Expected: PASS, including `WideSidePanels`, `WideSidePanelsRemembered`, `IconsOnly`, `FullDayExpanded`.

- [ ] **Step 6: Check it on the running app**

The dev server runs on :3000 (restart it if it is down). Screenshot `http://localhost:3000/?expanded=true` at
1440×900 with `learning-curve:wide-panels` set to `["insights"]`, using Playwright from
`node_modules/.pnpm/playwright@1.65.1`. Expected: Insights in a 280px right column, its body filling down to
about 66px above the bottom of the window. Do the same with `["next","insights"]` and with nothing stored. The last
must look as today.

- [ ] **Step 7: Run the whole gate**

Run: `pnpm run fmt && pnpm run check && pnpm run test && pnpm run stand:test`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/i18n/messages modules/planner/src/pages/planner
git commit -m "feat(planner): show Next and Insights next to the expanded calendar"
```
