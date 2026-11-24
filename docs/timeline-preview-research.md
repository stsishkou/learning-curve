# Timeline changes you can see: preview, compare, commit, and a page of its own

Fetched 2026-11-23, 17:50–18:40 UTC (20:50–21:40 Europe/Minsk). Only first-party pages were used: vendors' help
centres, release notes and design-system docs, library API docs and demo source, W3C, MDN and Apple developer docs.
monday.com and ClickUp articles were read through their public Help Center API
(`/api/v2/help_center/en-us/articles/<id>.json`); Bryntum's API pages render in the browser only, so they were read
from the vendor's Markdown copies (`/products/gantt/docs-llm/<path>.md`, listed in its `llms.txt`). Every claim is
followed by the page it was read from.

The question: the owner says dragging on the timeline lanes "doesn't feel like it works" and that "it is not clear
what would change, how it looks now, and how it will look". How do scheduling, planning and Gantt products make a
change transparent before and after it is made, and what does a dedicated timeline page in them look like?

This builds on `docs/calendar-timeline-research.md` (lane layout, density, milestones, drag basics, WCAG 2.5.7,
2.5.8, 2.5.2, 2.3.3, the APG slider pattern, Apple's drag guidance). Those findings are referenced, not repeated.

Legend: **(d)** = documented on the linked first-party page, read here; **(s)** = the page could not be read, the
claim comes from a search engine's copy of it; **(k)** = my general knowledge, not re-verified. Treat (s) and (k)
as leads. Section 7 lists what could not be verified.

## 1. Recommended pattern, ranked

1. **Keep "now" on screen while showing "after".** During a drag the original lane stays in place, dimmed, and a
   ghost shows the result: Atlassian's rule is "the original item should stay in place and dim to 40% opacity"
   ([ADS][ads-dnd]); monday, TeamGantt, ClickUp, MS Project's Tracking Gantt, Bryntum, dhtmlx and Syncfusion all
   draw an old plan as a second, muted bar beside the current one, grey in monday and TeamGantt (section 3.1). Draw
   the ghost of **every session that will move**, not only the bar: MS Project's change highlighting marks "all
   that is impacted by your change" ([Project][ms-change-hl]).
2. **Say the result in words next to the pointer.** A drag tooltip with the new dates and the delta: Bryntum's
   `tooltipTemplate` on drag and resize ([TaskDrag][bry-taskdrag], [TaskResize][bry-resize]), Syncfusion's editing
   tooltip with start, end, duration and progress (s, [Syncfusion][sf-tooltip]), Notion's "date indicators appear to
   guide you" on edge drags ([Notion][notion-timeline]). Here: "+1 week · 12 sessions · ends 10 Feb · 4 days before
   the deadline". Snap the ghost to where it will land, as Bryntum's `showExactDropPosition` does
   ([DragBase][bry-dragbase]).
3. **Two commit paths, chosen by what the change is.** A direct move of one thing (Move, Deadline) is applied at once
   with Undo, as monday ("Any changes will automatically be applied") and Atlassian's "optimistic update" guidance
   do; Jira's timeline describes no confirm step ([monday][monday-gantt], [ADS][ads-dnd], [Jira][jira-edit]). A
   change a solver computes (Re-balance) is staged: Jira Plans keeps edits "in a draft state until you're ready to
   save them" and its auto-scheduler shows "Preview results" before "Accept changes"; Reclaim stages every AI or
   bulk change in "Preview Mode" with "Review & apply changes" or "Discard changes" ([Jira save][jira-save],
   [Jira auto][jira-auto], [Reclaim][rc-faq]).
4. **Stage the re-balance on the timeline itself, not in a dialog over it.** Reclaim runs its automations "against
   the preview calendar so you can see the full cascading impact" ([Reclaim][rc-faq]); Jira's preview lets you "hover
   on a field to compare the current values against the suggested changes" ([Jira auto][jira-auto]). Here: dropping
   the finish handle draws the solver's sessions as ghosts on the lane, with a bar "Re-balance preview · 9 sessions
   move · ends 10 Feb · Apply / Discard / Adjust…" where "Adjust…" opens the existing dialog.
5. **After a commit, show what changed, briefly and then on demand.** Flash the changed lane (Atlassian: background
   flash, 700 ms, [ADS][ads-dnd]); keep a "changed" mark on moved sessions until the next change, as MS Project's
   highlighting "will persist until you make another change or save" ([Project][ms-change-hl]); the Undo bar names
   the result ("Moved 12 sessions by 1 week"), and the same text goes to a live region ([ADS a11y][ads-a11y],
   [WCAG 4.1.3][wcag-413]).
6. **A "Changes" list with old → new per session.** Project for the web's task history shows "who made the change,
   when they made it, what property was changed, the previous value, and the new value", including changes made to
   other tasks that moved this one ([Project for the web][ms-p4w-history]); Jira lists changes by item with a count in
   "What changed" and lets you save a selection ([Jira save][jira-save]). The domain already computes this
   (`PlanDiff` in `packages/plan-domain/src/diff.ts`, returned by `previewUpdate`).
7. **"Compare with…": a baseline on demand, with variance labels.** Pick a history step (or "start of week") and
   draw it as grey bars under the lanes with "+7 d" per lane: monday adds a column with "the difference in days",
   TeamGantt a column of "how many days ahead or behind", Smartsheet a "Variance" column, Bryntum
   `End Variance = End - Baseline End`, and Bryntum's Versions demo turns a compared version into baseline bars
   ([monday][monday-baseline], [TeamGantt][tg-baselines], [Smartsheet][ss-baselines], [Bryntum][bry-variance],
   [demo][bry-versions-demo]). `PlanHistory` already holds the snapshots.
8. **Changes made while the person was away get a "since your last visit" highlight.** The plan is also changed by
   the AI chat and MCP tools; Smartsheet's "Last time I viewed the sheet" highlights "the changes made since you last
   opened it", per user ([Smartsheet][ss-highlight]).
9. **The dedicated page:** a sticky header with a range control (weeks / months / quarter), Fit and Today; a sticky
   name column that can collapse; one row per course with hover highlight; arrows on rows whose bar is off-screen;
   a side panel on selection that holds the form (the non-drag path) and the course's change list. Every element
   here is in Jira, monday, ClickUp, Notion or Linear (section 5).
10. **Make drag discoverable, and do not make it the only way.** `grab` cursor and hover background on the bar,
    resize handles that appear on hover and focus with `ew-resize`, 24 px targets, a legend of modifier keys while
    dragging (Linear), and a menu with "Move by…" items for keyboard and screen-reader users (Atlassian) (section 6).
    On a phone, read first: ClickUp and monday do not ship their Gantt on mobile ([ClickUp][clickup-mobile],
    [monday][monday-mobile]).

## 2. Previewing a change before it is stored

### 2.1 Feedback during the drag

| Product | Original kept? | Ghost / live | Words during drag | Snap | Other |
| --- | --- | --- | --- | --- | --- |
| Atlassian Design System | Yes, "dim to 40% opacity" (d) | Drag preview: "a maximum of three pieces of information", ≤ 280 × 280 px, 16 px right and 8 px below the pointer, "Do not rotate" (d) | — | — | Cursor is `default` during a native drag, "limited control" (d) |
| Bryntum Gantt | Not stated | Resize "updates the event's `endDate` live", in "batched mode" so nothing syncs "until the operation is completed" (d) | Tooltip on drag and resize, `tooltipTemplate` (d) | `showExactDropPosition`: snaps "to the exact start date that it will have after drop" (d) | `validatorFn` can return a message shown while dragging; Ctrl pins dependent tasks (`pinSuccessors`) (d) |
| Syncfusion Gantt | — | — | Editing tooltip with updated start, end, duration, progress (s) | — | `aria-grabbed` on taskbars while editing (d; deprecated in ARIA 1.1, see the earlier doc) |
| Notion timeline | — | — | "date indicators appear to guide you" when an edge is dragged (d) | — | "Your cursor will indicate that you can drag" on edge hover (d) |
| Linear | — | — | "contextual legend hints for shortcuts when dragging" (d, earlier doc) | — | Shift drags all milestones; Cmd/Ctrl keeps the chain (d, earlier doc) |
| Jira timeline, monday, ClickUp | Not described | Not described | Not described | monday: "drag it the exact number of days" (d) | — |

Sources: [ADS][ads-dnd], [TaskDrag][bry-taskdrag], [TaskResize][bry-resize], [DragBase][bry-dragbase],
[Syncfusion a11y][sf-a11y], [Syncfusion tooltip][sf-tooltip], [Notion][notion-timeline], [Linear][linear-cl-deps],
[monday][monday-gantt].

### 2.2 Showing the knock-on effects

- **Microsoft Project desktop, Change Highlighting** (since Project 2007): after an edit, "everything that also
  changed as a result … got highlighted: the finish date for my task, the following task that dependent on task 17,
  the inner and outer milestone summary tasks". It is meant to answer "Did this change cause a schedule slip? What
  other tasks will get impacted by the change? Should I make the change?" The highlight "will persist until you make
  another change or save the project", and with "multiple levels of undo" it supports "What-if" analysis (d,
  [Project blog, 2006][ms-change-hl]). It is a toggle (`EnableChangeHighlighting`) (d, [VBA][ms-vba-ch]).
- **Microsoft Project, Task Path:** select a task and highlight its predecessors, "Driving Predecessors" ("When the
  driving predecessor task moves, the selected task also moves"), successors and "Driven Successors"; "Remove
  Highlighting" clears it (d, [Task Path][ms-taskpath]). It shows *what would move* before anything is dragged.
- **Jira Plans auto-scheduler:** "Preview results" shows suggested changes; "Hover on a field to compare the current
  values against the suggested changes"; then "Accept changes"; then save. It "will not overwrite any data for work
  items in an active sprint" (d, [Jira auto][jira-auto]).
- **Reclaim Preview Mode** (Reclaim 2.0): "Changes are staged, not live, so attendees are not notified until you
  apply them"; "All enabled Agents … run against the preview calendar so you can see the full cascading impact";
  useful for "Bulk rescheduling"; entered by "the Preview Mode switch above the Planner calendar" or automatically by
  the AI Assistant; "Changes made through the AI Assistant or MCP integrations are first staged in Preview Mode" (d,
  [Reclaim FAQ][rc-faq], updated 2026-10-07).
- **Bryntum:** `beforeTaskDropFinalize` and `beforeTaskResizeFinalize` let the app set `context.async = true` "to
  show a confirmation popup" before the drop is finalized; holding Ctrl during a drag or resize pins dependent tasks
  so they stay put (`pinSuccessors`) (d, [TaskDrag][bry-taskdrag], [TaskResize][bry-resize]).
- **ClickUp:** dependants move "earlier or later by the same number of days"; in Gantt "only visible tasks and their
  dependencies are rescheduled"; the Gantt option can be turned off to reschedule by hand (d,
  [ClickUp][clickup-resched]).
  No preview of the cascade is documented.
- **Asana:** dependent dates shift by a project setting (maintain buffer, consume buffer, none) (s,
  [Asana][asana-shift]); the help centre body could not be read.
- **Auto-schedulers that change things on their own explain by status, not preview.** Motion: "If a deadline is at
  risk, Motion pushes the task earlier or flags it with an alert"; a task that cannot fit is flagged "Could not fit"
  (d, [Motion][mo-how]). Its ETAs mark tasks green "On Track", orange "Scheduled past deadline", red "Missed
  deadline"; hover the ETA icon "to see what's causing the issue … and get actionable suggestions" such as extending
  the deadline (d, [Motion blog, 2024-12-16][mo-eta]). Clockwise showed changes in an event's "History", emailed
  attendees when a flexible meeting moved, and marked meetings that will no longer move with ⏸ instead of ❇️ (s,
  [flexible][cw-flex], [pause][cw-pause]); Clockwise shut down: "Our product will no longer be available starting on
  March 27, 2026" (d, [Clockwise][cw-home]).

### 2.3 What-if, scenarios, sandboxes

- **Jira Plans** is a sandbox: "any changes you make won't be committed back to your Jira work items until you
  choose to do so" (d, [Jira auto][jira-auto]). **Scenarios** are "different 'what if' versions of your plan" (d,
  [scenarios][jira-scen]); a new one is blank (Jira data, no unsaved changes) or a copy of another; "Any changes you
  make in this scenario will be displayed with flags in the color you select"; a dropdown switches scenarios (d,
  [create][jira-scen-create]).
- **Bryntum Versions:** captures "a complete snapshot of the project data" plus "the list of changes in the
  changelog" since the last version; a `VersionGrid` lists versions and transactions, with `compare` and
  `stopCompare` events and `comparingVersionId` (d, [Versions][bry-versions], [VersionGrid][bry-versiongrid]). In the
  demo, comparing calls `versions.compareVersion(version)` and enables the Baselines feature, so the old version is
  drawn as baseline bars; restore asks for confirmation (d, [demo source][bry-versions-demo]).
- **Microsoft Project:** up to 11 baselines and 10 interim plans to compare against (d, [baseline][ms-baseline]).

## 3. Before and after

### 3.1 Baselines: the old plan drawn with the new

| Product | How the old plan is drawn | Variance shown as | How many, chosen how |
| --- | --- | --- | --- |
| MS Project, Tracking Gantt | "two task bars, one on top of the other … The lower bar shows baseline start and finish dates" (d) | Variance table: "the difference between the Baseline and Work fields" (d) | 11 baselines (d) |
| monday.com | "a gray shadow above the item in exactly the position it was in"; items green on time, red late, dependants red too; colour legend (d) | Auto-created formula column: "the difference in days" (d) | Several; tick to compare; "Hide" leaves baseline mode (d) |
| TeamGantt | "The light gray bar below the active taskbar"; hover shows its dates and % complete at capture (d) | "Baselines column will show how many days ahead or behind" (d) | "as many sets as you need", checkboxes (d) |
| ClickUp | Baseline "displayed under your tasks", colour per baseline; legend lower-right toggles each (d) | Not documented | Several; created date and time under each name (d) |
| Smartsheet | Baseline bars in Gantt, colour editable (d) | "Variance: The difference between the actual end date and the baseline end date" (d) | One per sheet (d) |
| Bryntum Gantt | "below the tasks in the timeline", tooltip on hover (d) | Start, end and duration variance columns: `End - Baseline End` (d) | Many per task (d) |
| dhtmlx Gantt | `render_mode`: `"taskRow"` (same row), `"separateRow"` (a subrow), `"individualRow"` (each baseline its own subrow) (d) | — | Many (d) |
| Syncfusion Gantt | `renderBaseline`, `baselineColor` (d) | — | One per task (d) |

Sources: [Project progress][ms-progress], [Project baseline][ms-baseline], [monday][monday-baseline],
[TeamGantt][tg-baselines], [ClickUp][clickup-baselines], [Smartsheet][ss-baselines], [Bryntum][bry-baselines],
[Bryntum variance][bry-variance], [dhtmlx][dhx-baselines], [Syncfusion][sf-baseline].

What they share: the old plan is grey and thin, the current plan keeps its colour; the difference is a signed number
of days, in a column or label, never only implied by bar positions; colour (green/red) is added only when the
difference is good or bad.

### 3.2 Highlighting what changed, and for how long

| Product | What is marked | How long |
| --- | --- | --- |
| MS Project desktop | Every cell changed by the last edit (d) | "until you make another change or save the project" (d) |
| Atlassian Design System | The moved item: background flash in `color.background.selected` (d) | 700 ms (d) |
| Bryntum | `highlightTasks()` "flashes every highlighted task" (d) | A flash (d) |
| Jira Plans | "unsaved changes markers in your plan"; scenario changes "displayed with flags in the color you select" (d) | Until saved or discarded (d) |
| Smartsheet | Cells edited in a window, in a chosen colour; a row icon for new comments or attachments (d) | 1 hour, 7 days, since "Last time I viewed the sheet", or custom; refreshed "down to the minute" (d) |

Sources: [Project][ms-change-hl], [ADS][ads-dnd], [Bryntum changelog][bry-cl] (7.3.4, 2026-07-22),
[Jira save][jira-save], [Jira scenarios][jira-scen-create], [Smartsheet][ss-highlight],
[Smartsheet Table View][ss-highlight-tv].

### 3.3 Lists of changes (old → new)

- **Project for the web, task history:** a "Changes pane in Task Details"; "For each edit, details are shown such as
  who made the change, when they made it, what property was changed, the previous value, and the new value";
  "Changes made to other tasks that impact either the start date or finish date of the selected task have a history
  record" (d, [Microsoft, 2023-07-28][ms-p4w-history]).
- **Jira Plans, Unsaved changes modal:** "Changes are listed by title. If there's multiple updates to a work item,
  the number of changes shows in the What changed column. Select the field in this column to view all of the
  changes"; filterable; "select the changes you'd like to save"; "Discard selected changes" (d, [Jira save][jira-save]).
  Whether the modal shows old and new values side by side is not stated.
- **dhtmlx undo stack:** each user action is a set of commands, each with `type`, `entity`, `value` and `oldValue`
  (d, [dhtmlx undo][dhx-undo]): enough to render a before/after list.
- **Bryntum changelog:** each user action is a transaction with a localized description; the demo records a drop
  under the locale key `demo.movedTask` with the task's name (d, [changelog][bry-cl] 8.0.0,
  [demo source][bry-versions-demo]).

## 4. Committing: at once with Undo, or staged with Apply

| Product | Model | Pending state shown | Undo / discard |
| --- | --- | --- | --- |
| monday.com Gantt | At once: "Any changes will automatically be applied" (d) | — | Undo pop-up after a batch shift (d, earlier doc) |
| Jira timeline | At once (no confirm described) (d) | — | — |
| ClickUp Gantt | At once; dependants follow (d) | — | — |
| Atlassian Design System | "immediately update the interface … an 'optimistic update'" (d) | Flash after drop (d) | — |
| MS Project desktop | At once (d) | Change highlighting (d) | "multiple levels of undo" (d) |
| Jira Plans | Draft until saved (d) | Unsaved-change markers; "Review changes" button opens the modal; per-item change count (d) | Discard selected; "Quit" stops a save in progress, already-saved changes stay (d) |
| Jira auto-scheduler | Preview → Accept → save (d) | Suggested values compared on hover (d) | Not described |
| Reclaim 2.0 | Staged in Preview Mode for AI, MCP and bulk changes (d) | Preview Mode switch above the calendar (d) | "Discard changes" (d) |
| Bryntum Gantt | At once by default; can hold the drop for a confirmation (d) | — | STM undo/redo, `UndoRedo` widget (d) |
| dhtmlx Gantt | At once; `onBeforeTaskDrag` can deny (d, earlier doc) | — | Undo/redo stack (d) |
| Syncfusion Gantt | At once (no confirm described) | — | `undoRedoStepsCount`, default 10, includes "dragging taskbars" (d) |

Sources: [monday][monday-gantt], [Jira edit][jira-edit], [ClickUp][clickup-resched], [ADS][ads-dnd],
[Project][ms-change-hl], [Jira save][jira-save], [Jira abandon][jira-abandon], [Jira auto][jira-auto],
[Reclaim][rc-faq], [TaskDrag][bry-taskdrag], [demo source][bry-versions-demo], [dhtmlx][dhx-undo],
[Syncfusion][sf-undo].

**When each is chosen.** Direct manipulation of the thing under the pointer commits at once everywhere read. Staging
appears where the change is broad or computed: a whole plan (Jira Plans: "explore different planning outcomes
without effecting existing work items"), a solver's output (Jira's auto-scheduler), or changes others would be
notified about (Reclaim: "attendees are not notified until you apply them") (d, [Jira save][jira-save],
[Reclaim][rc-faq]). The planner's split (Move and Deadline at once, Re-balance previewed) matches this; what is
missing is that the at-once path shows its knock-on effects *before* release (1.1, 1.2) and the staged path shows
its result on the timeline rather than only in the dialog (1.4).

## 5. The dedicated timeline page

| Part | Jira timeline | monday Gantt | ClickUp Gantt | Notion timeline | Linear timeline |
| --- | --- | --- | --- | --- | --- |
| Range | "Weeks, Months, or Quarters", button bottom right (d) | Days–years dropdown; "Auto Fit"; + / − (d) | Day, Week (default), Month, Quarter, Year, Flexible; Cmd/Ctrl + scroll zooms (d) | "hours all the way up to years", dropdown left of Today (d) | Days, weeks, months, quarters (d) |
| Today | Button top right; orange line (d) | "Show Today Indication": blue line (d) | Not described | "Today" button (d) | Not described |
| Name column | List at left with fields as columns, "inline editable" (d) | List at left; hovered row highlighted across (d) | Sidebar with hierarchy and columns, resizable (d) | Table at left, `>>` / `<<` to show or hide (d) | Group by initiatives (d) |
| On the bar | Colour = status; parent progress from children (d) | "Label by", "Color by", legend (d) | Progress on List bars, hover for numbers (d) | Chosen properties (d) | Milestones, status, health (d) |
| Off-screen items | Not described | Auto Fit (d) | Not described | Arrows on the row; click "to jump right to the project" (d) | Not described |
| On selection | Key opens the work item (d) | Click a bar: item pop-up (d) | Not described | Opens in side peek by default for Timeline (d, 2022) | Not described |
| Unscheduled items | Hover a row, click to add a bar (d) | — | Hover the row, click and drag brackets (d) | — | — |
| Phone | Timeline being removed from the mobile app (s) | Gantt "only available from your browser"; Timeline view is on mobile (d) | Gantt "not available on the mobile app" (d) | Not described | Not described |

Sources: [Jira timeline][jira-timeline], [Jira edit][jira-edit], [Jira mobile][jira-mobile], [monday][monday-gantt],
[monday mobile][monday-mobile], [ClickUp][clickup-gantt], [ClickUp mobile][clickup-mobile],
[Notion][notion-timeline], [Notion side peek][notion-peek], [Linear][linear-timeline].

Library equivalents for the same parts: Syncfusion's toolbar items `ZoomIn`, `ZoomOut`, `ZoomToFit` (d,
[Syncfusion][sf-undo]); Bryntum `HeaderZoom` ("click and drag to zoom to a date range" on the time axis header),
`ScrollButtons` ("buttons in each row that scrolls the task bar into view"), `Indicators` (an icon per date in the
row, including "Deadline date", with a tooltip) and `ProjectLines` (vertical lines at project start and end) (d,
[HeaderZoom][bry-headerzoom], [ScrollButtons][bry-scrollbuttons], [Indicators][bry-indicators],
[ProjectLines][bry-projectlines]); Reclaim's Planner: "click into any event to see more details about it in the
right-hand pane" (d, [Reclaim Planner 1.0][rc-planner1]).

What a page gets that a strip cannot: room for a legend, for a baseline subrow (dhtmlx `separateRow`), for a side
panel that does not cover the lanes (Notion: "keep your database items visible and interactive on the left side"),
and for a header that stays put while the lanes scroll. Notion's side peek is also where the non-drag form lives.

## 6. Making drag discoverable and reliable

**Affordances** (Atlassian, [design guidelines][ads-dnd]):

- Primary drag: an always-visible handle (or none for "implied" draggables such as cards), `:hover { cursor: grab }`,
  and a background change on hover. Secondary drag: a handle visible on `:hover` or `:focus-within`, and `grab`
  only after an 800 ms delay (d).
- "Only the draggable part of an entity should have `cursor: grab`"; if only a handle is draggable, its touch target
  is "at least 24px x 24px" (d).
- MDN: `grab` "Something can be grabbed", `grabbing` "is being grabbed", `ew-resize` "Bidirectional resize cursor",
  `col-resize` "can be resized horizontally" (d, [MDN][mdn-cursor]).
- Resize grips are drawn on the bar: Syncfusion has left, right and progress grippers and connector points that an
  app can hide per task (d, [Syncfusion][sf-tbe]); Jira has "handles at either end" (d, [Jira edit][jira-edit]);
  Notion shows the edge on hover (d, [Notion][notion-timeline]).
- Modifier keys are explained while dragging in Linear (d, earlier doc).

**Reliability:**

- Snap the ghost to the landing position (Bryntum `showExactDropPosition`) and validate during the drag with a
  message (`validatorFn` returning `{ valid, message }`) rather than refusing on drop (d, [DragBase][bry-dragbase],
  [TaskDrag][bry-taskdrag]).
- Escape cancels, release outside reverts (WCAG 2.5.2, earlier doc).
- Touch: Apple's drag interaction waits for a "lift delay" on touch before checking movement; pointer drags may start
  "as soon as the pointer crosses the minimum movement threshold" (d, [Apple][apple-lift]). Syncfusion maps touch to
  tap = select, double tap = edit dialog, long press = context menu, swipe = scroll, pinch = zoom (d,
  [Syncfusion][sf-a11y]).

**Keyboard and screen readers:**

- Atlassian: give draggables "a button that can be used to trigger an inline menu" of movement outcomes; one action
  button per entity; outcomes needing input open "a modal containing a form"; "Tell the user what they achieved"
  with a live region, e.g. `announce('Task "Clean dishes" moved to list "Doing" from "Todo".')`; return focus to the
  trigger (d, [ADS a11y][ads-a11y]).
- WCAG 4.1.3 Status Messages (AA): status messages must be "programmatically determined through role or properties
  such that they can be presented … without receiving focus" (d, [WCAG][wcag-413]). The Undo bar's text qualifies.
- Bryntum commits to "All operations implemented as mouse gestures have a keyboard based equivalent" and "Tooltip
  content is announced on focus"; in its grids Shift+F10 opens the context menu of a focused task (d,
  [Bryntum a11y][bry-a11y]). No key that moves a bar is documented there, as in the earlier doc's findings.
- Slider pattern, target sizes, 2.5.7 and reduced motion: see `docs/calendar-timeline-research.md`, sections 3.1–3.4.

## 7. What could not be verified

- Asana: the help centre renders in the browser only; the dependency-shift options are (s).
- Clockwise: its help pages no longer load; "History", the update e-mails and the ⏸ marker are (s). The shutdown
  date is (d).
- Jira: what the "unsaved changes markers" look like, whether the "Review changes" button shows a count, and whether
  the modal shows old and new values; the mobile timeline removal is (s), the community post did not render.
- Syncfusion's editing tooltip content is (s); its React tooltip page now redirects to a page that returns 404.
- Google Calendar and Outlook drag feedback and Undo after a move: no first-party page found.
- Linear's and Notion's behaviour on phones, and any product's empty-page state: not documented on the pages read.
- Microsoft Project's change highlighting is documented in a 2006 product-team post about Project 2007; the VBA
  reference confirms the setting exists today, not how it looks now.
- Correction to the earlier doc (2.12, "How any product draws a bar that runs past the visible range: none of the
  pages read describe it"): Notion draws arrows on such rows and jumps to the item on click; Bryntum has
  `ScrollButtons` (d).

## 8. Fit with this codebase

- `previewUpdate` (`packages/plan-domain/src/update.ts`) already returns `after`, `diff` (`PlanDiff`: added, removed,
  changed before/after), `overBudget` and `warnings`: the data for the ghosts (1.1), the drag tooltip (1.2), the
  preview bar (1.4) and the change list (1.6), for any `PlanChange`.
- Re-balance runs HiGHS on the server one request at a time, and a waiting request is dropped when a newer one comes
  (`packages/plan-data/src/rebalance.ts`): asking on each pause of the finish drag (rather than each frame) fits that
  queue.
- `PlanHistory` (`packages/plan-domain/src/history.ts`) stores each step's edits: "Compare with…" (1.7) is the plan
  rebuilt at a history cursor, drawn as baseline bars.
- A page is a new file route in `apps/web/src/routes/` composing a page from `modules/planner/src/pages/`, per
  `docs/architecture.md`; the lanes widget and its `LaneEditing` callbacks can be reused there.

## 9. Sources

Atlassian: [Plans, save][jira-save] · [Plans, auto-schedule][jira-auto] · [scenarios][jira-scen] ·
[create a scenario][jira-scen-create] · [abandon a save][jira-abandon] · [timeline][jira-timeline] ·
[timeline, edit][jira-edit] · [mobile timeline (s)][jira-mobile] · [ADS drag and drop][ads-dnd] ·
[ADS drag and drop accessibility][ads-a11y].
Microsoft: [Project 2007 change highlighting][ms-change-hl] · [EnableChangeHighlighting][ms-vba-ch] ·
[Task Path][ms-taskpath] · [review progress][ms-progress] · [baselines][ms-baseline] ·
[Project for the web task history][ms-p4w-history].
Smartsheet: [baselines][ss-baselines] · [highlight changes][ss-highlight] · [Table View][ss-highlight-tv].
monday.com: [Gantt baseline][monday-baseline] · [Gantt][monday-gantt] · [mobile views][monday-mobile].
TeamGantt: [baselines][tg-baselines].
ClickUp: [Gantt][clickup-gantt] · [baselines][clickup-baselines] · [rescheduling][clickup-resched] ·
[mobile][clickup-mobile].
Notion: [timelines][notion-timeline] · [side peek release][notion-peek]. Linear: [timeline][linear-timeline] ·
[dependencies changelog][linear-cl-deps]. Asana: [auto-shift (s)][asana-shift].
Auto-schedulers: [Reclaim 2.0 FAQ][rc-faq] · [Reclaim Planner 1.0][rc-planner1] · [Motion auto-scheduling][mo-how] ·
[Motion ETAs][mo-eta] · [Clockwise][cw-home] · [Clockwise flexible meetings (s)][cw-flex] ·
[Clockwise pause (s)][cw-pause].
Libraries: [Bryntum TaskDrag][bry-taskdrag] · [TaskResize][bry-resize] · [DragBase][bry-dragbase] ·
[Baselines][bry-baselines] · [End variance][bry-variance] · [Versions][bry-versions] · [VersionGrid][bry-versiongrid] ·
[Versions demo][bry-versions-demo] · [Indicators][bry-indicators] · [ScrollButtons][bry-scrollbuttons] ·
[HeaderZoom][bry-headerzoom] · [ProjectLines][bry-projectlines] · [accessibility][bry-a11y] ·
[changelog][bry-cl] · [dhtmlx baselines][dhx-baselines] · [dhtmlx undo][dhx-undo] ·
[Syncfusion baseline][sf-baseline] · [Syncfusion undo][sf-undo] · [Syncfusion taskbar editing][sf-tbe] ·
[Syncfusion accessibility][sf-a11y] · [Syncfusion tooltip (s)][sf-tooltip].
Platform: [MDN cursor][mdn-cursor] · [WCAG 4.1.3][wcag-413] · [Apple lift delay][apple-lift].

[jira-save]: https://support.atlassian.com/jira-software-cloud/docs/save-changes-made-in-advanced-roadmaps/
[jira-auto]: https://support.atlassian.com/jira-software-cloud/docs/auto-schedule-issues-on-your-advanced-roadmaps-timeline/
[jira-scen]: https://support.atlassian.com/jira-software-cloud/docs/what-are-scenarios-in-advanced-roadmaps/
[jira-scen-create]: https://support.atlassian.com/jira-software-cloud/docs/create-a-scenario-in-advanced-roadmaps/
[jira-abandon]: https://support.atlassian.com/jira-software-cloud/docs/abandon-a-save-in-advanced-roadmaps/
[jira-timeline]: https://support.atlassian.com/jira-software-cloud/docs/what-is-the-timeline-and-how-do-i-use-it/
[jira-edit]: https://support.atlassian.com/jira-software-cloud/docs/edit-and-reorder-work-items-on-the-timeline/
[jira-mobile]: https://community.atlassian.com/forums/Jira-articles/Changes-coming-to-Timeline-views-in-Jira-s-mobile-app/ba-p/3215457
[ads-dnd]: https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines
[ads-a11y]: https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines
[ms-change-hl]: https://learn.microsoft.com/en-nz/archive/blogs/project/tracking-changes-in-project-2007
[ms-vba-ch]: https://learn.microsoft.com/en-us/office/vba/api/project.application.enablechangehighlighting
[ms-taskpath]: https://support.microsoft.com/en-us/project/highlight-how-tasks-link-to-other-tasks
[ms-progress]: https://support.microsoft.com/en-us/project/review-the-progress-of-your-schedule
[ms-baseline]: https://support.microsoft.com/topic/ae6fc31e-3c9e-40f9-8fd9-16f59f3e4650
[ms-p4w-history]: https://techcommunity.microsoft.com/t5/project-blog/catch-up-after-your-week-off-with-task-history-in-microsoft/ba-p/3885727
[ss-baselines]: https://help.smartsheet.com/articles/2482093-baselines
[ss-highlight]: https://help.smartsheet.com/articles/521974-highlight-changes-made-to-a-sheet
[ss-highlight-tv]: https://www.smartsheet.com/content-center/highlight-changes-table-view-now-available
[monday-baseline]: https://support.monday.com/hc/en-us/articles/360020978159-The-Gantt-Baseline
[monday-gantt]: https://support.monday.com/hc/en-us/articles/360015643840-The-Gantt-Chart-View-and-Widget
[monday-mobile]: https://support.monday.com/hc/en-us/articles/360015740220-Mobile-app-board-views
[tg-baselines]: https://support.teamgantt.com/article/48-baselines
[clickup-gantt]: https://help.clickup.com/hc/en-us/articles/6310249474967-Create-and-share-a-Gantt-view
[clickup-baselines]: https://help.clickup.com/hc/en-us/articles/34358881283863-Use-baselines-on-Gantt-view
[clickup-resched]: https://help.clickup.com/hc/en-us/articles/6304547785367-Rescheduling-dependencies
[clickup-mobile]: https://help.clickup.com/hc/en-us/articles/15145935126679-Intro-to-the-mobile-app
[notion-timeline]: https://www.notion.com/help/timelines
[notion-peek]: https://www.notion.com/releases/2022-07-20
[linear-timeline]: https://linear.app/docs/timeline
[linear-cl-deps]: https://linear.app/changelog/2024-08-08-project-dependencies
[asana-shift]: https://help.asana.com/s/article/auto-shifting-dates-for-dependent-tasks
[rc-faq]: https://help.reclaim.ai/en/articles/15280604-reclaim-2-0-faq
[rc-planner1]: https://help.reclaim.ai/en/articles/6206998-planner-overview-view-and-manage-your-schedule-1-0
[mo-how]: https://www.usemotion.com/help/time-management/auto-scheduling/reference-auto-scheduling/how-auto-scheduling-works-behind-the-scenes
[mo-eta]: https://usemotion.com/blog/etas
[cw-home]: https://www.getclockwise.com/
[cw-flex]: https://support.getclockwise.com/article/184-flexible-meetings
[cw-pause]: https://support.getclockwise.com/article/125-why-is-there-a-pause-emoji-in-my-event-title
[bry-taskdrag]: https://bryntum.com/products/gantt/docs/api/Gantt/feature/TaskDrag
[bry-resize]: https://bryntum.com/products/gantt/docs/api/Gantt/feature/TaskResize
[bry-dragbase]: https://bryntum.com/products/gantt/docs/api/Scheduler/feature/base/DragBase
[bry-baselines]: https://bryntum.com/products/gantt/docs/api/Gantt/feature/Baselines
[bry-variance]: https://bryntum.com/products/gantt/docs/api/Gantt/column/BaselineEndVarianceColumn
[bry-versions]: https://bryntum.com/products/gantt/docs/api/Gantt/feature/Versions
[bry-versiongrid]: https://bryntum.com/products/gantt/docs/api/Scheduler/widget/VersionGrid
[bry-versions-demo]: https://bryntum.com/products/gantt/examples/versions/app.module.js
[bry-indicators]: https://bryntum.com/products/gantt/docs/api/Gantt/feature/Indicators
[bry-scrollbuttons]: https://bryntum.com/products/gantt/docs/api/Gantt/feature/ScrollButtons
[bry-headerzoom]: https://bryntum.com/products/gantt/docs/api/Scheduler/feature/HeaderZoom
[bry-projectlines]: https://bryntum.com/products/gantt/docs/api/Gantt/feature/ProjectLines
[bry-a11y]: https://bryntum.com/products/gantt/docs/guide/Gantt/advanced/a11y
[bry-cl]: https://bryntum.com/products/gantt/changelog/
[dhx-baselines]: https://docs.dhtmlx.com/gantt/guides/inbuilt-baselines/
[dhx-undo]: https://docs.dhtmlx.com/gantt/guides/undo-redo/
[sf-baseline]: https://ej2.syncfusion.com/react/documentation/gantt/baseline
[sf-undo]: https://ej2.syncfusion.com/react/documentation/gantt/undo-redo
[sf-tbe]: https://ej2.syncfusion.com/react/documentation/gantt/managing-tasks/task-bar-editing
[sf-a11y]: https://ej2.syncfusion.com/react/documentation/gantt/accessibility
[sf-tooltip]: https://ej2.syncfusion.com/vue/documentation/gantt/tooltip
[mdn-cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[wcag-413]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
[apple-lift]: https://developer.apple.com/documentation/uikit/uidraginteraction/allowspointerdragbeforeliftdelay
