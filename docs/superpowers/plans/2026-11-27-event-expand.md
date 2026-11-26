# Event popup Expand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A toggle on the event popup that shows the same event large and centred over a dimmed page, remembered
per browser.

**Architecture:** A small hook in the edit-event feature's `model` segment holds the remembered choice and whether
the window is wide enough. `EventDialog` uses it to drop `Modal`'s `anchor` and pass a bigger `size`; `Modal`
already centres an unanchored dialog and blurs the page. A reading layout (sticky title row, larger type) applies
while expanded.

**Tech Stack:** React 19, Tailwind 4, native `<dialog>` via `Modal` in `@lc/ui`, Paraglide messages, Vitest (unit),
Storybook stories run as browser tests in `apps/stand` (Playwright, axe).

**Spec:** `docs/superpowers/specs/2026-11-27-event-expand-design.md` (research: `docs/event-expand-research.md`)

## Global Constraints

- Breakpoint: the toggle exists only at window width ≥ 768px, the same value as `Modal`'s `ANCHOR_FROM`; export it
  from `@lc/ui` and use it, do not repeat the number.
- Expanded size: `Modal` `size="wide"` (760px), no `anchor`. Small: today's `size="normal"` with the anchor.
- Button: before ✕, the same element in both states, `aria-pressed`, accessible name `m.expand()` in both states,
  icon `Maximize2` small / `Minimize2` expanded, tooltip `m.event_expand_hint()`. Focus stays on it after a press.
- Remembered in localStorage under `learning-curve:event-expanded` (`'1'` = expanded, key removed = small), read
  after mount and before the first paint; never in the URL.
- The new-event form (a `draft` with no `event`) never expands.
- Esc and a backdrop click close the dialog from either size, unchanged; closing keeps the remembered choice.
- Reading layout when expanded: title 22px, description 15.5px with line-height 1.6 and lines capped at 75ch, the
  title row sticks at the top; the edit form's description field starts 240px tall instead of 120px.
- Project rules (`CLAUDE.md`): no `any`, `as` or `!`; UI text only through `m.key()` with the key in all three
  `packages/i18n/messages/*.json`; imports inside a package are relative; comments only for *why*.
- Conventional Commits; commit each task when its checks pass.

## Review Focus

1. **Opened from a `?event=` link with Expand remembered**: the popup appears centred at once, never first beside
   the event and then jumping. Task 1 reads in a layout effect; Task 4 checks it by hand in the app.
2. **Stories leaking the stored choice**: a story that leaves the key set makes later stories and page stories open
   the popup expanded. Task 2's meta-level `beforeEach` clears it before and after every story.
3. **Toggling mid-task**: pressing Expand while the Mark done time question, a free-slot offer or an error is
   showing keeps it on screen (no remount). Task 2's `ExpandKeepsState` story.
4. **A long description while expanded**: the title row and the button row stay visible while only the middle
   scrolls. Task 3's `ExpandedLongDescription` story.
5. **The window narrowed below 768px while expanded**: the button disappears and the popup returns to today's size
   without closing; widening brings Expand back. Task 1's `available` follows the media query live; Task 4 checks it
   by hand.

---

### Task 1: The remembered choice

**Files:**
- Create: `modules/planner/src/features/edit-event/model/use-event-expanded.ts`
- Test: `modules/planner/src/features/edit-event/model/use-event-expanded.test.ts`
- Modify: `packages/ui/src/modal.tsx:31` (export `ANCHOR_FROM`), `packages/ui/src/index.ts:11`

**Interfaces:**
- Produces (from `@lc/ui`): `export const ANCHOR_FROM = 768`
- Produces (from `use-event-expanded.ts`):
  - `export const EVENT_EXPANDED_KEY = 'learning-curve:event-expanded'`
  - `export function parseEventExpanded(raw: string | null): boolean`
  - `export function useEventExpanded(): { available: boolean; expanded: boolean; toggle: () => void }`:
    `available` is true while the window is at least `ANCHOR_FROM` wide (live, false on the server); `expanded` is
    the stored choice AND `available`; `toggle` flips the stored choice and writes or removes the key.

- [ ] **Step 1: Write the failing test** in `use-event-expanded.test.ts`, in the style of
  `pages/planner/model/use-wide-panels.test.ts`:

```ts
describe('parseEventExpanded', () => {
  it('is small when nothing is stored', () => expect(parseEventExpanded(null)).toBe(false))
  it('is expanded when 1 is stored', () => expect(parseEventExpanded('1')).toBe(true))
  it('reads anything else as small', () => {
    for (const raw of ['0', 'true', '', '{}', 'yes']) expect(parseEventExpanded(raw)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec nx run @lc/planner:test -- use-event-expanded`
Expected: FAIL, the module `./use-event-expanded` does not exist.

- [ ] **Step 3: Implement the hook**

`parseEventExpanded`: `raw === '1'`. `available`: `useSyncExternalStore` on
`matchMedia(`(min-width: ${ANCHOR_FROM}px)`)`, the pattern of `widgets/hourglass/lib/use-reduced-motion.ts`, server
snapshot `false`. The stored choice: `useState(false)`, read in a **`useLayoutEffect`** (not `useEffect` as in
`use-wide-panels.ts`): `Modal` calls `showModal()` in a passive effect, and a choice read in a passive effect lands
after that, so a popup opened from a link would show small for a frame. Say that in one comment. Storage access in
`try`/`catch` both ways, as in `use-wide-panels.ts`. Export `ANCHOR_FROM` from `modal.tsx` and add it to the
`./modal` line of `packages/ui/src/index.ts`.

- [ ] **Step 4: Run the test**

Run: `pnpm exec nx run @lc/planner:test -- use-event-expanded`
Expected: PASS, 3 tests.

- [ ] **Step 5: Check and commit**

Run: `pnpm exec nx run-many -t typecheck lint lint:fsd -p @lc/planner @lc/ui && pnpm run fmt:check`
Expected: no errors.

```bash
git add packages/ui/src/modal.tsx packages/ui/src/index.ts modules/planner/src/features/edit-event/model
git commit -m "feat(planner): remember whether event popups open expanded"
```

### Task 2: The Expand toggle on the popup

**Files:**
- Modify: `modules/planner/src/features/edit-event/ui/EventDialog.tsx` (the `<Modal …>` line, the title row at
  lines 279–294)
- Modify: `packages/i18n/messages/ru.json`, `en.json`, `es.json` (next to `expand_hint`)
- Test: `modules/planner/src/features/edit-event/ui/EventDialog.stories.tsx`

**Interfaces:**
- Consumes: `useEventExpanded`, `EVENT_EXPANDED_KEY` (Task 1); `Maximize2`, `Minimize2` from `@lc/ui`.
- Produces: inside `EventDialog`, `const big: boolean` (expanded and an `event` is shown) for Task 3.

- [ ] **Step 1: Write the failing stories**

Add to the stories file:
- a helper `storeExpanded(value: '1' | null)` returning a `beforeEach`, the shape of `storePanels` in
  `pages/planner/ui/PlannerPage.stories.tsx`, and **`beforeEach: storeExpanded(null)` on `meta`** so no story leaks
  the choice;
- a helper `spot()` for `beforeEach` that appends a `position:fixed; left:40px; top:40px; width:120px; height:40px`
  div to `document.body`, and removes it in its cleanup; stories that need it pass
  `anchor: () => document.querySelector('[data-spot]')`;
- `globals: { viewport: { value: 'desktop', isRotated: false } }` (1280px) on every new story except `NarrowNoExpand`;
- measurements inside `waitFor`, widths from `offsetWidth`: the dialog's open animation scales it from 0.97 for
  150ms, so an early `getBoundingClientRect()` is off by a few pixels. "Left is 172" means `dialog.style.left` is
  `'172px'` (40 + 120 + the 12px gap); "centred" means `style.left` is `''` and the box's centre is within 1px of
  `innerWidth / 2`.

| Story | Setup | Assertions |
|---|---|---|
| `Expand` | spot, nothing stored | `window.innerWidth` ≥ 768; button named `m.expand()` has `aria-pressed="false"`; dialog box `left` is 172 (beside the spot). Click it → `aria-pressed="true"`, the button `toHaveFocus()`, dialog width 760 and its centre within 1px of `innerWidth / 2`, `localStorage.getItem(EVENT_EXPANDED_KEY)` is `'1'`. Click again → `aria-pressed="false"`, left 172 again, key is `null`. |
| `ExpandRemembered` | spot, `'1'` stored | on open the button is pressed and the dialog is centred. |
| `EscClosesExpanded` | `'1'` stored | `userEvent.keyboard('{Escape}')` → `args.onClose` called once; key still `'1'`. |
| `ExpandKeepsState` | nothing stored | click `m.mark_done()`, then Expand → the `m.spent_done_without()` button is still there. |
| `NewEventNeverExpands` | spot, `'1'` stored, `event: null`, `draft` as in `NewEvent` | no button named `m.expand()`; dialog left is 172. |
| `NarrowNoExpand` | `'1'` stored, `globals: { viewport: { value: 'mobile2', isRotated: false } }` | `innerWidth` < 768; no button named `m.expand()`; dialog width ≤ 560. |

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/stand && pnpm exec vitest run EventDialog.stories`
Expected: the 16 existing stories pass; `Expand`, `ExpandRemembered`, `EscClosesExpanded`, `ExpandKeepsState` fail
(no Expand button); `NewEventNeverExpands` and `NarrowNoExpand` may already pass.

- [ ] **Step 3: Add the messages**

`event_expand_hint`, after `expand_hint` in each file:
- ru: `"Показать событие крупно по центру экрана; так откроются и следующие события"`
- en: `"Show the event large in the middle of the screen; the next events open the same way"`
- es: `"Mostrar el evento en grande en el centro de la pantalla; los siguientes se abrirán igual"`

Run: `pnpm run check:i18n`
Expected: passes.

- [ ] **Step 4: Implement the toggle in `EventDialog`**

`big = expanded && event !== null`. `<Modal … anchor={big ? undefined : anchor} size={big ? 'wide' : 'normal'}>`.
In the read view's title row, when `available`, one `<button type="button">` before ✕ with the ✕ button's classes,
`aria-pressed={big}`, `aria-label={m.expand()}`, `data-tip={m.event_expand_hint()}`, `onClick={toggle}`, icon
`Minimize2` when `big` else `Maximize2` (`size={18} aria-hidden`). The row keeps one element per control in both
states, so React never remounts the focused button.

- [ ] **Step 5: Run the stories**

Run: `cd apps/stand && pnpm exec vitest run EventDialog.stories`
Expected: PASS, 22 tests.

- [ ] **Step 6: Check and commit**

Run: `pnpm run check`
Expected: no errors.

```bash
git add modules/planner/src/features/edit-event packages/i18n/messages
git commit -m "feat(planner): expand an event popup into a centred, focused view"
```

### Task 3: The reading layout

**Files:**
- Modify: `packages/ui/src/modal.tsx` (a `HEAD` class next to `FOOT`), `packages/ui/src/index.ts:11`
- Modify: `modules/planner/src/features/edit-event/ui/EventDialog.tsx` (title row, `<h3>`, description `<pre>`,
  the editing `EventForm`)
- Modify: `modules/planner/src/features/edit-event/ui/EventForm.tsx` (props, the description `<textarea>` at
  line 155)
- Test: `modules/planner/src/features/edit-event/ui/EventDialog.stories.tsx`

**Interfaces:**
- Consumes: `big` (Task 2).
- Produces: `export const HEAD: string` from `@lc/ui`: the title row that sticks at the top of a scrolling dialog,
  the mirror of `FOOT`: reaches over the body's padding (22px across, 20px above), `bg-surface`, fades at its lower
  edge the way `FOOT` fades at its upper one. Document it in `FOOT`'s comment block and `Modal`'s JSDoc, which list
  the exported class strings.
- Produces: `EventForm` prop `expanded?: boolean | undefined` (description field `min-h-[240px]` instead of
  `min-h-[120px]`).

- [ ] **Step 1: Write the failing stories** (desktop viewport, `'1'` stored)

| Story | Setup | Assertions |
|---|---|---|
| `ExpandedReading` | default event | heading's computed `font-size` is `22px`; the description `<pre>`'s is `15.5px` and its `max-width` is not `none`. |
| `ExpandedLongDescription` | `event: { ...upcoming, description: 40 lines of text }` | scroll the `<dialog>` to its end; the heading's box top ≥ the dialog's box top, and the `m.edit()` button's bottom ≤ the dialog's bottom. |
| `ExpandedEdit` | default event | click `m.edit()` → dialog width still 760; the description `<textarea>`'s computed `min-height` is `240px`. |

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/stand && pnpm exec vitest run EventDialog.stories`
Expected: the three new stories fail on font size, scroll position and min-height; the other 22 pass.

- [ ] **Step 3: Implement**

`HEAD` in `modal.tsx`. In `EventDialog`, while `big`: the title row gets `HEAD`; the `<h3>` uses a 22px title
class instead of `TITLE` (build the string conditionally: two `text-[…]` classes on one element do not override
each other in a set order); the `<pre>` uses `text-[15.5px]/[1.6] max-w-[75ch]` instead of `text-[14px]/[1.55]`;
the editing `EventForm` gets `expanded={big}`. In `EventForm`, choose the textarea's `min-h` the same way.

- [ ] **Step 4: Run the stories**

Run: `cd apps/stand && pnpm exec vitest run EventDialog.stories`
Expected: PASS, 25 tests.

- [ ] **Step 5: Check and commit**

Run: `pnpm run check`
Expected: no errors.

```bash
git add packages/ui/src/modal.tsx packages/ui/src/index.ts modules/planner/src/features/edit-event
git commit -m "feat(planner): give the expanded event popup a reading layout"
```

### Task 4: Whole-repo checks and the real app

**Files:** none changed, unless a check fails.

- [ ] **Step 1: Run every check**

Run: `pnpm run check && pnpm run test && pnpm run stand:test && pnpm run build`
Expected: all pass; `stand:test` runs every story in both themes.

- [ ] **Step 2: Check it in the app** (dev server on :3000, restart it if it is running old code)

On a window wider than 768px, on `/` (the Plan page):
1. Click an event: the popup opens beside it with the Expand button before ✕.
2. Press Expand: centred, 760px, page blurred; focus still on the button; Tab and Shift+Tab stay inside the dialog.
3. Close it with Esc, open another event: it opens expanded.
4. Copy the event's link, reload with it: the popup appears centred straight away, without a frame beside the
   event (Review Focus 1).
5. Narrow the window below 768px with the popup open: the button goes and the popup is today's size; widen it
   again: it returns expanded (Review Focus 5).
6. Double-click an empty slot: the new-event form opens beside its draft block.

- [ ] **Step 3: Report**

List what passed, and anything from step 2 that did not behave as written, with what was seen.
