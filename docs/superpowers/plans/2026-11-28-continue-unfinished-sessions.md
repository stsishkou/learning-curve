# Continuing an Unfinished Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record later sittings of a planned session (booked ahead or continued now), link them to it, and show
them together: a progress strip on each sitting, a thread through the week, and an "Unfinished" row.

**Architecture:** Every sitting carries `from` = the root session's uid, the link split parts already use. A new
`session.continue` change adds a linked sitting; groups, their bar and the default rest are derived in
`@lc/plan-domain` (`core/sitting-state.ts`, `core/sittings.ts`) and read by the planner module's views. The pace pools
a finished group into one sample.

**Tech Stack:** TypeScript 7 (strict), React 19, Vitest, Storybook stories as browser tests (`apps/stand`),
Paraglide i18n.

**Spec:** `docs/superpowers/specs/2026-11-28-continue-unfinished-sessions-design.md`

## Global Constraints

- Every edit is a `PlanChange` handled by `applyChange`; the protocol's schema, guide and `parseChange` change
  together and `pnpm run test` catches their drift.
- Modules get plan data and callbacks as props; they never import `@lc/plan-service`, `@lc/plan-data/*` or `node:*`.
- UI text in `ru`, `en`, `es` through Paraglide (`m.key()`, every key in all three `packages/i18n/messages/*.json`,
  then `pnpm run check:i18n`); plan content stays Russian. Counts are phrased the way existing messages do, without
  plural forms ("частей: {count}").
- Times are Europe/Minsk wall-clock strings read with the `@lc/plan-domain` date helpers, never `new Date(local)`.
- Strict types: no `any`, `as` or `!`; `exactOptionalPropertyTypes` holds.
- An ordinary session, never split nor continued, must look exactly as today: no strip, no mark, no row.
- No new file and no new shape in `edits.json`: a sitting is an added event with `from`.
- `from` stays app-written: never accepted from an update's `event.add` or `event.patch`.
- Comments only say why. Conventional Commits, body lines ≤ 100. Never stage `packages/plan-data/data/edits.json`
  or `plan.json`; never push; never run `pnpm run plan` or a server against the live data directory.
- Each task ends green on `pnpm run check` (typecheck, Oxlint, Steiger, i18n, Oxfmt; `pnpm run fmt` formats) and on
  the tests it names.

## Review Focus

- A group whose root is in the trash: views and the row still work, the first plan comes from the earliest sitting
  (Task 1 test `a group whose root is in the trash`).
- "Continue now" late in the evening: the sitting ends at the next 00:00, never later (Task 2 test
  `continueAt cuts the sitting at midnight`).
- A group whose booked sitting was missed: "Continue now" moves that sitting instead of adding one (Task 2 test
  `continueAt moves the booked sitting, a missed one too`).
- Hidden calendars: their open groups stay out of the row, as they stay out of the Backlog and the Focus queue
  (Task 1 test `openGroups leaves hidden calendars out`).
- A read-only host: the row shows its chips without actions (Task 8 story `ReadOnly`).

---

### Task 1: Sitting groups, their bar and the rest (domain)

**Files:**
- Create: `packages/plan-domain/src/core/sitting-state.ts`, `packages/plan-domain/src/core/sittings.ts`
- Test: `packages/plan-domain/src/core/sittings.test.ts`
- Modify: `packages/plan-domain/src/core/index.ts` (export the new names),
  `modules/planner/src/pages/focus/model/finish.ts` (remove `likelyLength`),
  `modules/planner/src/pages/focus/model/finish.test.ts` (its `likelyLength` cases move to `sittings.test.ts`),
  `modules/planner/src/pages/focus/ui/FocusPage.tsx` (import `likelyLength` from `@lc/plan-domain`)

**Interfaces:**
- Produces, in `sitting-state.ts` (a leaf: it imports only `./types` and `./dates`, so `accuracy.ts` and `changes.ts`
  can use it without a cycle):
  - `groupKey(e: PlanEvent): string` = `e.from ?? e.uid`
  - `type GroupState = 'planned' | 'open' | 'finished'`
  - `groupState(sittings: readonly PlanEvent[]): GroupState` (sittings in start order)
  - `firstPlanOf(sittings: readonly PlanEvent[], key: string): number`, minutes
  - `isLinked(sittings: readonly PlanEvent[]): boolean`
  - `doneMinutesOf(e: PlanEvent): number`: `0` when not done or skipped, else `actual` ?? planned length
- Produces, in `sittings.ts`:
  - `interface SessionGroup { key: string; calendar: string; title: string; sittings: PlanEvent[]; firstPlan: number;
    doneMinutes: number; bookedMinutes: number; state: GroupState; next: PlanEvent | null; linked: boolean }`
  - `sittingGroups(plan: Plan): SessionGroup[]`, `groupOf(plan: Plan, uid: string): SessionGroup | null`
  - `openGroups(plan: Plan, hidden: ReadonlySet<string>): SessionGroup[]`
  - `interface BarSegment { kind: 'done' | 'booked' | 'rest'; minutes: number; uid: string | null }`
  - `interface GroupBar { total: number; segments: BarSegment[]; tick: number | null }`, `groupBar(group): GroupBar`
  - `likelyLength(planned: number, ratio: number): number` (ms in, ms out: moved unchanged from `finish.ts`)
  - `restMinutes(group: SessionGroup, ratio: number): number`
  - `sittingAt(plan: Plan, key: string, start: string): PlanEvent | null`

Rules the tests pin (from the spec, "The group" and "The bar"):
- Only session events (`isSession`) form groups. Key `from ?? uid`; the root is the event whose uid is the key.
  `calendar`, `title` and `firstPlan` come from the root, or from the earliest sitting when the root is not in the
  plan. `firstPlan` = root `estimate` ?? root length, in minutes.
- A skipped sitting counts as done for the state and adds 0 minutes.
- `state`: `planned` when no sitting is done; `finished` when every sitting is done and the latest done one is not
  `unfinished`; `open` otherwise. `next`: the earliest sitting not done, past or future. `linked`: two sittings or
  more, or one done sitting marked `unfinished`.
- `openGroups`: `state === 'open'`, calendar not in `hidden`, most recently worked first (the latest done sitting's
  `began ?? start`, descending).
- `groupBar`: done sittings (minutes > 0) then booked ones, in start order, each with its uid; then a `rest`
  segment (`uid: null`) of `firstPlan − done − booked` when the group is open and that is above 0. `total` =
  `max(firstPlan, done + booked)`; `tick` = `firstPlan` when `done + booked > firstPlan`, else `null`.
- `restMinutes`: `likelyLength(firstPlan min, ratio)` in minutes `− doneMinutes − bookedMinutes`, rounded to 5,
  at least 15.

- [ ] **Step 1: Write the failing tests** in `sittings.test.ts`, building plans from `fixtureBase` with
  `applyEdits` and hand-written added events (`from` set) the way `changes.test.ts` builds them:

```ts
test('a session never split nor continued is a group of one, not linked', () => {
  const group = groupOf(plan, SESSION)
  expect(group).toMatchObject({ key: SESSION, state: 'planned', linked: false, firstPlan: 60, next: { uid: SESSION } })
})
test('three sittings: 25 done and unfinished, 20 done, 15 booked', () => {
  // root 60 min done actual 25 unfinished; sitting 2 done actual 20; sitting 3 booked 15 min
  expect(groupOf(plan, ROOT)).toMatchObject({ state: 'open', linked: true, doneMinutes: 45, bookedMinutes: 15, firstPlan: 60 })
  expect(groupOf(plan, SITTING_2)?.key).toBe(ROOT)
  expect(groupBar(group).segments.map((s) => [s.kind, s.minutes])).toEqual([['done', 25], ['done', 20], ['booked', 15]])
  expect(groupBar(group)).toMatchObject({ total: 60, tick: null })
})
test('a lone session marked unfinished is linked and open, with the rest of the plan empty', () => {
  // done actual 25 unfinished, nothing booked
  expect(groupBar(group).segments).toEqual([{ kind: 'done', minutes: 25, uid: ROOT }, { kind: 'rest', minutes: 35, uid: null }])
})
test('past the first plan the bar grows and the tick marks the plan', () => {
  // done 25 + 40, booked 20, first plan 60
  expect(groupBar(group)).toMatchObject({ total: 85, tick: 60 })
})
test('every sitting done and the last not unfinished: finished', () => {})
test('a skipped sitting is done for the state and adds nothing', () => {})
test('a group whose root is in the trash takes the first plan from its earliest sitting', () => {})
test('split parts form a planned group whose parts add up to the first plan', () => {
  // event.split of a 60-min session into 30 + 30: firstPlan 60 from the first part's estimate, bar total 60
})
test('openGroups leaves hidden calendars out and lists the latest worked first', () => {})
test('restMinutes is what is left of the likely length, rounded to 5, at least 15', () => {
  expect(restMinutes(groupWith({ firstPlan: 60, done: 25 }), 1)).toBe(35)
  expect(restMinutes(groupWith({ firstPlan: 60, done: 25 }), 1.25)).toBe(50)
  expect(restMinutes(groupWith({ firstPlan: 60, done: 23 }), 1)).toBe(35)
  expect(restMinutes(groupWith({ firstPlan: 60, done: 60 }), 1)).toBe(15)
})
test('likelyLength rounds the plan times the ratio to 5 minutes', () => {
  expect(likelyLength(60 * MINUTE, 1.25)).toBe(75 * MINUTE)
  expect(likelyLength(60 * MINUTE, 1.22)).toBe(75 * MINUTE)
  expect(likelyLength(120 * MINUTE, 0.83)).toBe(100 * MINUTE)
})
test('sittingAt finds the not-done sitting of a group by its start', () => {})
```

The empty bodies above are for the implementer to fill with the fixture they build; each must assert the rule its
name states.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec nx run @lc/plan-domain:test -- sittings`
Expected: FAIL, the module `./sittings` does not exist.

- [ ] **Step 3: Implement `sitting-state.ts` and `sittings.ts`** with the signatures above; move `likelyLength` and
  its doc comment out of `finish.ts`, re-point `FocusPage.tsx` and drop its cases from `finish.test.ts`.

- [ ] **Step 4: Run the tests and the check**

Run: `pnpm exec nx run @lc/plan-domain:test && pnpm exec nx run @lc/planner:test && pnpm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plan-domain/src/core modules/planner/src/pages/focus
git commit -m "feat(plan-domain): group the sittings of a session and measure them"
```

---

### Task 2: The `session.continue` change

**Files:**
- Modify: `packages/plan-domain/src/core/changes.ts` (type, `parseChange`, `applyChange`, `continueProblem`),
  `packages/plan-domain/src/core/history.ts` (`subjectOf`), `packages/plan-domain/src/core/sittings.ts`
  (`bookRest`, `continueAt`), `modules/planner/src/features/history/model/describe-step.ts`,
  `packages/i18n/messages/{ru,en,es}.json` (`history_continued`)
- Test: `packages/plan-domain/src/core/changes.test.ts` (an `EXAMPLES` entry and a `describe('session.continue')`),
  `packages/plan-domain/src/core/sittings.test.ts`

**Interfaces:**
- Consumes: Task 1's `groupKey`, `SessionGroup`, `restMinutes`.
- Produces:
  - `PlanChange` member `{ type: 'session.continue'; uid: string; start: string; end: string }`, with a TSDoc line
    in the union's style: "Adds another sitting of the session `uid` belongs to, linked to it, and marks its latest
    done sitting unfinished".
  - `continueProblem(event: PlanEvent): string | null`, exported next to `splitProblem`.
  - `interface ContinueOffer { change: PlanChange; start: string; uid: string | null }` (`uid`: the sitting the
    change moves; `null` when it adds one, found later with `sittingAt(plan, group.key, start)`).
  - `bookRest(plan: Plan, group: SessionGroup, options: { now: number; ratio: number; busy?: BusyBlock[] | undefined }): ContinueOffer | null`
  - `continueAt(group: SessionGroup, at: number, minutes: number): ContinueOffer`

Rules the tests pin (spec, "The new change" and "Where sittings are made"):
- Apply: the event must exist (`Unknown event "<uid>"`) and pass `continueProblem` (a repeat, an all-day event, a
  non-session (`!isSession`) each fail with words a model can act on); the end after the start; the end no later
  than 00:00 after the start's day ("A sitting ends by midnight: book the rest on another day").
- The added event takes `calendar`, `title`, `description`, `availability`, `kind` from the root (the event itself
  when the root is not in the plan), `start`, `end`, `from: groupKey(event)` and a new `custom-…@learning-curve`
  uid; nothing else (no `done`, `actual`, `estimate` …).
- In the same step the group's latest done sitting gets `unfinished: true` through `event.patch` when it lacks it.
- `bookRest`: `null` when `group.next` is set (one booked sitting at a time) or no slot is free; else
  `nextFreeSlot(plan, { from: max(now, end of the latest sitting), length: restMinutes(group, ratio) min,
  preferHour: the root's start hour, busy })` wrapped as `session.continue` on the latest sitting's uid.
- `continueAt`: `at` floored to the minute is the start; with `group.next` it is `event.patch` of `next` to
  `start`–`start + its length`; otherwise `session.continue` for `minutes`; either end is cut at the next 00:00.
- History: `subjectOf` names the event's title; `describeStep` says `m.history_continued({ name, time })` with
  `time` = `fmtShort(day) hh:mm–hh:mm`. English: "Booked another sitting of {name}, {time}".

- [ ] **Step 1: Write the failing tests**

```ts
// changes.test.ts
'session.continue': { type: 'session.continue', uid: SESSION, start: '2026-11-26T18:00', end: '2026-11-26T18:35' },

describe('session.continue', () => {
  test('adds a sitting linked to the session and marks the latest done sitting unfinished', () => {
    const edits = apply([{ type: 'session.finish', uid: SESSION, actual: 25, began: '2026-11-23T12:00', paused: 0 }, EXAMPLES['session.continue']])
    expect(added(edits)).toMatchObject({ from: SESSION, start: '2026-11-26T18:00', end: '2026-11-26T18:35', kind: 'study' })
    expect(added(edits)).not.toHaveProperty('done')
    expect(find(planOf(edits), SESSION)?.unfinished).toBe(true)
  })
  test('a sitting continued from a sitting links to the root', () => {})
  test('may end at the next midnight and not later', () => {
    expect(() => apply([{ type: 'session.continue', uid: SESSION, start: '2026-11-26T23:40', end: '2026-11-27T00:00' }])).not.toThrow()
    expect(() => apply([{ type: 'session.continue', uid: SESSION, start: '2026-11-26T23:40', end: '2026-11-27T00:15' }])).toThrow(/midnight/)
  })
  test('a repeat, an all-day event and a free event cannot be continued', () => {})
  test('an unknown uid and an end before the start are refused', () => {})
})

// sittings.test.ts
test('bookRest books what is left after the latest sitting, linked to it', () => {})
test('bookRest offers nothing while a sitting is booked', () => {})
test('continueAt adds a sitting from now when nothing is booked', () => {
  // at 2026-11-26 18:07:40 wall ms, 35 min → session.continue 18:07–18:42, uid null
})
test('continueAt moves the booked sitting, a missed one too', () => {
  // next booked 2026-11-24 16:00–16:15 (past) → event.patch of next to 18:07–18:22, uid next.uid
})
test('continueAt cuts the sitting at midnight', () => {
  // at 23:40 with 35 min → end '…T00:00' of the next day
})
```

The `EXAMPLES` entry makes the existing round-trip and apply tests cover the new kind.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec nx run @lc/plan-domain:test`
Expected: FAIL (type error on the `EXAMPLES` key, then the new tests).

- [ ] **Step 3: Implement** the change in `changes.ts` (parse with `LOCAL_TIME`; apply as `event.split` does, a patch
  through `applyChange` then a push onto `added`), `continueProblem`, `subjectOf`, `bookRest`, `continueAt`,
  `describeStep` and `history_continued` in the three languages.

- [ ] **Step 4: Run the tests and the check**

Run: `pnpm exec nx run @lc/plan-domain:test && pnpm run check:i18n && pnpm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(plan-domain): add another linked sitting of a session"
```

---

### Task 3: The protocol learns `session.continue`

**Files:**
- Modify: `packages/plan-domain/src/protocol/schema.ts` (a `change('session.continue', …)` entry, the type in
  `UPDATE_CHANGE_TYPES`, the `from` description), `packages/plan-domain/src/protocol/guide.ts` (a row in the change
  table, a sittings rule, a recipe line)
- Test: `packages/plan-domain/src/protocol/schema.test.ts`

**Interfaces:**
- Consumes: Task 2's change and its failure texts.

Copy the schema and guide carry (spec, "The new change"):
- Schema description: "Adds another sitting of a session whose goal was not met: an event linked to it (`from`),
  with its title, calendar and notes, at `start`–`end`; the session's latest done sitting is marked unfinished. A
  sitting ends by the midnight after its start. `uid` is any sitting of the session."
- `from` description: "The `uid` of the session this one continues or was split from. Kept by the app: read it,
  never send it."
- Guide, the change table: `` `session.continue` | Adds another sitting of the session `uid` at `start`–`end`, linked
  to it; its latest done sitting is marked unfinished ``.
- Guide, a rule after rule 3: rule 3's "1 hour, on the hour or the half hour" is for sessions planned ahead and does
  not bind a sitting; a sitting is in 5-minute steps, usually at least 15 minutes, and its length is the first plan
  (the root's `estimate`, or its length) minus the done sittings' `actual`, scaled by the course's pace from
  `get_accuracy`; it ends by midnight.
- Guide, the recipes (next to "A session too long for one sitting"): "The goal of a session was not met:
  `session.continue` with the slot of the next sitting."

- [ ] **Step 1: Write the failing tests** in `schema.test.ts`: the guide holds a `session.continue` example that
  fits the schema, parses and applies (the existing examples test covers it once the guide has one); a bad update
  with `session.continue` lacking `end` and one with `from` inside `event.add` are both refused by the schema and by
  `parseUpdate`.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec nx run @lc/plan-domain:test -- schema`
Expected: FAIL.

- [ ] **Step 3: Implement** the schema entry, the list entry and the guide text above.

- [ ] **Step 4: Run the tests and the check**

Run: `pnpm exec nx run @lc/plan-domain:test && pnpm exec nx run @lc/mcp:test && pnpm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(plan-domain): let updates continue a session"
```

---

### Task 4: A spread session counts once in the pace

**Files:**
- Modify: `packages/plan-domain/src/core/accuracy.ts`, `packages/plan-domain/src/core/progress.ts`
  (`referenceClass`), `packages/plan-domain/src/core/goals.ts` (`weekReview`)
- Test: `packages/plan-domain/src/core/accuracy.test.ts`

**Interfaces:**
- Consumes: Task 1's `sitting-state.ts`.
- Produces:
  - `paceSessions(sessions: readonly PlanEvent[], all: readonly PlanEvent[] = sessions): PlanEvent[]`
  - `accuracyOf(sessions, all = sessions)` and `runningTypical(sessions, all = sessions)`: both read
    `paceSessions(sessions, all)`; callers that pass one calendar or one kind keep the default.

Rules (spec, "Counting"):
- Groups are found in `all` by `groupKey`. A group that is not linked passes through unchanged. A linked group that
  is not `finished` is dropped whole. A finished linked group becomes one event, emitted only when its latest done
  sitting is in `sessions`: that sitting with `uid` = the key, `end` = its `start` + `firstPlan`, `actual` = the sum
  of its done sittings' `actual` when every worked sitting has one (otherwise no `actual`: done without time), and
  `skipped: true` only when every done sitting was skipped.
- `referenceClass(plan, event)` leaves out every event of `event`'s group and passes `plan.events` as `all`.
- `weekReview` passes `plan.events` as `all`, so a group is whole when its sittings span weeks.

- [ ] **Step 1: Write the failing tests**

```ts
test('a finished group of 25 + 20 + 15 minutes on a 60-minute plan is one session at ×1', () => {
  expect(paceSessions(sittings)).toEqual([expect.objectContaining({ uid: ROOT, actual: 60, done: true })])
  expect(accuracyOf([...sittings, ...fiveOthersAtX1]).typical?.ratio).toBeCloseTo(1)
})
test('an open group, a lone unfinished session included, is left out', () => {})
test('a session never linked counts as before', () => {})
test('a group counts in the week of its latest sitting', () => {})
test('referenceClass leaves out the whole group of the session in hand', () => {})
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec nx run @lc/plan-domain:test -- accuracy`
Expected: FAIL.

- [ ] **Step 3: Implement** `paceSessions` and the two optional parameters; update `referenceClass` and
  `weekReview`.

- [ ] **Step 4: Run every test that reads the pace**

Run: `pnpm run test && pnpm run check`
Expected: PASS (dashboard and insights tests included).

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(plan-domain): count a session spread over sittings once in the pace"
```

---

### Task 5: The sitting bar and part mark (shared UI)

**Files:**
- Create: `modules/planner/src/shared/ui/SittingBar.tsx`, `modules/planner/src/shared/ui/SittingBar.stories.tsx`
- Modify: `modules/planner/src/shared/ui/index.ts`, `packages/i18n/messages/{ru,en,es}.json`

**Interfaces:**
- Consumes: Task 1's `GroupBar`, `BarSegment`, `SessionGroup`.
- Produces:
  - `SittingBar({ bar, current, size }: { bar: GroupBar; current?: string | undefined; size: 'strip' | 'bar' })`:
    one flex row, each segment `flex-grow: minutes`; `done` filled with the calendar colour (`var(--c)` at 55 %,
    the `current` uid's segment at 100 %), `booked` hatched, `rest` an empty outline; when `tick` is set, a tick at
    `tick / total` and the existing overrun hatching over `[tick, total]`. `strip` is 4 px tall with no radius,
    `bar` 6 px with a radius. `role="img"` with `aria-label` from `sittingLabel`.
  - `PartMark({ index, count }: { index: number; count: number })`: the `Link2` icon from `@lc/ui` (already
    exported) and `m.sitting_part({ index, count })`.
  - `sittingLabel(group: SessionGroup): string`: `m.sitting_progress({ done, total })`, plus
    `m.sitting_over({ minutes })` with `doneMinutes − firstPlan` when the done minutes pass the first plan.
- Messages (en): `sitting_part` "Part {index} of {count}", `sitting_progress` "{done} of {total} min",
  `sitting_over` "{minutes} min over the plan".

- [ ] **Step 1: Write the stories** `Open` (25 done, 20 done, 15 booked; current = the second), `LoneUnfinished`
  (25 done, 35 rest), `OverPlan` (25 + 40 done, 20 booked, tick at 60), `Strip` (the `Open` bar as a strip), each
  with a `play` that finds the `img` by its label (`"45 of 60 min"`, `"65 of 85 min, 5 min over the plan"` in en).

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --dir apps/stand exec vitest run SittingBar`
Expected: FAIL, the component does not exist.

- [ ] **Step 3: Implement** the component, `PartMark`, `sittingLabel` and the messages in three languages.

- [ ] **Step 4: Run the stories and the check**

Run: `pnpm --dir apps/stand exec vitest run SittingBar && pnpm run check`
Expected: PASS in both themes (`pnpm run stand:test` runs light and dark; run it once here).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(planner): draw the sittings of a session as one bar"
```

---

### Task 6: Week and day grid: the strip and the thread

**Files:**
- Create: `modules/planner/src/widgets/week-grid/ui/SittingThread.tsx`,
  `modules/planner/src/widgets/week-grid/model/thread.ts`, `modules/planner/src/widgets/week-grid/model/thread.test.ts`
- Modify: `modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx`,
  `modules/planner/src/widgets/week-grid/ui/WeekGrid.stories.tsx`, `packages/i18n/messages/{ru,en,es}.json`

**Interfaces:**
- Consumes: Task 1's `sittingGroups`, `groupBar`; Task 5's `SittingBar`, `PartMark`.
- Produces: `threadPoints(group: SessionGroup, shown: { from: number; to: number }): { inside: PlanEvent[];
  before: number; after: number }` in `model/thread.ts` (the group's sittings inside the shown days in start order,
  and how many fall before and after).

Behaviour (spec, "What the views show", A and B):
- For every occurrence of a linked group: `SittingBar` with `size="strip"` across the top (`current` = its uid) and
  `PartMark` where the repeat icon goes; the title keeps room for it. The bottom "now" bar keeps its place.
- The thread shows for the group of the hovered occurrence, else of `selectedKey`'s occurrence, when that group is
  linked: an SVG overlay above the events with a dashed line in the calendar colour through the `inside` sittings
  in start order, a numbered marker (1-based index in the whole group) at each, the group's other occurrences
  outlined, every other event at 35 % opacity, and at the left or right edge a marker
  `m.sitting_earlier({ count })` / `m.sitting_later({ count })` when `before` / `after` > 0. It follows lanes and
  scrolling; under reduced motion it appears without animation. Keyboard focus on an event counts as hover.
- Messages (en): `sitting_earlier` "Earlier: {count}", `sitting_later` "Later: {count}".

- [ ] **Step 1: Write the failing test and stories**
  - `thread.test.ts`: `threadPoints` of a three-sitting group over a week holding the second and third gives
    `inside` of two in order, `before: 1`, `after: 0`.
  - Stories: `SittingsLinked` (the spec's example: strips and part marks, an ordinary session unchanged),
    `SittingsThread` (a selected sitting: its sisters outlined, others faded, markers 1–3, the play asserts the
    outlines and that an unrelated event has no strip), `SittingsAcrossWeeks` (the "Earlier: 1" marker).

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec nx run @lc/planner:test -- thread && pnpm --dir apps/stand exec vitest run WeekGrid`
Expected: FAIL.

- [ ] **Step 3: Implement** `threadPoints`, `SittingThread` and the grid changes.

- [ ] **Step 4: Run the tests, the stories and the check**

Run: `pnpm exec nx run @lc/planner:test && pnpm --dir apps/stand exec vitest run WeekGrid && pnpm run check`
Expected: PASS; the existing WeekGrid stories pass unchanged.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(planner): link the sittings of a session in the week grid"
```

---

### Task 7: Month grid and list view marks

**Files:**
- Modify: `modules/planner/src/widgets/month-grid/ui/MonthGrid.tsx`, `modules/planner/src/widgets/agenda-list/ui/AgendaList.tsx`
, their stories

**Interfaces:**
- Consumes: Task 1's `groupOf`; Task 5's `PartMark`.

Behaviour: in the month grid a chip of a linked sitting gets the `Link2` icon only (label for screen readers from
`m.sitting_part`); in the list view a linked sitting's row gets `PartMark` after the title. Year view and timeline
stay as they are.

- [ ] **Step 1: Add a story to each** with a linked group whose `play` finds the part label on the linked sitting and
  none on an ordinary session.
- [ ] **Step 2: Run them and see them fail**: `pnpm --dir apps/stand exec vitest run MonthGrid AgendaList`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same stories and `pnpm run check`: PASS.
- [ ] **Step 5: Commit** `feat(planner): mark linked sittings in the month and list views`

---

### Task 8: The "Unfinished" row

**Files:**
- Create: `modules/planner/src/features/unfinished/index.ts`,
  `modules/planner/src/features/unfinished/ui/UnfinishedRow.tsx`,
  `modules/planner/src/features/unfinished/ui/UnfinishedRow.stories.tsx`
- Modify: `modules/planner/src/pages/planner/ui/PlannerPage.tsx`, `modules/planner/README.md` (the new slice),
  `packages/i18n/messages/{ru,en,es}.json`

**Interfaces:**
- Consumes: Task 1's `openGroups`, `groupBar`, `restMinutes`, `sittingAt`; Task 2's `bookRest`, `continueAt`;
  Task 5's `SittingBar`, `sittingLabel`; `referenceClass` for the ratio (`typical.ratio`, 1 without one).
- Produces: `UnfinishedRow(props: { plan: Plan; groups: SessionGroup[]; onSelect: (e: PlanEvent) => void;
  onCarry: (e: PlanEvent | null) => void; actions?: UnfinishedActions | undefined })` with
  `interface UnfinishedActions { book: (g: SessionGroup) => void; continueNow: (g: SessionGroup) => void;
  goalMet: (g: SessionGroup) => void }`. Without `actions` (a read-only host) the chips show and nothing else.

Behaviour (spec, "Where sittings are made" and C):
- Shown in the week and day views next to the Backlog, in its chip style, with `m.unfinished_row()` and
  `m.unfinished_row_hint()`; hidden when `groups` is empty. `groups` = `openGroups(plan, hidden)`.
- A chip: the calendar dot, the topic (title without the course prefix, as the Backlog does), `SittingBar` size
  `bar`, `sittingLabel(group)`, `m.unfinished_sittings({ count })`, and `m.unfinished_next({ time })` (`fmtDay` +
  `hh:mm` of `next`) or `m.unfinished_nothing_booked()`.
- Actions: "Book the rest" (`m.sitting_book_rest()`) only when nothing is booked; "Continue now"
  (`m.sitting_continue_now()`) always, and only when the host has a focus page; "Goal met" (`m.sitting_goal_met()`)
  only when nothing is booked.
- Clicking the chip calls `onSelect(group.next ?? latest sitting)`: the page opens it and the grid moves to it.
- Dragging the chip carries `group.next` when one is booked (the page's existing drop moves it); otherwise it
  carries a stand-in event of `restMinutes` length whose drop the page turns into `session.continue` at the drop.
- `PlannerPage` wiring:
  - `book`: `bookRest(plan, g, { now, ratio, busy: taken.blocks })` → `session.change`; `null` → the error
    `m.free_slot_none()` the dialog shows today.
  - `continueNow`: `continueAt(g, now, restMinutes(g, ratio))` → `session.change`; then `focus(uid)` with the
    offer's `uid`, or, when it added one, the uid `sittingAt(plan, g.key, start)` finds once the plan holds it
    (keep `{ key, start }` in state and resolve it in an effect).
  - `goalMet`: `event.patch` `{ unfinished: false }` on the latest done sitting.
  - The drop of the stand-in: `session.continue` on the group's latest sitting at the dropped start for its length,
    cut at midnight.
- Messages (en): `unfinished_row` "Unfinished", `unfinished_row_hint` "Sessions you started and have not finished:
  book the rest, continue now, or close the ones whose goal is met.", `unfinished_sittings` "Sittings: {count}",
  `unfinished_next` "next {time}", `unfinished_nothing_booked` "nothing booked", `sitting_book_rest` "Book the rest",
  `sitting_continue_now` "Continue now", `sitting_goal_met` "Goal met".

- [ ] **Step 1: Write the stories** `Open` (one group with a booked sitting, one with nothing booked: the play checks
  that "Book the rest" and "Goal met" show only on the second and that clicking them calls `book` / `goalMet` with
  that group), `ContinueNow` (calls `continueNow`), `ReadOnly` (no `actions`: no buttons, chips still listed),
  `Empty` (renders nothing).
- [ ] **Step 2: Run them and see them fail**: `pnpm --dir apps/stand exec vitest run UnfinishedRow`
- [ ] **Step 3: Implement** the slice, the page wiring and the messages.
- [ ] **Step 4: Run** `pnpm --dir apps/stand exec vitest run UnfinishedRow PlannerPage && pnpm run check`: PASS.
- [ ] **Step 5: Commit** `feat(planner): list the sessions started and not finished`

---

### Task 9: The event dialog of a sitting

**Files:**
- Modify: `modules/planner/src/features/edit-event/ui/EventDialog.tsx`,
  `modules/planner/src/features/edit-event/ui/EventDialog.stories.tsx`, `packages/i18n/messages/{ru,en,es}.json`

**Interfaces:**
- Consumes: Task 1's `groupOf`, `groupBar`, `restMinutes`; Task 2's `bookRest`; Task 5's `SittingBar`, `PartMark`,
  `sittingLabel`.

Behaviour (spec, "Event dialog"):
- For a sitting of a linked group: `SittingBar` (`bar`, current = this sitting), `PartMark`, `sittingLabel`, and a
  list `m.sitting_list()` of the group's sittings: day and time, then `m.sitting_row_done({ minutes })` or
  `m.sitting_row_booked()`; each row opens that sitting (the dialog's existing way to show another event).
- `continueLater` is replaced by `bookRest(plan, group, { now: nowMinsk(), ratio, busy })`; the button reads
  `m.sitting_book_rest()` and shows only while nothing is booked; when a sitting is booked, the text
  `m.unfinished_next({ time })` takes its place. `unfinished_add` is removed from the three message files.
- Messages (en): `sitting_list` "Sittings", `sitting_row_done` "{minutes} min done", `sitting_row_booked` "booked".

- [ ] **Step 1: Update the story** that clicks `m.unfinished_add()` to click `m.sitting_book_rest()` and expect a
  `session.continue` whose `uid` is the session's and whose length is 35 min for a 60-min session done in 25; add
  `SittingOfThree` (the list of three, the bar, "Part 2 of 3") and `RestBooked` (no button, "next …" shown).
- [ ] **Step 2: Run them and see them fail**: `pnpm --dir apps/stand exec vitest run EventDialog`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same and `pnpm run check`: PASS.
- [ ] **Step 5: Commit** `feat(planner): show and book the sittings of a session in its dialog`

---

### Task 10: Focus: book the rest, continue now, see the earlier sittings

**Files:**
- Modify: `modules/planner/src/pages/focus/ui/FocusPage.tsx`, `modules/planner/src/pages/focus/ui/FocusPage.stories.tsx`,
  `packages/i18n/messages/{ru,en,es}.json`

**Interfaces:**
- Consumes: Task 1's `groupOf`, `openGroups`, `groupBar`, `restMinutes`, `sittingAt`; Task 2's `bookRest`,
  `continueAt`; Task 5's `SittingBar`, `sittingLabel`.

Behaviour (spec, "Where sittings are made", Focus):
- After Finish the status line offers `m.focus_unfinished_book()` and `m.focus_unfinished_open()` instead of
  `m.focus_unfinished()`:
  - book: `event.patch { unfinished: true }` is not sent separately: `bookRest` on the finished session's group
    (`session.continue` marks it); then `m.focus_rest_booked({ time, minutes })`. With no free slot, the existing
    error text `m.free_slot_none()`. When the group already has a booked sitting, neither action shows; the line
    says `m.unfinished_next({ time })`.
  - leave open: today's `unfinished: true` patch and `m.focus_unfinished_done()`.
  - `m.focus_goal_met_drop()` shows when the finished session's group still has booked sittings and moves each of
    them to the trash (`event.remove`, one change per sitting).
- Under the session's title, for a session of a linked group: `SittingBar` (`strip`, current = this session) and
  `m.focus_before_sitting({ done, total })` with the minutes of the earlier done sittings, whether or not the
  hourglass shows. The existing bar, when it shows, draws those minutes as a filled segment before the stopwatch's
  fill.
- After the queue, `m.unfinished_row()` lists `openGroups(plan, parked)` that have nothing booked, each with
  `m.sitting_continue_now()`: `continueAt(group, now, restMinutes(group, ratio))` → `onChange`; Focus keeps
  `{ key, start }` and, once `sittingAt(plan, key, start)` finds the sitting, picks it and starts the stopwatch.
- `focus_unfinished` is removed from the three message files.
- Messages (en): `focus_unfinished_book` "Not finished: book the rest", `focus_unfinished_open` "Not finished: leave
  it open", `focus_rest_booked` "Booked {time}, {minutes} min", `focus_goal_met_drop` "Goal met: drop the rest",
  `focus_before_sitting` "{done} of {total} min before this sitting".

- [ ] **Step 1: Write the stories**: `FinishedBookRest` (finish a 60-min session after 25 min, click book: one
  `session.continue` of 35 min after it), `FinishedLeaveOpen` (one `event.patch` with `unfinished: true`),
  `SittingInHand` (the strip and "45 of 60 min before this sitting" with the hourglass on), `ContinueOpen` (an open
  group with nothing booked; Continue now sends `session.continue` from the story's fixed `now`), `GoalMetDropRest`
  (two `event.remove` for the booked sittings).
- [ ] **Step 2: Run them and see them fail**: `pnpm --dir apps/stand exec vitest run FocusPage`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm exec nx run @lc/planner:test && pnpm --dir apps/stand exec vitest run FocusPage &&
  pnpm run check`: PASS.
- [ ] **Step 5: Commit** `feat(planner): book or continue an unfinished session from Focus`

---

### Task 11: Whole-feature verification

**Files:** none new; fixes only where a check fails.

- [ ] **Step 1:** `pnpm run check && pnpm run test && pnpm run stand:test && pnpm run build`: all PASS.
- [ ] **Step 2:** In a scratch copy of the data directory (`PLAN_DATA_DIR` pointing at a temporary copy of
  `packages/plan-data/data`, never the live one), start the app and walk the spec's example once: finish a session
  after 25 min, "Not finished: book the rest", see the strip on both sittings, select one to see the thread, see the
  row, "Continue now", Finish. Note anything that does not match the spec.
- [ ] **Step 3:** Commit any fix found, one commit per fix, in the style of the task it belongs to.
