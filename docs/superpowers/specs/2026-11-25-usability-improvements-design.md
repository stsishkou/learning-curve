# Usability improvements: follow, review, change, goals, success and failure

The owner wants one tool that helps to **follow** a plan day to day, **review** it, **change** it when needed, keep
to **goals**, and **see success and failure**. A review of the planner, the Progress page, the timeline, Focus and
the chat/MCP tools (2026-11-25) found the loop complete but scattered: problems are shown in one place and fixed in
another, nothing is remembered from week to week, and most of the success picture stays empty until sessions are
logged. The owner asked for every improvement the review proposed, plus labels.

Each step below is built, checked (`pnpm run check`, `pnpm run test`, a browser run on a copy of the data) and
committed on its own, in this order.

## 0. Two bugs

- The runway marks a lab done once its end has passed (`widgets/runway/ui/Runway.tsx`); it follows `done`.
- The Progress tile "at this pace" is a straight line from overall progress (`planStats.forecast`) while the
  burn-up's dashed line is `paceForecast`. One forecast everywhere: `paceForecast`.

## 1. Labels on calendars

**Approaches.** (a) Labels on calendars, several each; sessions inherit them. (b) Labels on calendars and single
sessions. (c) One group per calendar. Picked (a): the need is a provider or program across courses ("Google Skills
for Partners" instead of a name prefix); session labels would need per-event editing and a mapping for
Google/Outlook; a single group cannot say "Partner" and "Certification" at once.

- Stored in `edits.json` as `labels: { <calendar id>: string[] }`, applied onto `PlanCalendar.labels`. A label is
  trimmed text, at most 40 characters, compared without case; a calendar keeps each label once.
- Changes: `calendar.labels` (`id`, the full `labels` list) and `label.rename` (`from`, `to`; `to: null` removes
  the label from every calendar). `course.add` takes optional `labels`. `calendar.labels` and the `labels` of
  `course.add` are part of the update protocol, so chats and MCP can set them; `label.rename` is UI-only.
- **Calendars dialog:** under each calendar's name, its labels as pills with ×, and a "+ Label" field that
  suggests existing labels. A "Labels" section lists every label with its calendars, rename, remove, and hide or
  show all of its calendars at once.
- **Filter:** a row of label pills above the calendar chips: All, each label with its count, No label. A click
  shows only that label's calendars (the per-browser chip filter); a second click shows all again.
- **Search:** the command palette matches label names: "Only <label>" and the events of its calendars.
- **Grouping and splitting:** the timeline groups lanes under label headers (sessions, dates, nearest deadline);
  the Progress page's course list and weekly load chart, and the week's budget panel, can total by label. A
  calendar with two labels counts under both, and the totals say so.

## 2. Today

- **Today panel** (planner side panel, first on a phone): every session of today in order, each with its state
  (done, now, next, missed, skipped) and actions: Start in Focus, Done (asks for the time), Skip, Move to the
  next free slot.
- **Skipped:** the person decides not to do a session. Stored as `done: true, skipped: true`, like `unfinished`:
  it is no longer open work (not overdue, not in catch-up or the forecast), but every count of success treats it
  as a miss (done hours, completion, streak, week review, course progress) and it is drawn struck through and
  dimmed with a "skipped" mark. Undone by marking it not done. Part of the update protocol (`skipped` in
  `event.patch`).
- Focus can be opened from the event card; the Focus queue starts with missed sessions, then today's.

## 3. Every problem offers its fix

- Progress page: "behind" opens Catch up; a week over budget and a course late for its deadline open Reschedule
  for that week or course; "fill in times" stays. The planner opens these from URL parameters
  (`?open=catchUp`, `?reschedule=<day>&calendar=<id>`).
- Planner: the budget panel over budget offers Reschedule; a passed deadline on the runway offers Reschedule.
- Catch up names the sessions it could not place; Reschedule's move mode lists what moves (old → new).
- A change made directly in the grid or the event form shows the plan's rule warnings (holiday, weekend,
  overlap, past the deadline) in the undo bar, without blocking it.

## 4. Weekly review that is kept

- The review lists the missed sessions of the week with Done, Skip and Move actions, takes a one-line note, and
  is saved: `week.review` (`week`: its Monday, `note`) stores the note with the week's numbers at that moment
  (planned, done, real hours, missed, skipped, goals met) under `weekNotes` in `edits.json` (`reviews` already
  names the planned module reviews). Saving again replaces it. UI-only.
- The planner offers "Review last week" from Monday until that week is reviewed.
- Progress page: **Weeks: plan against what happened**, one group of bars per week (planned, done, real hours)
  with missed and skipped counts, and the saved notes. Course bars show missed and skipped counts.

## 5. One forecast, every deadline

- `paceForecast` drives every "at this pace" date (step 0). Reschedule's "pace" (sessions a day) is renamed so
  "pace" means real time against planned time everywhere.
- The runway's stretch after the last session is "spare days" (the timeline's word), and it lists the other
  deadlines ahead under the bar: name, day, days left.

## 6. Settings

- A Settings dialog (⋮ menu and palette): weekly study budget (`plan.budget`, stored in `edits.json`, applied to
  `meta.weeklyBudgetHours`), the most study hours in one day (`plan.dayLimit`: the rule check warns about a
  longer day, the week grid marks it, and it is the starting value of a re-balance), and how many minutes before
  a session a reminder comes (per browser, like the reminder switch). Budget and day limit are UI-only changes.

## 7. New course form

- "New course" (toolbar menu, palette, Calendars dialog): name, color, labels, the module list pasted as text,
  first day, weekdays, start time, sessions a day, optional deadline. The list understands a Google Skills path
  copied from the page (title lines, duration lines such as "2 hours 30 minutes", "Skill badge" marks a lab) and
  one module per line ("Title — 2h 30m").
- A pure `planCourse` in `plan-domain` turns the input into sessions by the guide's rules: one-hour sessions,
  durations rounded up to whole hours and numbered `(i/n)`, a lab one two-hour block, free slots only, weekly
  budget and day limit kept, holidays skipped. The form shows the preview (sessions, dates, rule warnings, weeks
  over budget) and applies one `course.add`.

## Not in this round

Session-level labels, push or e-mail reminders, plan version comparison in History.
