# Timeline lines: one lane per calendar, edited in place

Approved 2026-11-23 from the outline in the conversation ("Go ahead to the timeline lines!"). Research:
`docs/calendar-timeline-research.md`.

## Intent

The person asked for "lines over the header (bottom or top) with the timeline of each calendar, with its title and
colour", and to "edit the timeline and the deadline". Today the planner shows one calendar's span (the runway, for
the nearest deadline) and edits spans only through the Reschedule dialog. The lines give every course's span at a
glance and make the two common edits (move a course, change its deadline) direct, while anything the solver decides
(a new rhythm) is still shown before it is stored.

**Goals**

- A strip of thin lanes, one per calendar the planner shows, in its colour, with its name, its sessions, its
  deadline and today.
- The strip sits below the header (default), above it, or is hidden: a per-device choice.
- Drag a lane to move the course, drag its end to re-balance it towards a new finish, drag its deadline to change
  the deadline. Every drag has a keyboard and a single-tap alternative.

**Non-goals**: zoom or range choices, a start handle, a link that switches the runway to a lane, a separate
calendar checklist for the lanes, collapsing lanes on a phone.

**Anti-goals**: a drag that stores a re-balance without showing it first; a strip that pushes the calendar out of a
phone screen for good (it can be hidden); a second way of storing changes beside `PlanChange`.

## Approaches

| | What | Trade-off |
|---|---|---|
| **A (chosen)** | A planner widget drawing the lanes; drags produce the existing changes (`events.shift`, the deadline step) or open the Reschedule dialog prefilled | Reuses every rule, preview and undo path; the widget has its own pointer and keyboard code |
| B | Read-only lanes; every edit through the dialog | Simplest; does not answer "edit the timeline" |
| C | A Gantt library (Frappe, dhtmlx) | A heavy dependency with its own look and drag rules that know nothing of Move versus Re-balance |

## Design

**What a lane shows** (`calendarLanes` in `plan-domain`, pure): every calendar the planner's filter shows that has
sessions, and an open one or a deadline from today on. Per lane: the calendar, its first and last session day, each session's day
and state (done, open, missed: past and not done), done and total counts, its deadline (`deadlineOf`), and its first
open session day. `lanesRange` gives the days drawn: from the Monday of the week before today to the latest last
session or deadline, at least four weeks. Before the clock is known (server render) today is the first open
session's day and there is no today line.

**Drawing** (widget `timeline-lanes`): a name column (colour dot, name, done/total) at 200 px from `md`, the name above the bar on
a phone; a 24 px row (36 px on a phone) with a thin bar from the first to the last session in a light tint of the
colour, a mark per session (done: solid; open: tint; missed: outlined in the warning colour), hatched spare days to
the deadline, the overflow past the deadline in the danger colour, a diamond at the deadline, one today line through
all lanes, and the first and last day of the range on an axis. A bar cut by the range edge fades there.

**Editing**

| Part | Pointer | Keyboard | Result |
|---|---|---|---|
| Lane body (`button`, "Reschedule <name>") | Drag: moves the open sessions, snapped to whole weeks so weekdays stay weekdays; tap/click: opens Reschedule | Enter/Space opens Reschedule | Drop: `events.shift` {calendar, from: today, days}; with no problem and no rule warning it is stored at once (Undo bar), otherwise Reschedule opens in Move with calendar and days filled in |
| Finish handle (`slider`) | Drag, snapped to days | ←/→ a day, Page Up/Down a week, Home/End the range; Enter commits, Escape or leaving reverts | Reschedule opens in Re-balance with "Finish by" that day; nothing is stored until Apply |
| Deadline diamond (`slider`) | Drag, snapped to days | as the finish | The deadline step alone (`deadlineChange`), stored at once; the Undo bar offers "Re-balance to it" |

A drag shows a ghost and a tooltip with the result ("+1 week", "Finish by 10 Feb", "Deadline 14 Feb"); Escape
cancels it; dropping where it started does nothing. On touch a drag starts after a 350 ms press (the week grid's
`LONG_PRESS`), so a swipe still scrolls; a tap opens Reschedule. Handles have 24 × 24 px hit areas, apart from each
other. Sliders carry `aria-valuetext` (the localized date) and a description of their keys; they move an uncommitted
value and commit on Enter, which the description says.

**The Reschedule dialog** gains a `preset` ({calendar, mode, days?, finishBy?}). In Re-balance, "Fit the deadline"
becomes **"Finish by [date]"**: the date defaults to the day before the Deadline field and the request aims at the
day after it (`deadline = finishBy + 1`), so the milestone changes only when the Deadline field does. In Move, a new
deadline can be stored alone.

**Position**: `below` (default), `above`, `hidden`, kept per browser in `localStorage` like the second time zone. Set
from a ⋮ menu on the strip, and a "Timeline" switch in the planner's ⋮ menu and command search brings a hidden strip
back. "Above" puts the strip above the planner header; "below" between the header and the runway.

## Left to the builder

Exact sizes and colours within the design system; the copy of each string (ru, en, es); the store key name.

## Calls made without the person

- Lanes follow the planner's calendar filter rather than a checklist of their own: one way to choose calendars.
- The lane drag snaps to weeks (a shift by calendar days would put Friday sessions on Saturday); days through the
  dialog.
- "Finish by" replaces "Fit the deadline" in the dialog instead of a new request target: the request already takes a
  deadline that is not stored.
