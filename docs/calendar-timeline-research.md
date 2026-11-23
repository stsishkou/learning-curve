# Calendar timelines: one lane per course, and editing it

Fetched 2026-11-23, 15:10–16:40 UTC (18:10–19:40 Europe/Minsk). Only first-party pages were used: vendors' help
centres, changelogs and design-system docs, library docs and READMEs, W3C/WAI specifications and Apple's Human
Interface Guidelines. monday.com and ClickUp block page fetches, so their articles were read through their public
Help Center API (`/api/v2/help_center/en-us/articles/<id>.json`), which serves the published article body. Every
claim is followed by the page it was read from.

The question: how comparable products draw per-project timelines as horizontal lanes, and how they let people edit
them, so that the planner can offer one line per calendar (colour, name, its span, its deadline) above or below the
header, and edit a calendar's span and deadline from there.

Legend: **(d)** = documented on the linked first-party page, read here; **(s)** = the first-party page renders only
in a browser, so the claim was read from a search engine's copy of that page, not from the page itself; **(k)** = my
general knowledge, not re-verified. Treat every (s) and (k) as a lead to check, not a fact. Section 2.12 lists the gaps.

## 1. Short answer

What most products share:

1. **A lane is a bar from its first date to its last, in its group's colour.** monday colours by group, status or
   board with an optional legend; ClickUp by status, priority or List; Sheets from a column (d,
   [monday][monday-gantt], [ClickUp][clickup-gantt], [Sheets][g-sheets-create]).
2. **Names sit in a column at the left, not on the bar** (monday, ClickUp, Jira; Notion's table can be hidden) (d,
   [Notion][notion-timeline]). Frappe Gantt instead keeps a label in view while the chart scrolls (d, [Frappe][frappe]).
3. **Today is one vertical line through every lane, plus a Today button:** monday's "blue bar", Jira's orange line;
   Notion, Sheets and Frappe have the button (d, [monday][monday-gantt], [Jira][jira-timeline]).
4. **A milestone or deadline is a diamond coloured by state.** monday: green when done on time, red when overdue;
   Linear: changes "depending on the completion status"; ClickUp and Asana (s) also use diamonds (d,
   [monday][monday-timeline], [Linear][linear-milestones], [ClickUp][clickup-milestones]).
5. **A group's span is a summary bar with progress.** ClickUp fills a List's bar by "tasks completed divided by the
   total tasks"; monday has a "group summary"; Project's timeline has "task progress shading" (d,
   [ClickUp][clickup-gantt], [Project][ms-project-timeline]).
6. **Drag the whole bar to move it, an end to change one date; what is inside moves along.** Jira: "If the work item
   has child items, they'll move with it"; also Notion, ClickUp, Linear, Project for the web, Asana (s) (d,
   [Jira][jira-edit]).
7. **Drags snap to days.** Frappe `snap_at: 1d`; monday: drag "the exact number of days" (d, [Frappe][frappe]).
8. **The range has an auto fit and a few zoom steps:** monday "Auto Fit"; Jira Weeks/Months/Quarters; Linear week to
   year (d).
9. **Groups collapse and calendars can be hidden:** monday (click, Ctrl+G), ClickUp (Collapse all), Sheets ("a single
   row for each card group"), Notion Calendar (eye icon) (d, [Sheets][g-sheets-use], [Notion Calendar][notion-cal]).

Where they differ:

- **Immediate versus previewed.** monday says "Any changes will automatically be applied"; ClickUp and Jira's
  timeline describe no confirm step. Tools that compute a schedule keep a draft: Jira Plans holds changes "in a draft
  state until you're ready to save them", and its auto-scheduler shows "Preview results" before "Accept changes" (d,
  [save][jira-save], [auto-schedule][jira-auto]). This split maps onto the planner's Move (a plain shift) and
  Re-balance (a solver result).
- **What a drag does to the rest.** Linear bumps planned projects, leaves started ones in place, and has Shift and
  Cmd/Ctrl to widen or narrow that (d, [Linear][linear-deps]); monday and Notion offer strict, on-overlap and no
  shifting (d, [monday][monday-deps], [Notion][notion-deps]); ClickUp turns all rules off for a bulk drag (d).
- **Outlook has no lanes.** "Calendar Peek, List view and Schedule view are not available in new Outlook" (d,
  [views][ms-views]); classic Outlook's Schedule View is the horizontal layout the person may remember (d,
  [groups][ms-groups]). The Microsoft product that does what is asked is **Project's Timeline**: a strip "above the
  current view" with several bars, each with its own date range (d, [Project][ms-project-timeline]).
- **The drag itself is rarely accessible.** No vendor page read documents keys that move a bar; the documented
  alternative is a form: Project for the web's task details (Alt+I), dhtmlx's Enter "lightbox" (d,
  [Project][ms-p4w-sr], [dhtmlx][dhx-keys]).

For this planner (section 4): thin lanes under the header that scroll with the page; names in a left column on a
desktop and above the bar on a phone; a diamond for the deadline, hatched spare days, one today line; dragging a
whole lane is Move, applied at once with Undo; dragging its finish opens Re-balance with a preview; dragging the
deadline changes only the milestone; every drag has a tap-and-form alternative.

## 2. Products

### 2.1 Showing

| Product | Lanes per project? | Where | Bar and label | Today | Milestone / deadline | Progress | Collapse, hide | Range, zoom |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| New Outlook, Outlook on the web | No: Day, Work week, Week, Month only (d) | — | Calendars split into columns or overlaid "with their assigned color" (d) | — | — | — | Calendar checkboxes (d) | — |
| Classic Outlook | Schedule View: calendars as horizontal rows (d) | Not described | Not described | — | — | — | — | Not described |
| MS Project desktop Timeline | Yes: several timeline bars (d) | "Above the current view" (d) | Tasks as bars or callouts "from above or below"; bar label (d) | Not described | Milestones can be added (d) | Progress shading, can be turned off (d) | — | Date Range per bar (d) |
| Planner premium / Project for the web | Gantt (d) | Own view | Not described | Not described | Task with 0 duration (d) | Critical path (d) | — | Not described |
| Google Calendar | No (d, by its view list) | — | — | — | — | — | — | — |
| Google Sheets timeline | Card groups as rows (d) | Own view | Card title, colour from a column (d) | Today button (d) | — | — | Collapsed view: one row per group (d) | Zoom % (d) |
| Notion timeline | Rows per item (d) | Own view, optional table at left (d) | Properties on bars (d) | Today button (d) | — | — | — | Hours to years (d) |
| Linear | One row per project, grouped by initiative (d) | Own view | Not described | Not described | Diamond, by status (d) | Current milestone % (d) | Group by (d) | Week, month, quarter, year (d) |
| Asana | Rows per task, sections (s) | Own view | — | — | Diamond (s) | — | — | — |
| Jira timeline | Rows, parents with children (d) | Own view, list at left | Colour = status (d) | Orange vertical line (d) | — | Parent progress from children (d) | — | Weeks, Months, Quarters (d) |
| monday.com | Rows, grouped; group summary bar (d) | Board view or dashboard widget (d) | "Label by", "Color by", legend (d) | Blue vertical bar, toggle (d) | Diamond; green on time, red overdue (d) | Baseline: grey snapshot, green/red (d) | Click or Ctrl+G (d) | Auto Fit, +/−, days–years (d) |
| ClickUp | Rows; a progress bar per List (d) | Own view, sidebar at left | Colour by status, priority, List (d) | Not described | Diamond (d) | Done ÷ total on the List bar (d) | Expand / Collapse all (d) | Day–Year, Flexible, Ctrl+scroll (d) |
| Frappe Gantt | Rows (d) | Component | `bar_height` 30, `padding` 18, `auto_move_label` (d) | `today_button` (d) | — | Progress, editable (d) | — | Day, Week, Month, Year (d) |

### 2.2 Editing

| Product | Move whole bar | Drag an end | Drag a milestone | Snap | Shown while dragging | Commit | Undo | Items inside |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Project for the web | "drag the task bars" (d) | Not described | Not described | — | — | No confirm described | — | Dates follow dependencies (d) |
| MS Project desktop Timeline | Up/down to another row or timeline only (d) | — | — | — | — | — | — | — |
| Notion | Not described; up/down reorders (d) | Either edge (d) | — | — | — | — | — | Dependents: 3 shift modes (d) |
| Linear | Yes (d, 2021) | Extend or shorten (d, 2021) | Yes; Shift drags all (d) | — | Legend hints for shortcuts (d) | No confirm described | — | Milestones; chain bumped unless Cmd/Ctrl (d) |
| Asana | Yes (s) | Edges (s) | — | — | — | — | — | — |
| Jira timeline | Yes (d) | Handles at either end (d) | — | Kanban bar length by zoom (s) | — | No confirm described | — | "they'll move with it" (d) |
| Jira Plans | Yes (d) | Expand or contract (d) | — | — | Unsaved-change markers (d) | Draft; Review changes; save or discard (d) | Discard (d) | Warnings on conflicts (d) |
| monday.com | Yes, by days (d) | — | Set in the date picker (d) | Days (d) | Dependents move along (d) | "automatically be applied" (d) | Undo pop-up, Activity log (d, for batch) | Strict / Flexible / No action (d) |
| ClickUp | Yes; drag a List's progress bar to move all its tasks (d) | Start and end brackets; right end = due (d) | — | Non-working days skipped if set (d) | — | No confirm described | — | Bulk drag ignores all rules (d) |
| dhtmlx Gantt | Yes (d) | Start or end (d) | — | Rounding to scale in a sample (d) | — | `onBeforeTaskDrag` can deny (d) | Ctrl+Z / Ctrl+R (d) | `drag_project` (PRO) (d) |
| Frappe Gantt | Yes (d) | Yes (d) | — | `snap_at: 1d` (d) | Popup on click (d) | No confirm described | — | `move_dependencies: true` (d) |

### 2.3 Microsoft

- **New Outlook and Outlook on the web have no timeline lanes.** The views are Day, Work Week, Week and Month, and
  "Calendar Peek, List view and Schedule view are not available in new Outlook at this time" (d, [views][ms-views]).
  Several calendars are shown side by side ("Split view") or overlaid, where "The calendar events appear overlayed on
  the default calendar with their assigned color" (d, [multiple calendars][ms-multi]); on the web "In split view, you
  might have to scroll horizontally to see all of them" (d, [web][ms-web-multi]). The calendar board view was retired:
  "In June 2023, calendar board view will be retired" (d, [board][ms-board]; the page is undated, the date is past).
- **Classic Outlook's Schedule View** is the horizontal one: "Group calendars appear side by side or in horizontal
  Schedule View", with an "Add a Calendar box at the bottom of the view" (d, [calendar groups][ms-groups], applies to
  Outlook 2016–2024 and Microsoft 365). The page does not describe its time scale; I know it as a day-scale free/busy
  layout for comparing people, not a course-length span (k).
- **Microsoft Project desktop, Timeline view** is the closest match to the request. "It appears above the current
  view"; tasks are bars or callouts that point "to the timeline from above or below"; a second timeline bar can be
  added and each gets its own Date Range; tasks can be dragged "up or down within the timeline to show them on
  different rows, or … between different timelines"; background colour, bar label and task progress shading are
  formatting options (d, [timeline][ms-project-timeline], Project 2016–2024 and Project Online desktop).
- **Planner (premium plans) and Project for the web.** "View your tasks in a Gantt chart format using the Timeline
  view", with dependencies, the critical path and milestones (d, [premium][ms-premium]). Editing: "drag the connector
  between tasks" for a dependency and "As time estimates change, drag the task bars to update your project" (d,
  [build][ms-p4w-build]). A milestone is "a task with no duration"; "the milestone symbol is now part of your
  timeline" (d, [milestone][ms-milestone]). Basic Planner's Schedule/Calendar view shows tasks "by their start dates
  and due dates", weekly or monthly, with an "Unscheduled tasks" list that can be dragged onto the calendar (d,
  [schedule view][ms-planner-schedule]).
- **Non-drag path in Project for the web:** Shift+Down selects tasks, Alt+M opens "More options", Alt+I the task
  details, to add a dependency; dates come from the scheduler or other views. The bar itself is not operable from
  the keyboard on that page (d, [screen reader][ms-p4w-sr]).
- **To Do and Loop:** no timeline found for To Do; Loop tables offer Table and "a Board visualization", no timeline
  (d, [Loop][ms-loop], 2024).
- **Fluent 2** lists no timeline, Gantt or date picker; it has Slider and Spin button (d,
  [components][fluent-components]). "Use a slider for imprecise values"; step sliders snap; "It's common to use a
  tooltip to label the current value", and it "must be perceivable to people using screen readers"; label every
  slider "even if that label is hidden". Two-thumb sliders are not covered (d, [slider][fluent-slider]).

### 2.4 Google

- **Google Calendar** offers "Day, Week, Month, Year, Schedule, or 4 days"; other calendars can sit side by side only
  in Day view: "The side-by-side calendars won't work for the week or month view" (d, [views][g-views]). There is no
  lane or project view. Multi-day and all-day events appear as bars along the top row of the week grid (k); no
  Google page describing that row was found. Nothing called Goals or Tasks gives lanes either (k).
- **Google Sheets timeline view** is Google's lane view. Settings: start date, end date, card title, "Card color only
  appears … after you choose the column as the source of your card background", and "Card group: Group multiple
  cards on the same "timeline view" row based on a column" (d, [create][g-sheets-create]). "Show cards in collapsed
  view" will "Merge cards into a single row for each card group"; a Today button and a zoom percentage; viewable on
  Android and iOS (d, [use][g-sheets-use]). Paid Workspace editions only (d). Dragging is not described.

### 2.5 Notion and Notion Calendar

- **Timeline view:** "show a table to the left of your timeline", toggled with `>>` / `<<`; "any time scale, from hours
  all the way up to years"; "click `Today`"; hover an edge and "drag and drop each edge to make it as long or short as
  you want it to be"; "click and drag any timeline item up or down" to reorder; start and end may be separate
  properties (d, [timelines][notion-timeline]).
- **Dependencies** have three modes: "Shift only when dates overlap" ("The distance between tasks may still be
  decreased"), "Shift & maintain time between items", "Do not automatically shift", plus "Avoid weekends" (d,
  [dependencies][notion-deps]).
- **Notion Calendar** has no lane view on the page read. A calendar is hidden with the eye icon ("This will take all
  events on that calendar away from view"), its colour is set from the sidebar, and "Any database with a date property
  can be added" (d, [calendars][notion-cal]).

### 2.6 Linear

- **Timeline:** projects only; week, month, quarter or year; "Group projects by Initiatives"; milestones,
  dependencies, status and health as display options; team cycles as an overlay (d, [timeline][linear-timeline]).
- **Milestones:** the diamond "will change depending on the completion status"; "drag milestones on the timeline to
  your preferred date, select multiple or hold shift to drag all" (d, [milestones][linear-milestones]).
- **Dependencies:** end-to-start only, drawn from a circle at the bar's end; blue when kept, red "that has been
  violated"; a drag bumps planned projects in the chain, `Cmd/Ctrl` keeps the chain, `Shift` moves all (d,
  [dependencies][linear-deps]). "Projects that have already started will remain in place"; "contextual legend hints
  for shortcuts when dragging" (d, [2024-08][linear-cl-deps]).
- **Projection:** "Move the project to adjust the start date, extend or shorten the project length"; a red estimate
  when a project "is or is projected to take longer than the defined target date" (d, [changelog][linear-cl-2021],
  2021, may be outdated). Dates may be broad: "next month, quarter, or year" (d, [timeframes][linear-cl-timeframes]).

### 2.7 Asana

Asana's help centre renders in the browser only; WebFetch and `curl` got navigation without the article body. From
the search engine's copy of [How to use Asana Timeline][asana-timeline] and [timeline view][asana-timeline-view]
(s): bars run from start to due date; drag a bar left or right to change both dates, drag an edge to change the
duration; dependencies are drawn from a connector circle on the bar; "Mark as milestone" shows a diamond; Layout
options can highlight the critical path in yellow. Dependent-task auto-shift options were not readable.

### 2.8 Jira

- **Space timeline:** "select the entire schedule bar and drag it forwards or backwards"; "drag the handles at either
  end"; children "move with it"; click the empty timeline "to add a schedule bar" (d, [edit][jira-edit]). Today is an
  orange vertical line; "Schedule bar colors represent the status"; parent progress comes from its children (d,
  [timeline][jira-timeline]). A new kanban bar is 7, 14 or 30 days long by zoom (s, [kanban][jira-kanban]).
- **Plans (Premium):** changes stay "in a draft state until you're ready to save them", to "explore different planning
  outcomes without effecting existing work items"; a modal saves or discards them (d, [save][jira-save]). The
  auto-scheduler shows "Preview results", lets you "compare the current values against the suggested changes", then
  "Accept changes" (d, [auto-schedule][jira-auto]). Warnings include a child outside its parent and an open item past
  its end date (d, [warnings][jira-warn]); conflicting dependency lines turn red (s, [dependencies][jira-deps]).

### 2.9 monday.com

- **Gantt** (updated 2026-11-17): a list at the left, the hovered row highlighted; "Label by"; "Color By" with a
  legend; a "group summary" bar; "Auto Fit"; groups collapse with Ctrl + G; "The blue bar running vertically through
  the Gantt indicates today's date"; diamonds for milestones; a click opens the item card (d, [Gantt][monday-gantt]).
- **Editing:** "drag it the exact number of days it has been delayed"; dependents shift; "Any changes will
  automatically be applied". A baseline is "a gray snapshot that remains locked in position"; a delayed item "turns
  red along with any dependent items" (d, [Gantt][monday-gantt]).
- **Timeline widget** (updated 2026-10-02): a dashboard shows "timelines from multiple projects in one place"; in
  Deadline Mode a milestone done on time is green and an overdue one red (d, [Timeline widget][monday-timeline]).
- **Dependencies:** Flexible, Strict or No action; after a batch change, "Undo" in the pop-up, or later from the
  Activity log (d, [dependencies][monday-deps]).

### 2.10 ClickUp

- **Gantt** (updated 2026-10-29): a hierarchy sidebar at the left; non-working days grey; diamonds for milestones;
  colour by status, priority or List; big views start collapsed (d, [Gantt][clickup-gantt]).
- **The List bar is a lane with progress:** it runs from "the earliest start date and latest due date", filled by
  "tasks completed divided by the total tasks". **Dragging it moves everything inside:** "drag the progress bar left
  or right" to remap all its tasks, and then the scheduling rules "will not be applied" (d, [Gantt][clickup-gantt]).
- **Tasks:** drag to another date; "drag the right end of a task to adjust the due date"; dependents move "by the
  same number of days"; in Gantt "only visible tasks and their dependencies are rescheduled" (d,
  [rescheduling][clickup-resched]).

### 2.11 Gantt libraries

- **dhtmlx Gantt:** drags move, resize from the start or the end, or change progress; `onBeforeTaskDrag` returning
  false denies a drag; `onTaskDrag` can "limit the area for dragging"; project tasks "are not draggable by default"
  and `drag_project` (PRO) enables them, with an example that drags children along (d, [drag][dhx-dnd]). Keyboard:
  Up/Down rows, arrows over cells, Space selects, "Enter - open the lightbox", "Ctrl+Z - undo the action",
  "Ctrl+R - redo the action"; no key moves or resizes a bar (d, [keyboard][dhx-keys]). "WAI-ARIA attributes in Gantt
  are enabled by default"; black and white high-contrast skins (d, [accessibility][dhx-a11y]).
- **Frappe Gantt:** `readonly`, `readonly_dates`, `readonly_progress`; `snap_at` default `1d`; `view_mode` Day, Week,
  Month, Year; `today_button` true; `scroll_to` today; `bar_height` 30 and `padding` 18 (px); `popup_on` click;
  `infinite_padding`; `move_dependencies` true; `auto_move_label`: "Move task labels when user scrolls horizontally";
  weekends highlighted (d, [README][frappe]).
- **Bryntum Gantt:** the API guides render in the browser only and were not read. Its changelog: 7.3.6 (2026-09-11)
  "Event bars in Scheduler and task bars in Gantt need role="button""; 8.0.0 (2026-11-03) "Time axis cells need an
  aria-owns link which references all event bars owned by that cell"; 7.3.5 added demos of "customized task, drag,
  resize and avatar tooltips" (d, [changelog][bryntum-cl]).

### 2.12 What could not be verified

- Asana's article bodies (section 2.7) and Jira's kanban bar lengths and red dependency lines: (s) only.
- The time scale of classic Outlook's Schedule View, and how Google Calendar draws multi-day events: (k).
- How any product draws a bar that runs past the visible range: none of the pages read describe it. Frappe keeps
  labels in view (`auto_move_label`); monday avoids the case with Auto Fit (d).
- Whether Planner's Timeline lets a milestone be dragged, and what any product shows in a tooltip during a drag:
  not documented on the pages read (Bryntum only names drag tooltip demos).

## 3. Accessibility

### 3.1 What WCAG 2.2 requires

- **2.5.7 Dragging Movements (AA):** "All functionality that uses a dragging movement for operation can be achieved
  by a single pointer without dragging", unless dragging is essential. Its examples: a kanban card selected with one
  tap and moved with an arrow button; a sortable list whose item shows move up/down controls; a slider whose track can
  be tapped. "achieving keyboard equivalence for a dragging operation does not automatically meet this success
  criterion": keyboard is judged separately under 2.1.1 (d, [2.5.7][wcag-257]). Moving a lane by dates is not
  essential, so a tap path is required.
- **2.5.8 Target Size (Minimum) (AA):** "at least 24 by 24 CSS pixels", or spaced so 24 px circles around undersized
  targets do not intersect another target, or an equivalent control elsewhere on the page meets it. Sliders "are
  considered one target"; overlapping areas do not count; "For important links/controls, consider aiming for the
  stricter 2.5.5 Target Size (Enhanced)" (d, [2.5.8][wcag-258]), which is "at least 44 by 44 CSS pixels", AAA (d,
  [2.5.5][wcag-255]). A 24 px row with an end handle and a
  diamond inside it only passes if their hit areas do not overlap: give each its own 24 px and keep them apart, or rely
  on the equivalent control (the popover in 3.3).
- **2.5.2 Pointer Cancellation (A):** completion on the up-event with a way to abort or undo. For drag and drop,
  "Releasing the pointer outside the drop target area reverts the action" (d, [2.5.2][wcag-252]). Escape during a
  drag and Undo after it cover this.
- **2.3.3 Animation from Interactions (AAA):** "Motion animation triggered by interaction can be disabled, unless the
  animation is essential"; technique C39 uses `prefers-reduced-motion` (d, [2.3.3][wcag-233]). The media feature's
  `reduce` means the user prefers "an interface that removes or replaces the types of motion-based animation" (d,
  [Media Queries 5][mq5], Working Draft 2026-02-19).

### 3.2 What WAI-ARIA offers

- **There is no drag-and-drop pattern.** The APG list has Slider, Slider (Multi-Thumb), Spinbutton, Grid, Toolbar,
  Dialog and others, and no drag-and-drop (d, [patterns][apg-patterns]). `aria-grabbed` and `aria-dropeffect` are
  "[Deprecated in ARIA 1.1]" (d, [WAI-ARIA 1.2][aria12]). A drag is therefore exposed as the controls that do the same
  job.
- **Slider:** role `slider` on the thumb, "Focus is placed on the slider (the visual object that the mouse user would
  move …)"; Right/Up and Left/Down by one step, Home/End to the first/last allowed value, Page Up/Down (optional) by a
  larger step; `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext` when the number is not friendly
  (its example: a day of the week as "Monday"); label by `aria-labelledby` or `aria-label` (d, [slider][apg-slider]).
- **Multi-thumb slider:** "Each element serving as a focusable slider thumb has role slider"; thumbs usually cannot
  pass each other, so a thumb's `aria-valuemin`/`aria-valuemax` follow the other thumb's value; "The tab order remains
  constant regardless of thumb value and visual position" (d, [multi-thumb][apg-multi]). A lane's start, finish and
  deadline fit this: start ≤ finish, and the deadline is a separate thumb.
- **Spinbutton:** "restricts its value to a set or range of discrete values"; Up/Down, Home/End, optional Page
  Up/Down; `aria-valuetext` (d, [spinbutton][apg-spin]). Fits "move by N days".
- **Date picker dialog example:** arrows by day and week, Page Up/Down by month, Shift+Page Up/Down by year,
  Home/End to the week's ends, Enter or Space selects, Escape closes (d, [date picker][apg-date]).

### 3.3 Touch and feedback

- **Sizes:** Apple's default control size on iOS is 44 × 44 pt, minimum 28 × 28 pt; "Consider spacing between
  controls as important as size", about 12 pt of padding around bezelled elements and 24 pt around others (d,
  [HIG accessibility][hig-a11y]).
- **Alternatives and feedback:** "Offer alternative ways to accomplish drag-and-drop actions", for example menu
  commands; "provide clear and continuous feedback throughout"; "Display a drag image as soon as people drag a
  selection about three points"; "a translucent representation" so people "see destinations as they pass over them"
  (d, [HIG drag and drop][hig-dnd]). For motion: reduce automatic and repetitive animation and prefer "Tracking
  animations directly with people's gestures" (d, [HIG accessibility][hig-a11y]).
- **Long-press to start a drag** on touch is the platform convention on iOS and Android (k); the HIG page read says
  only that iOS supports drag and drop "through gestures on the touchscreen" (d).

### 3.4 The pattern, concretely

| Part | Role and name | Pointer | Keyboard | Non-drag alternative |
| --- | --- | --- | --- | --- |
| Lane | `role="group"`, name: "<calendar>, <first> – <finish>, deadline <date>, <n> days spare" | — | Tab enters its controls in a fixed order | — |
| Lane body | `button` (as Bryntum now does for bars), "Move <calendar>" | Drag = move; tap = popover | Enter/Space opens the popover | Popover: days spinbutton (− / +), result line, Apply, "Open in Reschedule" |
| Finish handle | `slider`, `aria-valuetext` = localized date, min = start, max = range end | Drag | ←/→ one day, Page Up/Down one week, Home/End bounds; Enter commits, Escape reverts | Same popover, "Finish by" date field |
| Deadline diamond | `slider` or `button`, "Deadline <date>" | Drag | As above, or Enter opens a date picker | Date field + "Re-balance to this deadline" |
| Feedback | Live text (`aria-live="polite"`) or the slider's own value text | Tooltip with dates | Value text announced | The popover's result line |

One deviation from the APG slider must be deliberate: the slider changes value on every key press, but here each
commit is a history step, so arrows move an uncommitted ghost (reflected in `aria-valuenow`/`aria-valuetext`) and
Enter commits. Say so in the accessible description.

## 4. Recommendations for this planner

The planner today has, directly under `PlannerHeader`, the read-only `Runway` for the calendar with the nearest
deadline (`modules/planner/src/widgets/runway/ui/Runway.tsx`), then the toolbar. `PageHeader` is sticky from `md`
up; on a phone only the sections bar stays, "or the title would take a fifth of the screen along"
(`packages/ui/src/page-header.tsx`). The Reschedule dialog has Move (`events.shift`: calendar, from, days, hours) and
Re-balance (`RebalanceRequest`: calendar, from, deadline, target pace or deadline), shows a preview and warnings, and
stores the result as one undoable step; a deadline typed there is stored as the milestone, its own step
(`docs/rebalancing.md`).

### 4.1 Showing

1. **Place the lanes under the header, scrolling with the page, where the runway is now.** Microsoft Project puts its
   timeline "above the current view", between its commands and the work (d, [Project][ms-project-timeline]); none of
   the pages read describes a pinned lane strip. Do not make the lanes sticky: six lanes cost 150–250 px, and the
   header comment already refuses a fifth of a phone screen. "Above the header" can be a setting (4.4), but on a
   desktop it pushes the title and actions down until the page scrolls, so it should not be the default.
2. **Sizes.** At 1280 px: a 24 px row per lane (2.5.8 minimum), a 10 px bar centred in it, a 12 px diamond with its
   own 24 px hit area, a 20 px date axis: six lanes ≈ 170 px, about the runway's height. The time axis gets
   ≈ 1100 px after a 140 px name column, about 9 px per day over four months, so day-precise dragging works. At
   390 px: a 36 px row (name line above an 8 px bar), the full width of ≈ 366 px, about 3 px per day: too fine to drag
   to a day, so the tap path is the main one there (4.3). Frappe's full-row default (30 px bar + 18 px padding) is the
   Gantt look this should not copy (d, [Frappe][frappe]).
3. **Labels.** On a desktop, a left column with the colour dot and the calendar's name, as every Gantt read does
   (monday, ClickUp, Jira, Notion), truncated with the full name in the lane's accessible name. On a phone, the name
   above the bar, starting at the bar's start but kept inside the screen when the bar starts off-range, as Frappe's
   `auto_move_label` does (d, [Frappe][frappe]).
4. **Colour, past and ahead.** The calendar's colour, as monday's "Color by group" and ClickUp's "List" colour (d).
   Draw the sessions at their dates inside the bar: done ones solid, open ones in the lighter tint the runway already
   uses, past ones not done outlined in the warning colour. This shows progress on the time axis itself, which a
   ClickUp-style "done ÷ total" fill cannot (d, [ClickUp][clickup-gantt]); add the done count to the accessible name.
5. **Deadline.** A diamond at the deadline day, as in Project, monday, ClickUp, Linear and Asana (s). Keep the
   runway's hatched spare days between the last session and the deadline; when the last session falls after the
   deadline, draw that overflow in the danger colour, as monday turns an overdue milestone red and Linear a late
   projection red (d, [monday][monday-timeline], [Linear][linear-cl-2021]). A calendar with no deadline ends at its last
   session, with no diamond.
6. **Today.** One vertical line through all lanes in the existing `today` colour, labelled once on the axis, as
   monday's blue bar and Jira's orange line (d). Hide it when today is outside the range.
7. **Range.** Fit all shown lanes by default, from the earlier of a week ago and the first session to the latest
   deadline, like monday's Auto Fit (d). Offer at most two more ranges ("from today", "next 8 weeks") instead of free
   zoom. When a range cuts a bar, end it at the edge with a fade and keep the label (no product documents this; it is
   a suggestion).
8. **Link to the runway.** The lanes are the overview, the runway the detail. Let selecting a lane show that calendar
   in the runway instead of only the nearest deadline (a suggestion; no source covers it).

### 4.2 Editing

9. **Dragging the whole lane is Move.** It shifts the calendar's open sessions from today by whole days: an
   `events.shift` with `calendar`, `from` and `days`, the same change the dialog builds. Done and past sessions stay,
   as Linear leaves started projects in place (d, [Linear][linear-cl-deps]); ClickUp's List drag and Jira's parent
   drag move everything inside (d), which is the shift's job here. While dragging: the original stays as a grey
   baseline (monday's "gray snapshot", d), a translucent ghost follows the pointer (HIG, d), snapped to days (Frappe
   `snap_at: 1d`, d), with a tooltip "+5 days · ends 25 Jan · 6 days before the deadline" (Fluent: a value tooltip
   readable by screen readers, d). On drop, run `previewUpdate`: with no warnings, store it at once as one history
   step and show "Moved 12 sessions by 5 days · Undo", as monday offers Undo right after a batch change and dhtmlx
   binds Ctrl+Z (d); with warnings (budget, holidays, past the deadline), open the Reschedule dialog in Move mode
   with the calendar and days filled in, so the warnings are seen before anything is stored. Hours are not
   draggable; they stay in the dialog.
10. **Dragging the finish is Re-balance, always previewed.** Moving the last session earlier or later asks for a new
    rhythm, which the solver decides. Treat it as Jira treats auto-scheduling: preview, then accept (d,
    [auto-schedule][jira-auto]). During the drag show only the target date; on drop open Reschedule in Re-balance mode
    "towards" that date, showing the finish, heaviest week and moves as it does now. Gap: `RebalanceRequest` has no
    "finish by" target separate from the deadline, and the dialog stores a typed deadline as the milestone. Either add
    a target such as `{ mode: 'date', day }` (touching `rebalance/types.ts`, the dialog and the MCP
    `rebalance_calendar` tool together), or ship without a finish handle at first and reach Re-balance from the
    deadline (11).
11. **Dragging the deadline changes only the milestone.** It is the dialog's deadline step on its own: one change,
    applied on drop with Undo. No session moves, as Linear's milestones drag independently of the project (d,
    [Linear][linear-milestones]). If the last session is now after the deadline, the overflow turns red (5) and the
    toast offers "Re-balance to this deadline", which opens the dialog prefilled. Never re-balance automatically: one
    drag would move many sessions without the preview Re-balance always shows, and monday and Notion make even
    simple shifting an opt-in mode (d, [monday][monday-deps], [Notion][notion-deps]).
12. **No start handle in the first version.** Starting later while keeping the finish is a re-balance from a later
    `from`, and starting later while keeping the length is a Move; the lane body and the dialog already cover both.
    Add a start handle only for a calendar with no session done, and route it to Re-balance with `from` filled in.
13. **Escape cancels any drag; dropping back on the origin is a no-op** (2.5.2, d). Each drop is at most one history
    step (two when a deadline step and moves go together, as the dialog already stores them in order).

### 4.3 Keyboard, screen reader, touch, motion

14. **A tap or click on a lane opens a popover**, the single-pointer alternative 2.5.7 asks for (d): "Move by"
    spinbutton with − / + buttons (APG spinbutton, Fluent Spin button), a "Finish by" and a "Deadline" date field
    (APG date picker keys), a result line, Apply, and "Open in Reschedule". This is the Project for the web and
    dhtmlx route (a form behind Enter), made the primary path on a phone.
15. **Keyboard on the lane itself** per 3.4: Tab order lane body → finish → deadline → next lane, fixed (APG
    multi-thumb, d); arrows a day, Page Up/Down a week, Home/End the range; Enter commits, Escape reverts;
    `aria-valuetext` is the date from `@lc/i18n/format`, never a number.
16. **Touch:** a drag starts only after a long press (k), so a swipe still scrolls the page; the lane body is the
    44 px target on a phone (HIG default, WCAG 2.5.5), handles and the diamond at least 24 × 24 CSS px with their hit
    areas apart (2.5.8, d). Show the date tooltip above the finger, not under it.
17. **Reduced motion:** under `prefers-reduced-motion: reduce`, no animated snapping, no animated scroll to today and
    no settle animation after a drop; the ghost tracks the pointer one to one, which the HIG names as the
    reduced-motion practice (d, [HIG][hig-a11y], [2.3.3][wcag-233]).

### 4.4 Choosing position and calendars

18. **One "Timeline" setting with three values: Below the header (default), Above the header, Hidden.** Put it where
    monday keeps "Visual settings" and ClickUp "Layout options": a small view-settings popover on the lanes' own
    corner, also reachable from the `⋮` menu (d, [monday][monday-gantt], [ClickUp][clickup-gantt]).
19. **Which calendars:** a checklist with colour swatches in the same popover, like Notion Calendar's eye icon and
    Outlook's calendar checkboxes (d, [Notion Calendar][notion-cal], [Outlook][ms-multi]). Default: every calendar
    with open sessions or a deadline ahead. On a phone show at most three lanes and a "+3 more" disclosure, the
    collapsed-group idea from monday, ClickUp and Sheets (d).
20. **Store both per device** (a phone may want the lanes hidden while the laptop shows them), in `localStorage`
    wrapped in `try`/`catch`, defaulting to the values above when it is empty. They are view preferences, not plan
    edits, so they stay out of `edits.json` and history. Every new string goes into the three message files.

## 5. Sources

Microsoft: [Outlook views][ms-views] · [multiple calendars][ms-multi] · [Outlook on the web][ms-web-multi] ·
[board view][ms-board] · [calendar groups][ms-groups] · [Planner premium][ms-premium] ·
[Planner schedule view][ms-planner-schedule] · [Project for the web][ms-p4w-build] · [milestone][ms-milestone] ·
[Project screen reader][ms-p4w-sr] · [Project timeline][ms-project-timeline] · [Loop][ms-loop] ·
[Fluent slider][fluent-slider] · [Fluent components][fluent-components].
Google: [Calendar views][g-views] · [Sheets timeline, create][g-sheets-create] · [Sheets timeline, use][g-sheets-use].
Notion: [timelines][notion-timeline] · [dependencies][notion-deps] · [Notion Calendar][notion-cal].
Linear: [timeline][linear-timeline] · [milestones][linear-milestones] · [dependencies][linear-deps] ·
[changelog 2024-08][linear-cl-deps] · [changelog 2021][linear-cl-2021] · [changelog 2024-01][linear-cl-timeframes].
Asana: [timeline][asana-timeline] · [timeline view][asana-timeline-view].
Atlassian: [edit][jira-edit] · [timeline][jira-timeline] · [kanban][jira-kanban] · [plan dates][jira-plan-dates] ·
[save][jira-save] · [auto-schedule][jira-auto] · [warnings][jira-warn] · [dependencies][jira-deps].
monday.com: [Gantt][monday-gantt] · [Timeline widget][monday-timeline] · [dependencies][monday-deps].
ClickUp: [Gantt][clickup-gantt] · [rescheduling][clickup-resched] · [milestones][clickup-milestones].
Libraries: [dhtmlx drag][dhx-dnd] · [dhtmlx keyboard][dhx-keys] · [dhtmlx accessibility][dhx-a11y] ·
[Frappe Gantt][frappe] · [Bryntum changelog][bryntum-cl].
W3C and Apple: [APG patterns][apg-patterns] · [slider][apg-slider] · [multi-thumb slider][apg-multi] ·
[spinbutton][apg-spin] · [date picker dialog][apg-date] · [WAI-ARIA 1.2][aria12] · [2.5.7][wcag-257] ·
[2.5.8][wcag-258] · [2.5.5][wcag-255] · [2.5.2][wcag-252] · [2.3.3][wcag-233] · [Media Queries 5][mq5] · [HIG drag and drop][hig-dnd] ·
[HIG accessibility][hig-a11y].

[ms-views]: https://support.microsoft.com/en-us/office/change-how-you-view-your-calendar-a4e0dfd2-89a1-4770-9197-a3e786f4cd8f
[ms-multi]: https://support.microsoft.com/en-US/Outlook/calendar/view-multiple-calendars-at-the-same-time-in-outlook
[ms-web-multi]: https://support.microsoft.com/en-us/outlook/working-with-multiple-calendars-in-outlook-on-the-web
[ms-board]: https://support.microsoft.com/office/organize-things-your-way-with-the-calendar-board-view-in-outlook-on-the-web-611ef33f-7a13-4631-a597-b5657cc19085
[ms-groups]: https://support.microsoft.com/en-us/outlook/create-view-or-delete-a-calendar-group
[ms-premium]: https://support.microsoft.com/en-us/office/6cdba2aa-da06-4e08-be4c-baaa4fda17ba
[ms-planner-schedule]: https://support.microsoft.com/en-US/Planner/training/use-schedule-view-in-microsoft-planner
[ms-p4w-build]: https://support.microsoft.com/en-us/office/build-a-project-in-grid-and-timeline-views-b01443f4-0e85-4952-b1f2-f4b55e4a90be
[ms-milestone]: https://support.microsoft.com/en-us/office/add-a-milestone-583be27b-1659-4a7a-a047-e9b9cb6a4834
[ms-p4w-sr]: https://support.microsoft.com/en-us/Accessibility/project/use-a-screen-reader-to-work-with-the-timeline-view-in-project
[ms-project-timeline]: https://support.microsoft.com/en-us/project/create-a-timeline-in-project
[ms-loop]: https://techcommunity.microsoft.com/t5/microsoft-365-insider-blog/board-visualization-for-loop-tables/ba-p/4223705
[fluent-slider]: https://fluent2.microsoft.design/components/web/react/core/slider/usage
[fluent-components]: https://fluent2.microsoft.design/components/web/react
[g-views]: https://support.google.com/calendar/answer/37189
[g-sheets-create]: https://support.google.com/docs/answer/12935277?hl=en
[g-sheets-use]: https://support.google.com/docs/answer/12934572?hl=en
[notion-timeline]: https://www.notion.com/help/timelines
[notion-deps]: https://www.notion.com/help/tasks-and-dependencies
[notion-cal]: https://www.notion.com/help/manage-your-calendars-and-events
[linear-timeline]: https://linear.app/docs/timeline
[linear-milestones]: https://linear.app/docs/project-milestones
[linear-deps]: https://linear.app/docs/project-dependencies
[linear-cl-deps]: https://linear.app/changelog/2024-08-08-project-dependencies
[linear-cl-2021]: https://linear.app/changelog/2021-05-27-linear-preview-roadmap-timeline
[linear-cl-timeframes]: https://linear.app/changelog/2024-01-17-project-timeframes
[asana-timeline]: https://help.asana.com/s/article/plan-and-execute-projects-with-timeline?language=en_US
[asana-timeline-view]: https://help.asana.com/s/article/timeline?language=en_US
[jira-edit]: https://support.atlassian.com/jira-software-cloud/docs/edit-and-reorder-work-items-on-the-timeline/
[jira-timeline]: https://support.atlassian.com/jira-software-cloud/docs/what-is-the-timeline-and-how-do-i-use-it/
[jira-kanban]: https://support.atlassian.com/jira-software-cloud/docs/schedule-work-for-kanban-teams-on-your-roadmap/
[jira-plan-dates]: https://support.atlassian.com/jira-software-cloud/docs/schedule-issues-in-advanced-roadmaps-using-start-end-dates/
[jira-save]: https://support.atlassian.com/jira-software-cloud/docs/save-changes-made-in-advanced-roadmaps/
[jira-auto]: https://support.atlassian.com/jira-software-cloud/docs/auto-schedule-issues-on-your-advanced-roadmaps-timeline/
[jira-warn]: https://support.atlassian.com/jira-software-cloud/docs/troubleshoot-warnings-on-your-timeline-in-advanced-roadmaps/
[jira-deps]: https://support.atlassian.com/jira-software-cloud/docs/change-how-advanced-roadmaps-displays-dependencies/
[monday-gantt]: https://support.monday.com/hc/en-us/articles/360015643840-The-Gantt-Chart-View-and-Widget
[monday-timeline]: https://support.monday.com/hc/en-us/articles/360017206280-The-Timeline-Widget
[monday-deps]: https://support.monday.com/hc/en-us/articles/360007402599-Dependencies-on-monday-com
[clickup-gantt]: https://help.clickup.com/hc/en-us/articles/6310249474967-Create-and-share-a-Gantt-view
[clickup-resched]: https://help.clickup.com/hc/en-us/articles/6304547785367-Rescheduling-dependencies
[clickup-milestones]: https://help.clickup.com/hc/en-us/articles/6304458574615-Milestones
[dhx-dnd]: https://docs.dhtmlx.com/gantt/guides/dnd/
[dhx-keys]: https://docs.dhtmlx.com/gantt/guides/keyboard-navigation/
[dhx-a11y]: https://docs.dhtmlx.com/gantt/guides/accessibility/
[frappe]: https://github.com/frappe/gantt/blob/master/README.md
[bryntum-cl]: https://bryntum.com/products/gantt/changelog/
[apg-patterns]: https://www.w3.org/WAI/ARIA/apg/patterns/
[apg-slider]: https://www.w3.org/WAI/ARIA/apg/patterns/slider/
[apg-multi]: https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/
[apg-spin]: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
[apg-date]: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/
[aria12]: https://www.w3.org/TR/wai-aria-1.2/
[wcag-257]: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
[wcag-258]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[wcag-255]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
[wcag-252]: https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html
[wcag-233]: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
[mq5]: https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion
[hig-dnd]: https://developer.apple.com/design/human-interface-guidelines/drag-and-drop
[hig-a11y]: https://developer.apple.com/design/human-interface-guidelines/accessibility
