# Continuing an unfinished session

Status: proposed, 2026-11-28.

## Why

A planned session often ends before its goal is met: the person is tired after 25 minutes, switches to another
course, and comes back to it later that day or later in the week. The owner wants to record those later sittings as
part of the same planned session, not as unrelated events, and to see the whole picture at a glance: which sessions
are partly done, how the work was spread over the day or the week, and what share each sitting took.

## What is there today

Measured on `develop` at `db94db3`.

- **A link already exists, for split parts only.** `event.split` (`packages/plan-domain/src/core/changes.ts`) keeps
  the first part as the event and its uid, and gives every other part `from: event.from ?? event.uid`. The first part
  keeps the session's first length in `estimate`. `from` is written by the app only (`schema.ts`: "read it, never send
  it"); `applyEdits` drops it from a generated event's patch, so only added events carry it. No UI reads `from`.
- **"Not finished" is a mark, not a sitting.** Focus's status line after Finish offers `focus_unfinished`, which
  patches `unfinished: true` on the session it just logged. Nothing is booked.
- **"Add a session to finish it"** (`continueLater` in `features/edit-event/ui/EventDialog.tsx`) books the session's
  full original length in `nextFreeSlot` after it, through `event.add`. The new event has no `from`: it is not linked
  to the session it continues.
- **The week grid** shows a done session's unused slot (`SLOT_LEFT`) and a run-over (`OVERRUN`), and a 3 px bar at the
  bottom of the event running now. The **Backlog** (`features/backlog`) is a row of chips above the week and day grid
  for sessions whose time passed; a chip opens the session or is dragged onto the grid to give it a new slot.
- **Focus** shows a bar that reaches the plan or the typical length (`likelyLength(planned, referenceClass(...).ratio)`),
  whichever is longer, with a tick for the other.
- **Module overruns** (`goals.ts`) already leave parts with `from` out of the planned hours ("a split part's hours are
  already in the first length"). **Pace** (`accuracy.ts`, `referenceClass` in `progress.ts`) takes every logged session
  as one sample, `actual ÷ planned`; a 25-minute sitting of a 60-minute session counts as ×0.42.
- The owner's plan today has one session marked unfinished (Managed Agents API (1/3), 2026-11-28 20:00) and no split
  parts.

## Goals

- Record another sitting of a planned session in two ways: **book the rest** into a slot ahead, or **continue now**
  with the stopwatch when coming back to it. Both from Focus, the event dialog and the new "Unfinished" row.
- Link every sitting of a session, whichever way it was made (booked, continued now, split by hand), and keep the link
  the one `from` already is.
- Show the linked sittings together (the three views the owner picked, all of them):
  - **A. A progress strip on every sitting** in the week and day grid.
  - **B. A thread through the week** when one sitting is hovered or selected.
  - **C. An "Unfinished" row** above the week and day grid listing every session that is started but not done.
- Show what share each sitting took and how the total compares with the first plan.
- Count a session spread over sittings once in the pace, as the session it is.

## Non-goals

- A to-do or task entity, or work with no time booked other than an open session.
- Changing the generator's module numbering, the "(2/3)" in titles, which counts sessions of a module.
- Changing what calendar export and sync send: a sitting is an ordinary event with the session's title.
- Rebooking automatically when a booked sitting is missed: it lands in the Backlog like any other session.
- Module-level progress (the course progress widget) beyond the pace correction.

## Anti-goals

- An ordinary session, never split nor continued, must look exactly as today: no strip, no mark, no row.
- No new file and no new shape in `edits.json`: a sitting is an added event with `from`.
- A sitting must not show up as extra work in module overruns, and must not skew the pace.
- No rule in the UI that the server does not also apply: what a sitting is and what it may do lives in the domain.

## Constraints

- Every edit is a `PlanChange` handled by `applyChange`; the protocol's schema, guide and `parseChange` change
  together and `pnpm run test` catches their drift.
- Modules get plan data and callbacks as props; they never import `@lc/plan-service`, `@lc/plan-data/*` or `node:*`.
- UI text in `ru`, `en`, `es` through Paraglide; plan content stays Russian; times are Europe/Minsk wall-clock strings
  read with the `@lc/plan-domain` date helpers.
- Strict types: no `any`, `as` or `!`.
- `apps/mcp`, `/api/plan-update` and the AI chat are thin adapters: they pick up the new change through the protocol.

## Approaches

1. **Link the sittings with `from` (picked).** Every sitting names the session it continues, as split parts do now.
   One new change kind adds a linked sitting; the group's progress is derived from the plan, never stored. It reuses
   the existing link and the existing split parts, needs no migration, and every adapter gets it through the protocol.
   Cost: a session is not an object of its own, so it has no name, notes or status apart from its events.
2. **A task entity that owns its sittings.** A new record (`tasks` in the edits) that events point to. Cleaner if to-dos
   without a slot ever come, but it is new data in edits, history, sync, the protocol, the guide, and every generated
   session would need one: several times the work for the same screens.
3. **One event with sittings inside it** (dropped). The grid would draw sittings as shadows of one event; calendar sync,
   the weekly budget and overlap checks work on events, so the sittings would be missing from Google and Outlook.

The owner picked approach 1.

## Design

### The group

A **sitting** is any session event. Its **group** is the set of events whose key `from ?? uid` is the same; the **root**
is the event whose `uid` is that key. A group of one is an ordinary session.

New read model in `packages/plan-domain/src/core/sittings.ts`, exported from `@lc/plan-domain`:

- `sittingGroups(plan): SessionGroup[]` and `groupOf(plan, uid): SessionGroup | null`.
- `SessionGroup`:
  - `key`: the root uid; `calendar`, `title` from the root (or the earliest sitting when the root is in the trash).
  - `sittings`: the group's events by start.
  - `firstPlan`: minutes, the root's `estimate` ?? the root's length (the earliest sitting's when the root is gone).
  - `doneMinutes`: the sum over done, not skipped sittings of `actual` ?? their planned length.
  - `bookedMinutes`: the sum of the lengths of sittings not done, a missed one (its time passed) included: it is still
    booked, and the Backlog shows it too.
  - `state`:
    - `planned`: no sitting is done.
    - `open`: some sitting is done, and some sitting is not done or the latest done one is `unfinished`.
    - `finished`: every sitting is done and the latest done one is not `unfinished`.
  - `next`: the earliest sitting not done, if any (it may lie in the past, then it is also in the Backlog).
- A group is **shown as linked** when it has two sittings or more, or one done sitting marked `unfinished`. Everything
  below applies only to those; an ordinary session is untouched.

### The bar

The whole bar is `max(firstPlan, doneMinutes + bookedMinutes)`. Segments in sitting order:

- done sitting: filled, sized by its minutes;
- booked sitting: hatched, sized by its length;
- the rest, when the group is open and the total is below the first plan: an empty outline, "not booked".

A tick marks `firstPlan` when the total passes it; the part of the bar past the tick uses the grid's existing overrun
hatching. The text form is "65 of 85 min · 5 over the plan", or "45 of 60 min" within it. The sitting being looked at
is the strongest segment.

### The new change: `session.continue`

```ts
| { type: 'session.continue'; uid: string; start: string; end: string }
```

- `uid` is any sitting of the group. The change adds an event at `start`–`end` with the root's calendar, title,
  description, availability and kind (`lab` included: a new sitting is not a pause), and `from` set to the group key.
- In the same step it marks the group's latest done sitting `unfinished: true`, if it is not already: asking for more
  time says the goal was not met.
- It fails, in words a model can act on, for a repeating, all-day, free or personal event or a milestone, when the end
  is not after the start, or when the sitting ends later than the midnight after its start. Ending exactly at 00:00
  of the next day is allowed (as `events.shift` allows it); `event.split` keeps its own rule.
- Updates may send it (unlike `session.finish`): "book the rest of X on Friday at 18:00" is a fair request to the AI chat
  and MCP. Schema, guide and `parseChange` describe it together; `from` stays app-written. `end` is required: the
  model chooses the length. The guide gets a rule for sittings: rule 3's "1 hour, on the hour or the half hour" is for
  sessions planned ahead and does not bind a sitting; a sitting is in 5-minute steps, usually at least 15 minutes, and
  its length is the first plan (the root's `estimate`, or its length) minus the done sittings' `actual`, scaled by the
  course's pace from `get_accuracy`.
- History describes it ("Booked another sitting of X, Thu 16:00–16:35"); `diff.ts` and `describe-step.ts` learn it.
- `rules.ts`: marking the earlier done sitting `unfinished` is not a change to a done session (it already is not).

### Default length of the rest

`restMinutes(group, ratio)`: what is left of the likely length, `likelyLength(firstPlan, ratio) − doneMinutes −
bookedMinutes`, rounded to 5 minutes and at least 15. `ratio` is the course's `referenceClass` ratio, or 1 without
one. So a session whose goal is still not met after its whole plan gets 15 minutes. The person can change the slot
before or after booking it (the event dialog opens on the new sitting). `restMinutes` lives in `core/sittings.ts`,
and `likelyLength` moves there from `modules/planner/src/pages/focus/model/finish.ts` (Focus imports it from
`@lc/plan-domain`): the rule is the domain's, not one page's.

**Late in the evening.** A sitting made from now ("Continue now") ends at the next midnight at the latest: it is cut to
00:00, however short that makes it. The stopwatch may run past midnight; Finish logs the real minutes as today.

### Where sittings are made

**One booked sitting at a time.** "Book the rest" adds a sitting only when the group has nothing booked. When a sitting
is already booked (a missed one included), the actions move that sitting instead of adding one:

- "Book the rest" is not offered; the chip and the dialog show "next Thu 16:00" instead.
- "Continue now" moves the next booked sitting to start now, keeping its length (cut at midnight), with `event.patch`,
  then picks it and starts the stopwatch.
- Dragging the group's chip onto the grid moves the next booked sitting there, as the Backlog chip of the same missed
  sitting would.

`session.continue` therefore only ever adds; moving is the existing `event.patch`.

- **Focus, after Finish.** The status line's single "Not finished" becomes two actions:
  - "Not finished — book the rest": `session.continue` in `nextFreeSlot(plan, { from: max(now, end), length: rest,
    preferHour, busy })`; the line then says when ("Booked Thu 16:00, 35 min") with a link that opens it.
  - "Not finished — leave it open": the current `unfinished: true` patch. The session appears in the "Unfinished" row.
- **Focus, coming back.** Open groups with nothing booked are listed after the queue with "Continue now", which sends
  `session.continue` from now for `rest` minutes, picks the new sitting and starts the stopwatch. Finish on it is the
  ordinary `session.finish`.
- **Focus strip.** When the session in hand belongs to a linked group, the grid's strip (A) and "45 of 60 min before
  this sitting" show under its title whether or not the hourglass is on, so the earlier sittings are always in sight.
  The existing bar, when it shows (glass hidden or a rhythm), also draws the earlier sittings as filled segments before
  the stopwatch's fill.
- **Focus, goal met early.** Finish on a sitting whose group still has booked sittings offers "Goal met — drop the
  rest", which moves those booked sittings to the trash in one step (`event.remove` for each, or a batch change if the
  builder finds one step matters for undo).
- **Event dialog.** For a sitting of a linked group: the strip, "part 2 of 3", and the list of its sittings (day, time,
  minutes, done or booked), each opening its own dialog. The existing "Add a session to finish it" becomes "Book the
  rest", linked and sized by `restMinutes`.
- **"Unfinished" row.** Each chip offers "Book the rest", "Continue now" (navigates to Focus with the new sitting) and,
  when nothing is booked, "Goal met", which clears `unfinished` on the latest done sitting and closes the group.
  Dragging a chip onto the grid books the rest at the drop, as the Backlog does for missed sessions.

### What the views show

- **Week and day grid (A).** A 4 px strip across the top of every sitting of a linked group, segments as in "The bar",
  the shown sitting's segment strongest. A link icon with "part 1 of 3" in the corner where the repeat icon goes (no
  "1/3", which would clash with the module's "(2/3)" in the title). The bottom "now" bar keeps its place.
- **Thread (B).** Hovering or selecting a sitting outlines its other sittings in the shown range, joins them in start
  order with a dashed line in the calendar's colour, numbers them, and fades the other events. A sitting outside the
  shown range gets a marker at the grid's edge ("2 more next week"). Keyboard selection triggers it the same way.
  Reduced motion: no animation, same drawing.
- **"Unfinished" row (C).** A section next to the Backlog, above the week and day grid, in the same chip style: one chip
  per open group anywhere in the plan, most recently worked first, with the calendar dot, the topic, a small bar and
  "45 of 60 min · 2 sittings · next Thu 16:00" or "nothing booked". Clicking a chip selects the group's next sitting, or
  its latest one, and moves the grid to it. Hidden when empty and for a read-only host's actions (the chips still
  show).
- **Month grid.** The link icon on the chip, no strip. **List view.** "part 2 of 3" after the title. **Year view and
  timeline.** Unchanged.

### Counting

- **Weekly budget and day limit:** a sitting counts like any session.
- **Module overruns (`goals.ts`):** unchanged; sittings carry `from`, so their hours stay out of "planned" and their
  minutes go into "spent".
- **Pace (`accuracy.ts`, `referenceClass`, `runningTypical`):** a linked group is one sample, once `finished`:
  `Σ actual of its done sittings ÷ firstPlan`, at the latest sitting's time. An open group is left out, a lone session
  marked unfinished included: its 25 minutes of a 60-minute plan are not a ×0.42 session. It comes back as one sample
  when it is finished, by another sitting or by "Goal met"; the "Unfinished" row keeps it in sight until then. A
  session never split, continued nor marked unfinished counts as today. `referenceClass` leaves out the whole group of
  the session in hand, not just the session.

## Testing

- Domain (Vitest, `packages/plan-domain`): `sittingGroups` states and minutes, including skipped sittings, a root in the
  trash, a lone unfinished session, split parts; `session.continue` (link to the root through a sitting that is itself
  linked, the `unfinished` mark, every failure case); `restMinutes`; pace pooling with `accuracyOf` and
  `referenceClass`.
- Protocol: the schema, guide and `parseChange` drift test covers the new kind; a parse test for good and bad input.
- Modules: stories for the week grid with a linked group (strip, thread, edge marker), the "Unfinished" row, the event
  dialog of a sitting, and Focus with a linked session; unit tests for the bar's segment arithmetic.
- `pnpm run check && pnpm run test && pnpm run build`.

## Left to the builder

- Component and file names inside `modules/planner`, and whether the row is a new feature slice (`features/unfinished`)
  or part of `backlog`.
- How the thread is drawn (SVG overlay or per-event connectors), as long as it follows lanes and scrolling.
- Wording of the new messages in the three languages, within the meanings above.
- Whether "Goal met — drop the rest" is one change or several.

## Calls made without the owner

- Default length of the rest: the likely length minus what is done and booked, at least 15 minutes.
- The bar's scale: done plus booked, with a tick at the first plan, rather than capped at the plan.
- `session.continue` marks the latest done sitting unfinished in the same step.
- The AI chat and MCP may send `session.continue`.
- The pace counts a spread session once, when finished; open ones are left out.
- "Goal met — drop the rest" on Finish, and "Goal met" on a row chip, to close a group without another sitting.
- The row lists open sessions from the whole plan, not only the shown week.
- The part marker reads "part 1 of 3" with a link icon.
- One booked sitting at a time: with one booked, "Continue now" and dragging the chip move it rather than add another.
- A sitting may end at the next midnight, not later; "Continue now" late in the evening is cut to 00:00.
- The AI chat and MCP choose a sitting's length themselves, guided by a new rule in the guide.
- Focus shows the strip of a spread session under its title even with the hourglass on.
- A lone session marked unfinished leaves the pace until it is finished.
