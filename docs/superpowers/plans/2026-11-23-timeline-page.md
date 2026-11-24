# Timeline page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/timeline` page where courses are edited on their lanes as a draft that shows before and after, applied in one go.

**Architecture:** `plan-domain` compares lanes before and after an update (pure). The `timeline-lanes` widget becomes a
chart with zoom, an axis, a baseline under changed lanes and richer drag tips. A new page `pages/timeline` keeps the
draft (entries per course → `PlanChange[]` → `previewUpdate`), a selection panel, a draft bar and a review dialog, and
applies with `changeAll`. The app adds the route and the nav tab; the planner loses the strip.

**Tech Stack:** React 19, TanStack Start/Router, Tailwind 4, Paraglide, Vitest (plan-domain), Storybook stories as tests.

**Spec:** `docs/superpowers/specs/2026-11-23-timeline-page-design.md`

## Global Constraints

- Every UI string in `packages/i18n/messages/{ru,en,es}.json`, called as `m.key()`; `pnpm run check:i18n` passes.
- No `any`, `as`, `!`; `exactOptionalPropertyTypes`; comments only for why.
- Modules never import each other, `@lc/plan-data`, `node:*` or server functions; inside a package imports are relative.
- Dates: Minsk wall-clock helpers from `@lc/plan-domain` (`parseLocal`, `ymd`, `addDays`, `startOfDay`, `mondayOf`, `DAY`).
- Pages with header actions use the sticky `PageHeader` from `@lc/ui`.
- Nothing on the timeline page stores a change before Apply; Apply uses `changeAll`, Undo uses `onTravel`.
- Before each commit: `pnpm run fmt && pnpm run check`; UI tasks also `pnpm run stand:test`; commits are Conventional.
- Never stage `packages/plan-data/data/edits.json` or `plan.json`.

## Review Focus

1. A re-balance answer that arrives after the draft changed again must not overwrite the newer draft.
2. Apply while a re-balance is still being worked out, or with a failed entry, must be impossible.
3. Two courses changed in one draft: the second is worked out on the plan the first makes (no stale overlap).
4. A drop on the page must never call `onChangeAll`; only Apply does, once.
5. Phone (390 px): the page does not scroll sideways outside the chart's own scroller; the panel is reachable.

---

### Task 1: Compare lanes before and after

**Files:** Modify `packages/plan-domain/src/lanes.ts`, `packages/plan-domain/src/index.ts`; Test `packages/plan-domain/src/lanes.test.ts`

**Interfaces — Produces:**
- `laneSpare(lane: CalendarLane): number | null` — days from the day after the last session to the deadline;
  negative when the course ends after it; null without a deadline.
- `movedSessions(diff: PlanDiff): Set<string>` — uids of sessions whose `start` or `end` changed.
- `interface LaneChange { calendar: string; before: CalendarLane; after: CalendarLane; moved: number; startDays: number; endDays: number }`
- `compareLanes(before: CalendarLane[], after: CalendarLane[], moved: ReadonlySet<string>): Map<string, LaneChange>`
  — only calendars on both sides whose first/last day, deadline or moved count differ.

- [ ] Tests: "a course moved two weeks: its open sessions move and both ends move 14 days" (fixture, `events.shift`
  certs from the fixture day, 14 → `moved` = open certs sessions, `startDays` 0 when the first session is done,
  `endDays` 14); "a moved deadline changes only the deadline and the spare days" (`laneSpare` before 6, after 13 for
  certs moved 2026-12-30 → 2027-01-06); "lanes that do not change are left out"; "marking a session done moves nothing".
- [ ] Run `cd packages/plan-domain && pnpm exec vitest run src/lanes.test.ts` → FAIL (not exported).
- [ ] Implement; run → PASS; commit `feat(plan-domain): compare timeline lanes before and after an update`.

### Task 2: The chart

**Files:** in `modules/planner/src/widgets/timeline-lanes/`: Create `ui/TimelineChart.tsx`, `ui/TimelineAxis.tsx`,
`model/use-zoom.ts`; Modify `ui/LaneRow.tsx`, `ui/LaneHandles.tsx`, `model/editing.ts`, `index.ts`; Delete
`ui/TimelineLanes.tsx`, `model/use-timeline-position.ts`; Stories `ui/TimelineChart.stories.tsx` (replaces
`TimelineLanes.stories.tsx`, keeping its drag/keys/touch stories).

**Interfaces — Produces:**
- `type TimelineZoom = 'fit' | 'month' | 'week'` (px a day: fit = width / days, month 14, week 40); `useZoom()` →
  `[zoom, setZoom]`, stored under `learning-curve:timeline-zoom` (default `fit`, read in an effect, try/catch).
- `LaneEditing { onSelect(calendar); onMove?(calendar, days); onFinish?(calendar, day); onDeadline?(calendar, day) }`
  (`onOpen` becomes `onSelect`).
- `TimelineChart({ lanes, changes, range, now, selected?, working?, edit?, label })` where `changes:
  ReadonlyMap<string, LaneChange>` from Task 1, `range` from `lanesRange` over the lanes before and after, `working`
  the calendars whose re-balance is being worked out. It owns its toolbar (zoom segmented control, Today, "Show the
  plan before" toggle while `changes.size`), the axis, the lanes and the legend.

- [ ] Stories first (RED), on `fixturePlan` and `previewUpdate` for the changed state: `Default` (four lanes, axis
  shows month names, legend lists done/ahead/missed/deadline/spare/before); `Zoomed` (week zoom: track wider than the
  scroller, Today scrolls today into view); `ChangedLane` (a lane in `changes` draws `[data-before]` and its moved
  sessions `[data-moved]`, a delta chip "+14"; toggling "Show the plan before" hides `[data-before]`);
  `MoveTipSaysTheResult` (dragging certs a week shows the new dates and, past the deadline, the late days);
  `FinishTipCountsSessions`; `DeadlineTipSaysSpare`; `SelectALane` (click → `onSelect('hfllm')`, `aria-pressed` on
  the selected lane); `WorkingLane` (`aria-busy` on a working lane); `Narrow` (320 px, no sideways page scroll);
  the kept drag stories (`DragALaneByAWeek`, `ADropActsAfterItsClick`, `EscapeCancelsADrag`, `DeadlineByKeys`,
  `FinishByKeys`, `KeysDuringAHandleDrag`, `SecondFinger`, `LastCourseEndsLater`, `ReadOnly`).
- [ ] `cd apps/stand && pnpm exec vitest run TimelineChart` → FAIL; implement; → PASS.
- [ ] `pnpm run fmt && pnpm run check && pnpm run stand:test`; commit `feat(planner): draw the timeline as a zoomable chart that shows a change against the plan before it`.
  In this task `PlannerPage` stops rendering the strip: `useTimelineEdit`, `useTimelinePosition`, the `timeline`
  menu action, `UndoBar`'s `action` and the planner's timeline stories go (their behaviour moves to Task 3's stories).

### Task 3: The timeline page

**Files:** Create in `modules/planner/src/pages/timeline/`: `index.ts`, `model/use-timeline-draft.ts`,
`ui/TimelinePage.tsx`, `ui/CoursePanel.tsx`, `ui/DraftBar.tsx`, `ui/DraftReview.tsx`, `ui/TimelinePage.stories.tsx`;
Modify `modules/planner/src/index.ts`; Modify `features/reschedule` to export `finishByRequest`.

**Interfaces:**
- Consumes: Task 1, Task 2, `previewUpdate`, `deadlineChange`, `rebalanceChange`, `defaultStudyHours`,
  `RescheduleDialog` + `ReschedulePreset`, `PlanDiffList`, `RuleWarningList`.
- Produces: `finishByRequest(plan, calendar, from, finishBy): RebalanceRequest` (target deadline, `deadline =
  finishBy + 1`, default hours, `overBudget: false`) in `features/reschedule/model`, used by the dialog too.
- `useTimelineDraft({ plan, today, rebalance })` → `{ courses: Map<calendar, CourseEdit>, set(calendar, edit |
  null), discard(), changes: PlanChange[], preview: UpdatePreview | null, working: Set<string>, failed: Map<string,
  string>, ready: boolean }` with `CourseEdit = { move?: number; finishBy?: string; deadline?: string }` (move and
  finishBy exclusive). Changes are worked out course by course in the order first edited, each on the plan the earlier
  ones make; only the answer to the newest draft is kept.
- `TimelinePage({ state, onChangeAll, onTravel, rebalance?, headerAside? })`, `state: PlannerState`.

- [ ] Stories first (RED) with `fn()` hosts and a fake `rebalance` returning a fixed result: `Default`;
  `DragMakesADraft` (drag certs a week → draft bar "1 course · N sessions", baseline drawn, `onChangeAll` not called);
  `ApplyStoresTheDraft` (→ `onChangeAll([{ type: 'events.shift', calendar: 'certs', from, days: 7 }])` once, then the
  applied bar with Undo → `onTravel(cursor - 1)`); `DiscardDropsTheDraft`; `FinishByAsksTheSolver` (end dragged →
  `rebalance` called with `finishByRequest(...)`, Apply disabled until it answers, then stores `rebalanceChange`);
  `AFailedRebalanceBlocksApply` (rebalance rejects → message on the panel, Apply disabled, Reset clears it);
  `StaleAnswerIsDropped` (two finish drags, the first answer resolved last → the draft keeps the second);
  `TwoCoursesInOrder` (deadline of certs and a move of hfllm → `changes` in that order, preview warnings listed in the
  review); `PanelEditsWithoutDragging` (select a lane, + week, deadline date, finish by deadline → draft changes);
  `ReviewListsEveryChange`; `ReadOnly` (no handles, no panel edits); `NoCourses` (empty state); `Phone` (390 px).
- [ ] Run → FAIL; implement; → PASS; check, stand:test; commit `feat(planner): a timeline page that drafts course changes and shows them before applying`.

### Task 4: Route, navigation, planner cleanup, docs

**Files:** Create `apps/web/src/routes/timeline.tsx`; Modify `apps/web/src/shell/ShellAside.tsx`,
`apps/web/src/routes/index.tsx` (command), i18n (remove keys nothing uses any more), `README.md`,
`docs/architecture.md`, spec "Calls made" if anything changed.

- [ ] Route loads `getPlanState()`, wires `savePlanChanges`, `travelPlanHistory`, `rebalancePlan`, `router.invalidate()`;
  `head` title `m.timeline()`. Nav tab and command `timeline`.
- [ ] `pnpm run fmt && pnpm run check && pnpm run test && pnpm run stand:test && pnpm run build`.
- [ ] Real browser (dev server, saves intercepted): drag a lane → draft; review; discard; screenshots desk/phone/dark.
- [ ] Commit `feat(web): open the timeline from the navigation`.
