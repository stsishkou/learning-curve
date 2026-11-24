# Feature research: what calendar and planner users ask for most

Fetched 2026-11-22, 21:40–21:50 UTC (2026-11-23 in Europe/Minsk). Every number below was read from the
tracker's own API or page at that time. Vote counts from different trackers are **not comparable** and are
never summed: a GitHub 👍 on a rendering library, a UserVoice vote on a mail suite and a Featurebase upvote
on a consumer planner come from audiences of very different size and intent.

Legend for the "exists anywhere?" columns: **(s)** = the status shown on the source board itself; **(k)** =
my general product knowledge, not re-verified in this research. Treat every (k) as a lead to check, not a
fact.

## 1. Short answer

The demand that is both large and still unanswered is not a view or an integration. It is **the plan
reacting to what actually happened**. Three candidates, strongest first.

### 1.1 Reality-fed plan: log actual time, the rest of the plan and the deadline forecast re-flow

- **Demand.** "Update task end time when it's completed early" is the fifth most-voted request on the
  Structured board (2272 votes, 37 comments, opened 2022-11-24, still "Inbox"). Its mirror, "Task Overtime"
  (extend a task and push the following ones), has 251 votes and is also "Inbox". "Time Tracker" is the
  single most-voted post on the Akiflow board (1141 votes, 130 comments, opened 2021-06-09, "In Review"
  five years later). Morgen: "Time tracking" 179 and "Analytics dashboards" 329, both "In Review". Amie:
  "Time tracking / Pomodoro" 94, "In Review". Sunsama: "Improved Analytics and Data Insights" 686, open
  since 2022-02-24. Bryntum's tracker has "Support for planned & actual start / end dates" open since
  2021-03-24 (0 👍, 8 comments).
- **Why incumbents have not shipped it.** In the sources checked they model a day as a list of blocks, not
  a body of work with an estimate and a deadline, so "actual" has nothing to update except one block. Time
  tracking is filed as an integration with an external tracker, and two-way sync with Google/Outlook makes
  silently rewriting event times risky. This is my reading of the boards, not something the vendors state.
- **Why it fits a study planner.** The app already has the two ends of the loop: a weekly hour budget and a
  burn-up chart. The missing middle is the actual duration of a session. With it, the app can compute a
  personal pace per course (planned vs. real hours per module), correct the remaining estimates, re-flow
  future sessions inside the 12 h budget and show "at your real pace you finish on date X, N days
  after/before the deadline". Undo/redo with a history timeline makes an automatic re-flow safe to offer.
- **Difficulty here: medium.** A new `PlanChange` kind for the actual duration, a pure re-flow function in
  the domain package (the "shift by N days" logic is the starting point), a forecast line on the burn-up.
  No backend, no accounts, no sync.
- **"First" is uncertain.** Sunsama shows planned vs. actual time per task and Super Productivity tracks
  spent vs. estimate (k); Super Productivity closed "Record start & end timestamps for time tracking and
  sync to calendar" as completed (24 👍). None of the sources checked combine actuals with a
  budget-constrained re-flow and a deadline forecast, but project tools (MS Project, OmniPlan, Bryntum
  Scheduler Pro's engine) do baseline-vs-actual scheduling for teams (k).

### 1.2 Catch-up that plans itself: budget- and deadline-aware re-plan of missed work, as compared options

- **Demand.** "(Auto-)Move Incomplete Tasks" has 2518 votes on Structured, "AI Planner Proactive Support:
  Incomplete Tasks" 390 and "AI Planner: Auto-Schedule Tasks" 354 on Morgen, "AI Tasks auto-schedule" 728
  on Akiflow (138 comments). All four are marked completed (s), so the plain version is **not** new.
  Still open: Morgen "Priority/Due Dates Changes (Motion like)" 121, Akiflow "Plan a task multiple times /
  Handle longer tasks" 526 (open since 2021-09-21), Akiflow "Overcapacity warning" 90, Sunsama
  "auto-reschedule on mobile app" 51.
- **Gap.** What shipped moves leftovers to tomorrow or lets an AI fill free slots. Nothing in the sources
  re-plans against a *weekly hour budget* and a *fixed end date* and then shows the trade-off as choices:
  "add 1.5 h/week for four weeks", "finish nine days later", "drop the optional modules". Motion, Reclaim,
  SkedPal and FlowSavvy auto-schedule against deadlines in paid tiers (k); whether any of them exposes the
  trade-off as explicit scenarios was not checked.
- **Fit and difficulty.** The app already has "shift the rest by N days" and the over-budget warning; this
  turns one manual lever into a previewed, undoable set of scenarios. Medium to high: a deterministic
  packing function over the remaining sessions plus a preview UI. No AI needed.

### 1.3 Goal ladder: deadline → month → week objectives with a weekly review

- **Demand.** The three objectives posts are the top of the Sunsama board and have been open for years:
  "Monthly objectives and planning" 1742 (81 comments, 2019-12-16), "Yearly objectives" 1203, "Quarterly
  Objectives and Planning" 862. Akiflow "Hierarchy of Goals (weekly/monthly)" 441, status "Future" since
  2021. Routine "Daily/weekly review & shutdown" 25, planned.
- **Gap and fit.** General planners cannot derive objectives because their tasks have no parent structure.
  A study plan has one for free (deadline → course → module → session), so "this week: finish module 3 of
  course X" and "this month: two courses done" can be *generated* from the schedule and checked off
  automatically, followed by a short end-of-week review that feeds 1.1 and 1.2.
- **Difficulty: low to medium.** Derived data plus one view. Weakest "killer" claim of the three: Sunsama
  has weekly objectives and Routine marks "Goals" completed (s), so only the derived, deadline-anchored
  form would be new.

Cheap, well-evidenced extras that are not killer features: continuous scrolling between weeks/months,
multi-select with bulk move, splitting one long item across several sessions, prerequisites between items.
See the themes.

## 2. Ranked table of top requests

Sorted by the tracker's own vote figure. "Type" separates an end-user product wish (**P**) from a library
capability gap (**L**) and a suite/ecosystem wish (**E**). UserVoice list pages do not show a creation date,
so it is "n/r" (not recorded) for Proton.

| #   | Votes | Comments | Request (title verbatim)                                      | Source        | Opened     | State                | Type | Exists anywhere?                                                         |
| --- | ----- | -------- | ------------------------------------------------------------- | ------------- | ---------- | -------------------- | ---- | ------------------------------------------------------------------------ |
| 1   | 4720  | 587      | [Proton Tasks / To-Do List][p-tasks]                          | Proton        | n/r        | Under review         | E    | Google/Outlook tasks in calendar (k)                                     |
| 2   | 3655  | 94       | [Routines][st-routines]                                       | Structured    | 2023-01-31 | Inbox                | P    | Reclaim habits, Sunsama rituals (k); Akiflow "Rituals" completed (s)     |
| 3   | 3158  | 128      | [Two-Way Calendar Sync][st-sync]                              | Structured    | 2022-11-03 | Inbox                | P    | Most sync-first calendars (k)                                            |
| 4   | 2588  | 68       | [Habit Tracking][st-habit]                                    | Structured    | 2022-11-03 | Inbox                | P    | Routine "Habits tracker" completed (s); TickTick (k)                     |
| 5   | 2518  | 112      | [(Auto-)Move Incomplete Tasks][st-automove]                   | Structured    | 2022-11-03 | Completed            | P    | Structured (s); Morgen, Akiflow (s); Motion, Reclaim (k)                 |
| 6   | 2272  | 37       | [Update task end time when it's completed early][st-early]    | Structured    | 2022-11-24 | Inbox                | P    | Not found in sources checked                                             |
| 7   | 1848  | 122      | [Offline calendar][p-offline]                                 | Proton        | n/r        | Under review         | P    | Routine "Offline mode" completed (s); native calendar apps (k)           |
| 8   | 1746  | 87       | [Search feature / Search bar][st-search]                      | Structured    | 2022-11-03 | Planned              | P    | Common (k)                                                               |
| 9   | 1742  | 81       | [Monthly objectives and planning][su-month]                   | Sunsama       | 2019-12-16 | open                 | P    | Weekly objectives only in Sunsama (k)                                    |
| 10  | 1487  | 21       | [Deadlines in Inbox][st-deadline]                             | Structured    | 2022-11-03 | Inbox                | P    | Akiflow, Routine deadlines completed (s); Super Productivity (s)         |
| 11  | 1361  | 44       | [Add a search option in Calendar][p-search]                   | Proton        | n/r        | none shown           | P    | Common (k)                                                               |
| 12  | 1203  | 38       | [Yearly objectives][su-year]                                  | Sunsama       | 2019-12-16 | open                 | P    | Not found in sources checked                                             |
| 13  | 1190  | 63       | [Schedule recurring … 'third Wednesday of the month' …][p-rr] | Proton        | n/r        | status not parseable | P    | Any RRULE BYSETPOS editor: Google, Outlook (k)                           |
| 14  | 1141  | 130      | [Time Tracker][ak-track]                                      | Akiflow       | 2021-06-09 | In Review            | P    | Routine "Time tracker (Pomodoro)" completed (s); Super Productivity (k)  |
| 15  | 1112  | 46       | [Locations & Travel Times][st-travel]                         | Structured    | 2022-11-03 | Inbox                | P    | Apple Calendar, Fantastical (k)                                          |
| 16  | 1104  | 0        | [Offline mode][ro-offline]                                    | Routine       | 2024-11-06 | Completed            | P    | Routine (s)                                                              |
| 17  | 1061  | 49       | [Side-by-side visualization for overlapping tasks][st-ovl]    | Structured    | 2023-02-05 | Inbox                | P    | Every grid calendar library (k)                                          |
| 18  | 790   | 30       | [Multi-Select][st-multi]                                      | Structured    | 2022-11-03 | Inbox                | P    | Morgen "Select multiple events at once" completed (s)                    |
| 19  | 731   | 0        | [Focus timer][ak-focus]                                       | Akiflow       | 2021-03-10 | Completed            | P    | Akiflow, Structured, Routine (s)                                         |
| 20  | 728   | 138      | [AI Tasks auto-schedule: plan tasks automatically][ak-auto]   | Akiflow       | 2021-08-09 | Completed            | P    | Akiflow, Morgen (s); Motion, Reclaim (k), paid                           |
| 21  | 686   | 33       | [Improved Analytics and Data Insights][su-ana]                | Sunsama       | 2022-02-24 | open                 | P    | Akiflow "Report/Stats" completed (s); Google Time Insights, paid (k)     |
| 22  | 549   | 37       | [Shift all events by + or - amount of time][st-shift]         | Structured    | 2023-05-13 | Completed            | P    | Structured (s); target app shifts by days already                        |
| 23  | 526   | 74       | [Plan a task multiple times / Handle longer tasks][ak-multi]  | Akiflow       | 2021-09-21 | Open                 | P    | Sunsama (named in the post); Motion/Reclaim chunking (k)                 |
| 24  | 496   | 70       | [Duplicate event][p-dup]                                      | Proton        | n/r        | Started              | P    | Nextcloud #113, Etar #87 completed (s)                                   |
| 25  | 441   | 45       | [Hierarchy of Goals (weekly/monthly)][ak-goals]               | Akiflow       | 2021-06-10 | Future               | P    | Routine "Goals" completed (s)                                            |
| 26  | 399   | 0        | [Undo/redo][ro-undo]                                          | Routine       | 2024-11-06 | Planned              | P    | Morgen "Undo button" completed (s); target app has it                    |
| 27  | 395   | 18       | [Analytics / Statistic][st-ana]                               | Structured    | 2022-11-03 | Inbox                | P    | See row 21                                                               |
| 28  | 390   | 20       | [AI Planner Proactive Support: Incomplete Tasks][mo-inc]      | Morgen        | 2023-12-22 | Completed            | P    | Morgen (s)                                                               |
| 29  | 329   | 20       | [Analytics dashboards][mo-ana]                                | Morgen        | 2024-06-28 | In Review            | P    | See row 21                                                               |
| 30  | 252   | 12       | [Day Templates][st-tpl]                                       | Structured    | 2023-02-01 | Inbox                | P    | Not found as shipped in sources checked                                  |
| 31  | 251   | 5        | [Task Overtime][st-over]                                      | Structured    | 2023-01-31 | Inbox                | P    | Not found in sources checked                                             |
| 32  | 165   | 62       | [CalDAV Task support][fo-36]                                  | Fossify       | 2024-01-07 | open                 | E    | Nextcloud #28 completed (s); Thunderbird (k)                             |
| 33  | 161   | 21       | [Responsiveness Tracking Issue][fc-3187]                      | FullCalendar  | 2016-05-30 | open                 | L    | Target app has a phone layout                                            |
| 34  | 156   | 185      | [Year View with 12 Mini-Calendars][fc-1140]                   | FullCalendar  | 2015-08-19 | closed, completed    | L    | FullCalendar multi-month (s)                                             |
| 35  | 134   | 37       | [Continuous scrolling of months][fc-2276]                     | FullCalendar  | 2015-08-19 | open                 | L    | Morgen "Make weeks (months) scrollable" completed (s); Google mobile (k) |
| 36  | 70    | 77       | [Subtask nesting and event triggers …][tb-194863]             | Thunderbird   | 2003-02-25 | ASSIGNED             | P    | Task managers (k)                                                        |
| 37  | 44    | 9        | [Task dependencies / Linked tasks / Task Relationships][sp-2173] | Super Prod. | 2022-07-28 | open (reopened)      | P    | Gantt tools (k)                                                          |
| 38  | 43    | 56       | [Year View][tb-157270]                                        | Thunderbird   | 2002-07-13 | NEW                  | P    | See row 34                                                               |
| 39  | 32    | 38       | [Select and move/edit multiple events][fc-2253]               | FullCalendar  | 2015-08-19 | open                 | L    | See row 18                                                               |
| 40  | 31    | 9        | [Improve resource timeline performance with virtual rendering][fc-5673] | FullCalendar | 2020-07-28 | open         | L    | Bryntum, FullCalendar v7 virtualization option (issue #8138) (s)         |

Rows 36–40 are low in absolute numbers only because GitHub and Bugzilla voting populations are small; within
their own trackers they sit at or near the top.

### Per-library top open requests (library capability gaps, GitHub 👍 / comments)

- **fullcalendar/fullcalendar** (20 788 stars, 1025 open issues): Responsiveness 161/21; Continuous scrolling
  of months [#2276][fc-2276] 134/37; Theme system for Tailwind CSS #5868 111/44; highlight cells on hover
  #4816 103/56; React Native component #7076 89/45; Jalaali date system #1813 69/96; timeline continuous
  scroll #4828 53/12; Vertical resource view grouping #4859 53/12; swipe effect on prev/next #3666 52/16;
  Right-click on date cells #2748 50/26; CalDav Support #690 48/33; Gantt chart arrows between events #4748
  39/8; Navigate previous/next when dragging event to edges #2542 33/59; Select and move/edit multiple
  events #2253 32/38; Copy events via ctrl, drag & drop #857 21/28; Event drag-n-drop / resize with keyboard
  #2535 4/4 (open since 2015). Most commented open issue: "Add/Edit/View/Delete events through a dialog-ish
  box" #433, 11/184.
- **bigcalendar/react-big-calendar** (8766 stars; `jquense/react-big-calendar` redirects here): the
  top-voted feature requests were closed as not planned: Horizontal Resource #1855 29/11, Resource Timeline
  component #1844 22/1. Open issues are bugs with single-digit votes.
- **vkurko/calendar** (EventCalendar, 2305 stars): recurring events with rrule #28 24/11, open since
  2022-01-06; Resource view – horizontal #30 35/13, completed; Discussions: "Show a Year view" #293 8
  upvotes, "External Drag and Drop" #45 6 upvotes/17 comments.
- **nhn/tui.calendar** (12 679 stars, archived): DST bug #423 8/15; reservation/booking view #385 7/3;
  Resource Scheduler #233 5/9; 15-minute snapping question #187 1/20.
- **mattlewis92/angular-calendar** (2809 stars): Long events expand across the month view #758 11/13;
  Luxon adapter for variable time zone #1661 4/7.
- **wix/react-native-calendars** (10 326 stars): Agenda: scroll past the initial selected day #80 47/42,
  open since 2017; Calendar view default with Agenda #309 30/27; "Project status" #2731 17/12.
- **schedule-x/schedule-x** (2612 stars): no open request above 2 👍; swipe between days/weeks #629 1/9.
- **namespace-ee/react-calendar-timeline** (2163 stars): "Is this repo being maintained?" #855 27/31.
- **bryntum/bryntum** (public tracker; `bryntum/support` redirects here, 3354 open issues): customers do not
  vote there, top is 3 👍. Relevant by content: "Support for planned & actual start / end dates" #2558 0/8,
  "Feature to Quickly Update Task Progress / Reschedule Tasks" #7731 1/9.

## 3. Themes

**Plan reacts to reality (actual time, early finish, overtime, pace).** Structured 2272 + 251 (both
unshipped), Akiflow Time Tracker 1141 (In Review), Morgen 179, Amie 94, Bryntum #2558, Super Productivity
#6378 24 👍 (completed) and Discussion "Time Tracking Visualization" #3022 (15 upvotes, 35 comments). The
largest open cluster that maps directly onto a study plan. See 1.1.

**Auto-scheduling and rescheduling of missed work.** Structured 2518, Akiflow 728, Morgen 390 and 354: all
completed, typically in paid products. Remaining open: Morgen 121 (Motion-like reaction to changed due
dates), Sunsama 51, Super Productivity "Unschedule all overdue tasks" #8433 3/6 and "Make Overdue optional"
#4405 10/12. High demand, but the basic form is taken. See 1.2.

**Long work split across several sessions.** Akiflow "Plan a task multiple times" 526/74, open since 2021;
Amie "Scheduling one to-do multiple times" 9; Morgen "Add a task with its subtasks to the calendar" 131.
A course module with a 6 h estimate is exactly this case.

**Goals, objectives, reviews.** Sunsama 1742 / 1203 / 862, Akiflow 441 (Future), Akiflow "Someday page
review" 549 (completed), Routine review 25. See 1.3.

**Analytics and insight.** Sunsama 686 (open), Structured 395 (Inbox), Morgen 329 + "AI Planner Insights:
Activity Report" 135 (In Review), Akiflow "Report/Stats" 396 (completed). The target app already has
burn-up, load chart and heat map, so it is ahead here; what it lacks is planned-vs-actual.

**Routines, habits, rituals.** Structured 3655 and 2588, Sunsama 657, Akiflow 270 (Future) and "Rituals:
weekly options" 485 (completed), Morgen 187, Amie 141 and 34, Routine 335. Very high demand, but for a
study planner it only means "recurring study slot", which recurring events cover.

**Focus timer / Pomodoro.** Akiflow 731, Structured 436, Routine 299 (all completed); Morgen 88 and Amie 94
(In Review). Widely shipped; useful only as the input device for 1.1.

**Dependencies and structure.** Super Productivity #2173 44/9 (open), FullCalendar Gantt arrows #4748 39/8,
Structured "Tasks dependent on each other" 80, Thunderbird bug 194863 (70 votes, open since 2003). For
study content this is "prerequisite": module B cannot be scheduled before module A.

**Templates.** Structured "Day Templates" 252, Routine 88, Akiflow 65, Morgen 37, Super Productivity
Discussion #2450 (25 upvotes) and #4982 12 👍.

**Navigation: continuous scroll, swipe, year view.** FullCalendar #2276 134, #4828 53, #3666 52; Fossify
"Monthly view continuous scrolling" #155 14/8; Super Productivity "Scrolling Days/Months in schedule view"
#4915 19 (completed); Morgen 176 (completed). Year view: FullCalendar #1140 156/185 (completed),
Thunderbird 43 votes (open since 2002), Proton "More view options" 276, vkurko Discussion 8.

**Bulk editing: multi-select, duplicate, copy-drag.** Structured 790 (Inbox), Routine "Bulk operations" 197
(Next Up), Morgen 134 (completed) and "Duplicate event" 93, Proton "Duplicate event" 496/70, FullCalendar
#2253 32/38 and #857 21/28, Nextcloud "Duplicate event" #113 35/74 (completed).

**Offline and sync.** Proton "Offline calendar" 1848 and "ability to add event when connection lost" 1579;
Routine 1104 (completed); Morgen "Off-line calendar changes" 123; Structured two-way sync 3158; Proton
shared two-way sync 1170 and Bridge/CalDAV 1074 + 604; Nextcloud "Enable external calendar read-write" #2766
104/34 (completed); FullCalendar CalDav #690 48/33.

**Time zones and DST.** Mostly bugs, not wishes: tui.calendar #423 8/15, FullCalendar #5273 25/23
(completed) and "multiple axis, each with different time zone" #3964 13/11, angular-calendar #1661,
react-calendar-timeline #1052.

**Resource / timeline views.** react-big-calendar #1855 29 and #1844 22 (both not planned), vkurko #30 35
(completed), Nextcloud "Resource/Room Timeline view" #2713 25/8, FullCalendar #4859 53, tui.calendar #233.

**Performance / virtualization.** FullCalendar #5673 31/9 and #6478 8/4; Thunderbird meta bug 733039
(36 votes, 100 comments); angular-calendar "slow loading with 30k events" #1606.

**Accessibility and keyboard.** FullCalendar screen readers #2536 41/14 (completed), keyboard drag/resize
#2535 4/4 (open since 2015), keyboard select #6528 6/2. Low votes, long-standing gap; the target app
already has keyboard move.

**Printing.** Proton "Print calendar" 135/43; FullCalendar has 48 print issues, top 4 👍. Low demand.

**Natural-language entry.** Morgen "Add NLP to Mobile app" 101; Proton "Remove colon necessity for easier
scheduling" 138. Low, and shipped on desktop by Fantastical, Todoist, Morgen (k).

**Recurrence editing.** Proton nth-weekday 1190 and "First day / Last day of each month" 500, "Edit single
instance of a recurring event" 379 (Started); Thunderbird bug 320178 (19 votes, 106 comments, open since
2005); Etar #97 17/15; vkurko rrule #28 24.

**Availability / booking.** cal.com's whole tracker (top open: user language #8904 28/20, round-robin
limits #27401 20/2); tui.calendar booking view #385; Routine "Availability sharing" 82.

## 4. High demand, irrelevant to a single-user study planner

- **Tasks inside the calendar suite, contacts, birthdays** (Proton 4720, 2163, 1190; Thunderbird 54;
  Fossify 165): ecosystem wishes of a mail/PIM suite. The study plan is already task-shaped.
- **Two-way sync, CalDAV, Bridge, external write access** (Structured 3158, Proton 1170 / 1074 / 604,
  Nextcloud 104): needs accounts, credentials and conflict handling; the app is file-backed with no account
  system. A read-only `.ics` subscription URL would be the proportionate version.
- **Offline mode** (Proton 1848, Routine 1104): a problem of cloud products; a local JSON-backed app is
  offline by construction.
- **Integrations** (Morgen external-task CRUD 490, Akiflow API 502, Sunsama API 888, Obsidian 611 / 251,
  Apple Reminders, Todoist, Outlook): no external systems to integrate with.
- **Sharing, invitations, team calendars, delegation, free/busy** (Nextcloud 43, 41, 33; Structured 823;
  Thunderbird 33, 29; all of cal.com): multi-user by definition.
- **Resource / room / timeline views, virtualization** (FullCalendar, react-big-calendar, vkurko,
  Nextcloud): one person, one plan, a few hundred events.
- **Time-zone features**: the app is fixed to one zone on purpose.
- **Locations, travel time, maps, weather** (Structured 1112, Proton 1434, Morgen 148): study sessions have
  no place.
- **Platform reach** (Android/iPad/Watch apps, widgets, React Native component): Structured, Routine,
  Akiflow and FullCalendar top lists are full of these; they are distribution, not features.
- **Framework and theming requests on libraries** (Tailwind theme 111, Angular/React version support, Day.js
  adapters): maintenance of a library, not user demand.
- **Meeting recording, transcripts, email-to-task** (Amie 91, Morgen 270, Proton 1351): different product.

## 5. Method and limits

### Tooling deviation

The `gh` CLI is **not installed** on this machine, so nothing was fetched through it. GitHub data came from
the public REST search API with `curl`, unauthenticated (10 searches/minute). GraphQL needs a token, so
GitHub Discussions were read from the public HTML list pages instead; only the first page (25 rows) per repo.

### Exact queries

GitHub, for each repo `R`, with `https://api.github.com/search/issues?` in front:

- `q=repo:R+is:issue+is:open&sort=reactions-%2B1&order=desc&per_page=20`
- `q=repo:R+is:issue+is:closed&sort=reactions-%2B1&order=desc&per_page=15`
- `q=repo:R+is:issue+is:open&sort=comments&order=desc&per_page=12`

`R` = fullcalendar/fullcalendar, bigcalendar/react-big-calendar, schedule-x/schedule-x, nhn/tui.calendar,
vkurko/calendar, mattlewis92/angular-calendar, wix/react-native-calendars, calcom/cal.diy,
nextcloud/calendar, namespace-ee/react-calendar-timeline, bryntum/bryntum,
super-productivity/super-productivity, Etar-Group/Etar-Calendar, FossifyOrg/Calendar. Names were checked
with `GET /repos/R`; four names redirect: `jquense/react-big-calendar` →
`bigcalendar/react-big-calendar`, `calcom/cal.com` → `calcom/cal.diy`, `bryntum/support` →
`bryntum/bryntum`, and `johannesjo/super-productivity` → `super-productivity/super-productivity`.

Keyword searches (same endpoint, `sort=reactions-%2B1`, `per_page=8`, `in:title`): on fullcalendar `print`;
`timezone OR "time zone"`; `performance OR virtual`; `accessibility OR keyboard`; `undo OR copy OR
duplicate`; `touch OR mobile OR swipe` (open); `offline OR undo OR "multiple events"` (open). On
super-productivity: `auto schedule OR reschedule`; `estimate`; `schedule OR planner OR calendar`;
`overdue OR missed OR unfinished`.

Discussions: `https://github.com/R/discussions?discussions_q=sort%3Atop` for fullcalendar, vkurko/calendar,
super-productivity, react-calendar-timeline.

Other sources:

- Thunderbird: `https://bugzilla.mozilla.org/rest/bug?product=Calendar&resolution=---&order=votes%20DESC&limit=25`
- Proton: `https://protonmail.uservoice.com/forums/284483-proton-mail-calendar/filters/top?page=1..12` (top
  240 of 2304 ideas of the shared Mail + Calendar forum), then filtered by calendar words in the title.
- Featurebase boards, `/api/v1/submission?sortBy=upvotes%3Adesc&limit=40&page=1..2` on `feedback.morgen.so`
  (1158 posts), `akiflow.featurebase.app` (2939), `feedback.structured.app` (965), `feedback.routine.co`
  (1224), `feedback.amie.so` (263); plus `&q=` searches for deadline, actual, capacity, workload, estimate,
  "catch up", overdue, spaced, study, progress, forecast, "time budget", "weekly review", pomodoro, template.
- Sunsama (Canny): `https://roadmap.sunsama.com/{improvements,integrations,mobile-apps}?sort=top`, the ten
  posts embedded in each server-rendered page.
- Discourse forums: `forum.dhtmlx.com/c/scheduler-all/40/l/top.json?period=all`,
  `forum.dhtmlx.com/c/new-functionality-requests/19/l/top.json?period=all`,
  `forum.mobiscroll.com/c/event-calendar-scheduler/15/l/top.json?period=all`.

### What could not be accessed or carries no signal

- **Syncfusion feedback portal** and **Microsoft (Outlook) Feedback Portal**: the pages load but the lists
  are rendered by script from an API I did not find; no data taken.
- **Mozilla Connect ideas** (Thunderbird): HTTP 403 to a script client. Bugzilla was used instead.
- **DHTMLX and Mobiscroll forums**: reachable, but they are support forums; the most-liked topics have 2–3
  likes. No voting signal. **DayPilot forum**: no voting. **Bryntum**: public GitHub tracker, but customers
  do not vote there.
- **No public board found** at the addresses tried for Reclaim, Motion, TickTick, Todoist, Fantastical,
  Notion Calendar, Vimcal, BusyCal, SkedPal, Amazing Marvin, cal.com (other than GitHub). They may have one
  elsewhere. **Google Calendar** has no public vote-ranked board that I could query.
- **Reddit and Hacker News were not consulted**; nothing in this file rests on them.

### Limits

- Creation dates and statuses for Proton ideas are incomplete: the list page shows neither reliably.
- The Sunsama pages expose ten posts per board and all show status "open"; I could not confirm that the
  server-side order honours `sort=top`, so posts with more votes may exist.
- Featurebase and Canny boards are curated by the vendor (merged duplicates, vendor-authored posts, statuses
  like "Completed" that may mean a paid tier). Vote totals reflect that product's user base only.
- Selection bias: boards exist for planner-style apps (Structured, Akiflow, Morgen, Routine, Amie, Sunsama)
  and not for the largest calendars (Google, Apple, Outlook), so "what planner users want" is over-weighted.
- All "(k)" entries and every statement about why a vendor has not built something are my inference.
- **Absence of a feature in the sources checked is not proof that nobody ships it.** The claims in section 1
  mean "requested with these numbers, and not found as shipped in these trackers", nothing stronger. Before
  betting on 1.1 or 1.2, check Motion, Reclaim, SkedPal, FlowSavvy, Sunsama and study-specific planners
  (e.g. Shovel, MyStudyLife) hands-on; none of them was examined here.

[p-tasks]: https://protonmail.uservoice.com/forums/284483/suggestions/7158378
[p-offline]: https://protonmail.uservoice.com/forums/284483/suggestions/44627556
[p-search]: https://protonmail.uservoice.com/forums/284483/suggestions/49223348
[p-rr]: https://protonmail.uservoice.com/forums/284483/suggestions/46730461
[p-dup]: https://protonmail.uservoice.com/forums/284483/suggestions/42699347
[st-routines]: https://feedback.structured.app/p/routines-2
[st-sync]: https://feedback.structured.app/p/two-way-calendar-sync
[st-habit]: https://feedback.structured.app/p/habit-tracking
[st-automove]: https://feedback.structured.app/p/auto-move-uncompleted-tasks
[st-early]: https://feedback.structured.app/p/update-task-end-time-when-its-completed-early
[st-search]: https://feedback.structured.app/p/search
[st-deadline]: https://feedback.structured.app/p/deadlines-in-inbox
[st-travel]: https://feedback.structured.app/p/locations-and-travel-times
[st-ovl]: https://feedback.structured.app/p/side-by-side-visualization-for-overlapping-tasks
[st-multi]: https://feedback.structured.app/p/multi-select
[st-shift]: https://feedback.structured.app/p/shift-all-events-by-or-amount-of-time
[st-ana]: https://feedback.structured.app/p/analytics-statistic
[st-tpl]: https://feedback.structured.app/p/day-templates
[st-over]: https://feedback.structured.app/p/task-overtime
[su-month]: https://roadmap.sunsama.com/improvements/p/monthly-objectives-and-planning
[su-year]: https://roadmap.sunsama.com/improvements/p/yearly-objectives
[su-ana]: https://roadmap.sunsama.com/improvements/p/improved-analytics-and-data-insights
[ak-track]: https://akiflow.featurebase.app/p/time-tracker
[ak-focus]: https://akiflow.featurebase.app/p/focus-timer
[ak-auto]: https://akiflow.featurebase.app/p/ai-tasks-auto-schedule-plan-tasks-automatically
[ak-multi]: https://akiflow.featurebase.app/p/plan-a-task-multiple-times-handle-longer-tasks
[ak-goals]: https://akiflow.featurebase.app/p/hierarchy-of-goals-weeklymonthly
[ro-offline]: https://feedback.routine.co/p/offline-mode-12
[ro-undo]: https://feedback.routine.co/p/undoredo-4
[mo-inc]: https://feedback.morgen.so/p/ai-planner-proactive-support-incomplete-tasks
[mo-ana]: https://feedback.morgen.so/p/analytics-dashboards
[fo-36]: https://github.com/FossifyOrg/Calendar/issues/36
[fc-3187]: https://github.com/fullcalendar/fullcalendar/issues/3187
[fc-1140]: https://github.com/fullcalendar/fullcalendar/issues/1140
[fc-2276]: https://github.com/fullcalendar/fullcalendar/issues/2276
[fc-2253]: https://github.com/fullcalendar/fullcalendar/issues/2253
[fc-5673]: https://github.com/fullcalendar/fullcalendar/issues/5673
[tb-194863]: https://bugzilla.mozilla.org/show_bug.cgi?id=194863
[tb-157270]: https://bugzilla.mozilla.org/show_bug.cgi?id=157270
[sp-2173]: https://github.com/super-productivity/super-productivity/issues/2173
