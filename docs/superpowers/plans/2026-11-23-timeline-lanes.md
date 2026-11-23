# Timeline Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A strip of thin lanes, one per shown calendar, above or below the planner header, where a course, its end
and its deadline can be dragged (or moved by keyboard) to reschedule it.

**Architecture:** A pure `calendarLanes`/`lanesRange` in `plan-domain` says what each lane holds; a planner widget
`timeline-lanes` draws them and turns drags and keys into four callbacks; the planner page turns those into the
existing changes (`events.shift`, `deadlineChange`) or opens the Reschedule dialog, which gains a preset and a
"Finish by" date.

**Tech Stack:** TypeScript, React 19, Tailwind 4, Paraglide, Vitest (packages), Storybook play tests (modules).

**Spec:** `docs/superpowers/specs/2026-11-23-timeline-lanes-design.md`

## Global Constraints

- No `any`, `as` or `!`; `exactOptionalPropertyTypes` (`name?: T | undefined` where callers pass `undefined`).
- Every UI string in `packages/i18n/messages/{ru,en,es}.json`, called as `m.key()`; `pnpm run check:i18n` passes.
- Dates are Minsk wall-clock: `parseLocal`, `ymd`, `addDays`, `startOfDay`, `mondayOf`, `DAY` from `@lc/plan-domain`.
- Modules never import `@lc/plan-data`, `node:*` or server functions; imports inside a package are relative.
- Comments only for *why*. Commits are Conventional Commits, body lines ≤ 100 characters, no attribution trailer.
- Never stage `packages/plan-data/data/edits.json` or `plan.json`.
- Before each commit: `pnpm run fmt`, `pnpm run check`; UI tasks also `pnpm run stand:test`; packages
  `pnpm run test`; the last task also `pnpm run build`.

## Review Focus

1. A course that began before the drawn range or ends after it: its bar is cut at the edge and fades there, never
   a negative width, and its handles stay inside the track.
2. The finish handle and the deadline diamond on the same or neighbouring days: both stay reachable by keyboard;
   for a pointer the diamond is on top.
3. A drag cancelled by the browser (`pointercancel`, a scroll on touch) or by Escape: nothing is stored, the ghost
   is gone, and no click opens the dialog afterwards.
4. A lane drag whose shift would overlap another event: nothing is stored; Reschedule opens with the same calendar
   and days and shows the warning.
5. Hidden strip: the only ways back are the planner ⋮ menu and the command search "Timeline" switch.

---

### Task 1: What a lane holds

**Files:**
- Create: `packages/plan-domain/src/lanes.ts`, `packages/plan-domain/src/lanes.test.ts`
- Modify: `packages/plan-domain/src/index.ts` (export)

**Interfaces:**
- Produces:
  ```ts
  export type LaneSessionState = 'done' | 'open' | 'missed'
  export interface LaneSession { uid: string; day: string; state: LaneSessionState }
  export interface CalendarLane {
    calendar: PlanCalendar
    first: string            // day of the first session, YYYY-MM-DD
    last: string             // day of the last session
    deadline: string | null  // deadlineOf
    sessions: LaneSession[]  // by start
    done: number
    total: number
    openFrom: string | null  // day of the first session not done
  }
  export function calendarLanes(plan: Plan, now: number | null, hidden: ReadonlySet<string>): CalendarLane[]
  export function lanesRange(lanes: CalendarLane[], now: number | null): { start: number; end: number } | null
  ```
  `start`/`end` are day ms (`end` exclusive).

Rules: a lane for each calendar not in `hidden`, in calendar order, that has sessions (`isSession`) and either one
not done or a deadline on or after today. A session is `missed` when not done and `parseLocal(end) <= now`. With
`now` null nothing is missed and every deadline counts. Range: start = `mondayOf(today) − 7 days`, where today is
`startOfDay(now)`, or with `now` null the earliest `openFrom` (else the earliest `first`); end = the latest of
`last + 1 day` and `deadline + 1 day`; at least 28 days. null for no lanes.

- [ ] **Step 1: Write the failing tests** (`fixturePlan`, `fixtureNow` = 2026-12-02 12:40)
  - `one lane per calendar with sessions, in calendar order` → ids `['certs','hfllm','hfagents','pypy']`.
  - `a hidden calendar has no lane` → hidden `{'hfllm'}` drops it.
  - `a lane holds its first and last day, its deadline and how many are done` → certs: first `2026-11-23`, last
    `2026-12-23`, deadline `2026-12-30`, total 40, done 14, `openFrom` = day of its first session not done.
  - `a past session that is not done is missed` → un-done the first certs session: state `missed`; a later open
    one `open`; a done one `done`.
  - `a finished course past its deadline has no lane, one before it keeps its lane` → certs all done: no lane at
    `now = 2027-01-05`; a lane at `fixtureNow`.
  - `before the clock is known nothing is missed` → `now` null: no `missed` state.
  - `the range starts the Monday a week before today and ends after the last session or deadline` → start
    `parseLocal('2026-11-23')`, end `parseLocal('2027-03-10')`.
  - `the range is at least four weeks` → one lane (certs only, others hidden) at `now = 2026-12-28`: end − start
    = 28 days.
  - `before the clock is known the range starts a week before the first open session` → `now` null.
- [ ] **Step 2:** `cd packages/plan-domain && pnpm exec vitest run src/lanes.test.ts` — Expected: FAIL (no module).
- [ ] **Step 3:** Implement `lanes.ts`; export the four names and two types from `src/index.ts`.
- [ ] **Step 4:** Same command — Expected: PASS; then `pnpm run test` — Expected: all pass.
- [ ] **Step 5:** `pnpm run fmt && pnpm run check`; commit `feat(plan-domain): say what each calendar's timeline
  lane holds`.

### Task 2: Reschedule opens prefilled and finishes by a date

**Files:**
- Modify: `modules/planner/src/features/reschedule/ui/RescheduleDialog.tsx`, its stories,
  `modules/planner/src/features/reschedule/index.ts`, `packages/i18n/messages/{ru,en,es}.json`

**Interfaces:**
- Produces:
  ```ts
  export type ReschedulePreset =
    | { calendar: string; mode: 'move'; days?: number | undefined }
    | { calendar: string; mode: 'rebalance'; finishBy?: string | undefined }
  // RescheduleDialog gains: preset?: ReschedulePreset | undefined
  ```
  `index.ts` exports `RescheduleDialog`, `type ReschedulePreset`, `deadlineChange`.

Behaviour: the preset sets calendar (and the Deadline field from `deadlineOf`), mode (`rebalance` only when the host
can re-balance), days (default 7), and `finishBy`. The checkbox "Fit the deadline instead" becomes a checkbox
**Finish by** with a date input beside it (both named `m.reschedule_finish_by()`); the date shows `finishBy` once set,
otherwise the day before the Deadline field. Checked (initially when the preset has `finishBy`) and with a date after
`from` − 1, the request is `{ deadline: addDays(finish, 1), target: { mode: 'deadline' } }`; the milestone step still
comes only from the Deadline field. In Move, `ready = shifting || deadlineStep !== null` and the changes are
`[deadlineStep, shifting ? shift : null]` without nulls. Remove `reschedule_fit_deadline`; add `reschedule_finish_by`
(ru `Закончить к`, en `Finish by`, es `Terminar antes del`).

- [ ] **Step 1: Write the failing stories**
  - `FitTheDeadline` → rename `FinishBy`: after typing Deadline `2027-02-16`, the Finish by date reads
    `2027-02-15`; ticking it asks `{ deadline: '2027-02-16', target: { mode: 'deadline' } }`; Apply sends the
    milestone add and the moves (as today).
  - `FinishByFromTheTimeline`: preset `{ calendar: 'hfllm', mode: 'rebalance', finishBy: '2027-02-10' }` →
    `rebalance` called with `{ calendar: 'hfllm', deadline: '2027-02-11', target: { mode: 'deadline' } }`; Apply
    sends only `[{ type: 'events.move', … }]`.
  - `MoveFromTheTimeline`: preset `{ calendar: 'hfllm', mode: 'move', days: 14 }` → Apply sends
    `[{ type: 'events.shift', calendar: 'hfllm', from: FROM, days: 14 }]`.
  - `DeadlineAlone`: choose `hfllm`, Deadline `2027-02-20`, days `0` → Apply enabled and sends only the milestone
    `event.add`.
- [ ] **Step 2:** `pnpm run stand:test` — Expected: the four stories FAIL (no preset prop / no Finish by control).
- [ ] **Step 3:** Implement as above; `pnpm run check:i18n`.
- [ ] **Step 4:** `pnpm run stand:test` — Expected: all pass in both themes.
- [ ] **Step 5:** fmt + check; commit `feat(planner): open Reschedule prefilled and finish by a chosen day`.

### Task 3: The lanes, drawn

**Files:**
- Create: `modules/planner/src/widgets/timeline-lanes/{index.ts, ui/TimelineLanes.tsx,
  ui/TimelineLanes.stories.tsx, model/use-timeline-position.ts}`
- Modify: `packages/ui/src/icons.ts` (add `ChartGantt`), i18n files

**Interfaces:**
- Consumes: Task 1 `calendarLanes`, `lanesRange`.
- Produces:
  ```ts
  export type TimelinePosition = 'below' | 'above' | 'hidden'
  export function useTimelinePosition(): readonly [TimelinePosition, (next: TimelinePosition) => void]
  // localStorage 'learning-curve:timeline'; 'below' until read and when unreadable (try/catch, as useSecondZone)
  export interface LaneEditing {
    onOpen: (calendar: string) => void
    onMove?: ((calendar: string, days: number) => void) | undefined
    onFinish?: ((calendar: string, day: string) => void) | undefined
    onDeadline?: ((calendar: string, day: string) => void) | undefined
  }
  interface Props {
    plan: Plan
    hidden: ReadonlySet<string>
    now: number | null
    position: Exclude<TimelinePosition, 'hidden'>
    onPosition: (next: TimelinePosition) => void
    edit?: LaneEditing | undefined   // Task 4 uses it; absent: read-only
  }
  export function TimelineLanes(props: Props): JSX.Element | null   // null when there are no lanes
  ```

Drawing (spec "Drawing"): section `aria-label={m.timeline_label()}`, `print:hidden`, the Runway's card look; a
header line with `m.timeline()`, a `Hint` (`help_timeline_title`, `help_timeline`) and a `Menu`
(`m.timeline_position()`) with checked rows Below / Above and a row Hide. Grid `md:grid-cols-[140px_1fr]`; on a
phone the name sits above its track. Name: `Dot` in the calendar colour, the name (truncated), `done/total` muted.
Track (`h-6`, `h-9` on a phone): bar from `first` to `last + 1 day`, tint `color-mix(in srgb, color 30%,
var(--surface))`; a 6 px mark per session (done: the colour; open: 55 % tint; missed: surface fill with a
`--today` outline); hatched spare days from `last + 1` to the deadline (the Runway's gradient); overflow from the
deadline to `last + 1` tinted `--today`; a diamond at the deadline day; a bar cut by an edge fades with a
`mask-image` gradient. One today line over all tracks (an `aria-hidden` overlay in the track column) with
`m.today()` on the axis; the axis shows the first and the last day of the range (`fmtShort`).

i18n: `timeline` (ru `Шкала курсов`, en `Timeline`, es `Cronograma`), `timeline_label`, `timeline_position`,
`timeline_below`, `timeline_above`, `timeline_hide`, `help_timeline_title`, `help_timeline`.

- [ ] **Step 1: Write the failing stories** (`now = fixtureNow`)
  - `Default`: four lanes named by their calendars; certs shows `14/40`; a today line; Menu → "Above" calls
    `onPosition('above')`, "Hide" calls `onPosition('hidden')`.
  - `HiddenCalendar`: hidden `{'pypy'}` → no Practical Python lane.
  - `MissedSession`: a past certs session not done → one mark with `data-state="missed"`.
  - `BeforeTheClock`: `now` null → lanes drawn, no today line.
  - `Phone` (viewport `mobile1`): names above their tracks, no horizontal scroll (`scrollWidth <= clientWidth`).
- [ ] **Step 2:** `pnpm run stand:test` — Expected: FAIL (no widget).
- [ ] **Step 3:** Implement the hook, the widget and the icon export; `pnpm run check:i18n`.
- [ ] **Step 4:** `pnpm run stand:test` — Expected: pass in both themes.
- [ ] **Step 5:** fmt + check; commit `feat(planner): draw each calendar's timeline as a lane`.

### Task 4: Editing the lanes

**Files:**
- Modify: `TimelineLanes.tsx`, its stories, i18n
- Create: `modules/planner/src/widgets/timeline-lanes/model/use-nudge.ts`

**Interfaces:**
- Consumes: `LaneEditing` (Task 3).
- Produces (widget-internal):
  ```ts
  interface NudgeOptions {
    daysPerPixel: () => number      // range days / track width, read at pointer down
    step: 1 | 7
    min: number; max: number        // bounds of the offset, in days
    onCommit: (offset: number) => void
  }
  function useNudge(o: NudgeOptions): {
    offset: number                  // 0 when idle
    active: boolean                 // dragging or keyed but not committed
    pointer: { onPointerDown; onPointerMove; onPointerUp; onPointerCancel }
    keys: { onKeyDown; onBlur }     // for sliders only
    tapped: () => boolean           // true once after a press that was not a drag (consumes it)
  }
  ```

Behaviour (spec "Editing"): mouse drags start after 4 px; touch arms after `LONG_PRESS = 350` ms (vibrate 8 ms, a
non-passive `touchmove` listener prevents scrolling only while armed; moving 8 px first cancels); offsets snap to
`step`; Escape (window listener while dragging) cancels; `pointercancel` cancels; a drop at offset 0 does nothing.
Keys: ←/→ ±1 day, PageDown/PageUp ±7, Home/End to `min`/`max`, Enter commits a non-zero offset, Escape and blur
revert.
- Lane body: a `button` over the bar, `aria-label={m.timeline_lane({ name, from, to, done, total })}`; click/Enter/
  Space → `onOpen` (a click right after a drag is ignored); drag with `step: 7` → `onMove(calendar, offset)`, only
  when `onMove` is given and sessions from today on exist; `min` keeps the first of them on or after today; `max`
  182. Ghost: those sessions and their bar shifted, dashed; tooltip `m.timeline_move_to({ from, to })`.
- Finish handle at `last + 1 day`, only with `onFinish` and sessions from today on: `role="slider"`, 24 × 24 hit
  area left of the boundary, `aria-label={m.timeline_finish({ name })}`, `aria-valuetext` = `fmtDay` of the day,
  `aria-describedby` → one `m.timeline_keys()` text; `step: 1`, days from `max(today, openFrom)` to the range's last
  day → `onFinish(calendar, day)`; tooltip `m.timeline_finish_by({ day })`.
- Deadline diamond, only with `onDeadline` and a deadline: the same slider with
  `m.timeline_deadline({ name })`, days from today to the range's last day, drawn above the finish handle →
  `onDeadline(calendar, day)`; tooltip `m.deadline_on({ date })`.
- `prefers-reduced-motion`: no transition on the ghost (`motion-safe:` only).

i18n: `timeline_lane`, `timeline_finish`, `timeline_deadline`, `timeline_keys`, `timeline_move_to`,
`timeline_finish_by`.

- [ ] **Step 1: Write the failing stories**
  - `OpenFromALane`: click the hfllm lane → `onOpen('hfllm')`; `onMove` not called.
  - `DragALaneByAWeek`: pointer drag the hfllm bar by 1.2 weeks of track width → `onMove('hfllm', 7)`; no `onOpen`.
  - `EscapeCancelsADrag`: drag, press Escape, release → no call.
  - `DeadlineByKeys`: certs diamond: ArrowRight ×2, Enter → `onDeadline('certs', '2027-01-01')`; then Escape after
    ArrowRight → no further call, `aria-valuetext` back to the 30 Dec text.
  - `FinishByKeys`: hfllm finish handle: PageDown, Enter → `onFinish('hfllm', '2027-02-15')`.
  - `ReadOnly`: no `edit` → no buttons or sliders in the lanes.
- [ ] **Step 2:** `pnpm run stand:test` — Expected: the new stories FAIL.
- [ ] **Step 3:** Implement `useNudge` and the three handles.
- [ ] **Step 4:** `pnpm run stand:test` — Expected: pass in both themes.
- [ ] **Step 5:** fmt + check; commit `feat(planner): move a course, its end or its deadline on its lane`.

### Task 5: The planner page

**Files:**
- Modify: `PlannerPage.tsx`, `PlannerPage.stories.tsx`, `UndoBar.tsx`, `model/build-actions.tsx`, i18n,
  `README.md`, `docs/architecture.md`

**Interfaces:**
- Consumes: Task 2 `ReschedulePreset`, `deadlineChange`; Task 3/4 `TimelineLanes`, `useTimelinePosition`,
  `LaneEditing`.
- Produces: `UndoBar` prop `action?: { label: string; run: () => void } | undefined`; `buildActions` context
  `timeline: { on: boolean; toggle: () => void }` → action `{ id: 'timeline', group: view, label:
  m.timeline_show(), menuLabel: m.timeline(), icon: ChartGantt, checked, menu: 'always' }`.

Behaviour: `shiftFrom` becomes `reschedule: { from: string; preset?: ReschedulePreset } | null`. The strip renders
above `PlannerHeader` for `above`, between the header and the Runway for `below`, nowhere for `hidden` or when
expanded. `edit` only when `canEdit` and `now` is known; `today = ymd(startOfDay(now))`.
- `onOpen(c)` → `{ from: today, preset: { calendar: c, mode: 'move' } }`.
- `onMove(c, days)` → `step = { type: 'events.shift', calendar: c, from: today, days }`;
  `previewUpdate(plan, [step])` with no `problem` and no `warnings` → `quiet.change(step)`, otherwise open the dialog
  with `{ calendar: c, mode: 'move', days }`.
- `onFinish(c, day)` (only with `rebalance`) → `{ from: today, preset: { calendar: c, mode: 'rebalance',
  finishBy: day } }`.
- `onDeadline(c, day)` → `deadlineChange(plan, c, day)`; when not null, `quiet.change` it and remember
  `{ calendar: c, day, cursor: cursor + 1 }`. While that cursor is current and the Undo bar shows the step, it gets
  `action: { label: m.timeline_rebalance_to_deadline(), run }` (only with `rebalance`), `run` opening the dialog
  with `{ mode: 'rebalance', finishBy: addDays(day, -1) }`.

i18n: `timeline_show`, `timeline_rebalance_to_deadline`. README: a "Timeline" bullet beside Reschedule; architecture:
the `timeline-lanes` widget.

- [ ] **Step 1: Write the failing stories** (PlannerPage `Host`)
  - `TimelineBelowTheHeader`: the timeline section follows the header in document order.
  - `TimelineHiddenAndBack`: the strip's Menu → Hide removes it; the ⋮ menu's "Timeline" switch brings it back.
  - `DeadlineFromTheTimeline`: certs diamond ArrowRight, Enter → the Undo bar shows "Re-balance to it"; clicking it
    opens Reschedule in Re-balance with Finish by `2026-12-30`.
  - `ShiftOntoAnotherEventAsks`: a plan with an event right after an open session one week later; drag that lane a
    week → Reschedule opens with the warning; `onChange` not called.
- [ ] **Step 2:** `pnpm run stand:test` — Expected: the new stories FAIL.
- [ ] **Step 3:** Implement; `pnpm run check:i18n`.
- [ ] **Step 4:** `pnpm run stand:test`, `pnpm run test`, `pnpm run build` — Expected: all pass.
- [ ] **Step 5:** fmt + check; commit `feat(planner): show the timeline lanes on the planner and edit from them`,
  with the spec, the plan and `docs/calendar-timeline-research.md` in a first `docs:` commit of this task.
