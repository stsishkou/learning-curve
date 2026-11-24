# Timeline page: change a course in place, see before and after, then apply

Asked 2026-11-23 after trying the timeline strip: "Timeline better to have under separate route with great UX. Looks
like dragging and dropping doesn't work, not clear what would change, how it looks like, and how it will look like.
Need to add transparency for that visualization … research well known scheduler providers … do the most recommended
trajectory by yourself." The person handed over every how-it-gets-made choice; the calls below are mine.
Research: `docs/timeline-preview-research.md` (this round), `docs/calendar-timeline-research.md` (the strip).

## What went wrong with the strip

- A drop that opened Reschedule (a lane moved onto a rule, any end dragged) opened it while the browser was still
  delivering the drag's own click; that click landed outside the new modal and light dismiss closed it at once. Fixed
  in `065947b`: a drop acts after the gesture is over.
- A drop that broke no rule was stored at once: nothing showed what it would do before it happened, and afterwards only
  an Undo bar said something had.
- 24 px rows over the whole plan leave about 7 px a day: a day-precise drag of an end or a deadline is guesswork.

## Intent

A page of its own, `/timeline`, where every course is a lane and the three common edits (move a course, finish it by
a day, move its deadline) are made by dragging or by a form, kept as a **draft** that shows the plan as it is and as
it would be, side by side on the same lanes, with what each change does in words. Nothing is stored until Apply; Apply
is one step back with Undo.

**Goals**

- A dedicated page in the app's navigation, with the lanes large enough to aim at a day.
- Transparency: during a drag, the result in words on the spot; after a drop, the old plan stays visible under the
  new one (a baseline), the lanes and sessions that change are marked, each change is listed as before → after with
  the rule warnings it causes; Apply and Discard are always in view while a draft exists.
- Every edit also without dragging (WCAG 2.2 SC 2.5.7): the selected course's panel has the same three edits as fields.

**Non-goals**: dependencies between courses, a start handle, editing single sessions on the timeline (the week grid
does that), saving a draft across reloads, the strip on the planner (it goes: one place to edit).

**Anti-goals**: a drag that stores anything before Apply; a change whose effect on other courses or on the rules is
not shown before Apply; a page that needs a mouse.

## Approaches

| | What | Trade-off |
|---|---|---|
| **A (chosen)** | Draft and review: drops collect `PlanChange`s in a draft previewed with `previewUpdate`; the old plan is drawn as a baseline under the new; Apply stores them with `changeAll` | Shows exactly what will change before it does (the Jira Plans / baseline pattern); one more step than a direct edit |
| B | Direct edit with Undo, as the strip did, plus change highlighting after the fact | Fewest clicks; the person still learns what happened only afterwards, which is what they asked to fix |
| C | Every drop opens the Reschedule dialog prefilled | Reuses the dialog; a modal per drag hides the timeline the person is looking at |

## Design

**Route and navigation.** `apps/web/src/routes/timeline.tsx` renders `TimelinePage` from `@lc/planner` with the plan
state, `savePlanChanges`, `travelPlanHistory` and `rebalancePlan`. The shell's navigation gets a "Timeline" tab
between Plan and Focus, and the planner's command search a "Timeline" entry. The strip, its position setting and its
planner menu switch are removed from the planner.

**Page layout.** Sticky `PageHeader` (title with help, the line under it says drafts are applied only on Apply). A
toolbar: zoom (`Whole plan` fits the width, `Month` ≈ 14 px a day, `Week` ≈ 40 px a day, kept per device), `Today`
(scrolls to today), `Show the plan before` (baseline on/off, on while a draft exists). The chart: a sticky name column
(dot, name, done/total, dates, deadline and spare or late days, a "changed" mark) and a horizontally scrollable track
area with a two-row axis (months; Mondays), light week and month lines, the today line, lanes 48 px high (sessions,
bar, spare days, overflow past the deadline, deadline diamond). A legend under the chart names every mark. On a phone
the name sits above its lane. With no lane: an empty state that points to the planner.

**Selection panel** (right of the chart from `lg`, under it on a phone). Clicking a lane selects it. The panel shows
the course as it is, and when the draft changes it, as it would be (start, end, deadline, spare days: before → after),
the sessions that move, and its warnings. Edits as fields: move by weeks (− / +), finish by a day (date), deadline
(date), "Finish by the deadline", "Reset this course", and "More options…" which opens the Reschedule dialog prefilled
(it stores on its own Apply, as on the planner).

**Drag.** As on the strip (`useNudge`: mouse at once, touch after 350 ms, keys as sliders), and now each drag says what
it would do: move — "+2 weeks · 7 Dec – 6 Jan", and "13 days after the deadline" when it would be; end — "Finish by
10 Feb · 26 sessions re-placed"; deadline — "Deadline 31 Dec · 8 days spare" or "… 5 days late". A drop changes the
draft, never the plan.

**Draft.** One entry per course: a move by days or a finish-by day (the later replaces the earlier), and a deadline.
Its changes are worked out in order of the entries, each on the plan the ones before it make: the deadline step
(`deadlineChange`), `events.shift` from today, or the re-balance (`rebalance` with `target: deadline`, `deadline =
finishBy + 1`, the default study hours, budget hard) turned into a change by `rebalanceChange`. A re-balance being
worked out shows on its lane; one that fails keeps its entry with the reason and blocks Apply until it is reset. The
whole draft is `previewUpdate(plan, changes)`: lanes are drawn from its `after`, the baseline from the plan.

**Transparency on the lanes.** A changed lane draws the old bar thin and dashed under the new one, moved sessions
with a ring, and a delta chip at the end (`+14 d`). Unchanged lanes stay as they are.

**Draft bar** (sticky at the bottom while a draft exists): how many courses change, how many sessions move, how many
warnings; `Review` opens the list of every change (per course: before → after, the sessions as `PlanDiffList`, rule
warnings and weeks over budget); `Discard`; `Apply` (disabled while a re-balance is being worked out, or a change
does not fit). Leaving the page with a draft asks the browser to confirm (`beforeunload`).

**After Apply** the changes are stored with `changeAll` (one history step each), the draft clears and a bar says what
was applied with `Undo`, which steps the history back by that many.

## Left to the builder

Sizes and colours within the design system, the copy in ru/en/es, store keys, the exact axis tick density per zoom.

## Calls made without the person

- Draft and review (A) over direct edit: the person asked to see what will change before it does.
- The strip leaves the planner: the person asked for the timeline on a page of its own; two places to edit the same
  thing would differ.
- One entry per course, move and finish-by exclusive: they are the two modes of the Reschedule dialog.
- The draft lives only on the page; a reload or leaving drops it (the browser asks first).
- The timeline page edits the project plan; a plan file opened in the planner stays in the planner.
- `More options…` on the panel opens Reschedule for the course, which stores at once and takes the course out of the
  draft: it is the way to the pace and hours modes the draft does not have.
- On a phone the sections of the app scroll sideways in one row rather than wrap into a taller sticky bar.
