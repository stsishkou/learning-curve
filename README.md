# learning-curve

Personal study plan as code: a schedule database (`packages/plan-data/data/plan.json`), a viewer built on
[TanStack Start](https://tanstack.com/start), two-way sync with Google Calendar and Outlook, and `.ics` export.

The repository is an [Nx](https://nx.dev) + pnpm workspace: a thin app in `apps/web`, feature modules in
`modules/`, shared packages in `packages/`. See [docs/architecture.md](docs/architecture.md).

## Quick start

```bash
pnpm install
pnpm run dev          # http://localhost:3000
```

Requires Node 26+ and pnpm 12.

Re-balancing a calendar solves an integer program on the server with [HiGHS](https://highs.dev). It comes
through the `highs` package, which is WebAssembly, so there is nothing else to install, and the browser never
loads it. The production build copies the package beside the server
(`apps/web/.output/server/node_modules/highs`), so ship that folder with the rest of `.output`.

`pnpm run dev` updates live: a change in any module or package hot-reloads in the browser, and editing
`packages/i18n/messages/*.json` recompiles the translations without a restart. Events edited in the viewer are
written to `packages/plan-data/data/edits.json` at once.

## Scripts

Run from the repository root; Nx runs the task in every project that has it and caches the result.

| Command | What it does |
|---|---|
| `pnpm run dev` | Dev server on port 3000 with hot reload |
| `pnpm run build` / `pnpm start` | Production build (Nitro) into `apps/web/.output`, with a per-project log, and the Node server |
| `pnpm run stand` / `pnpm run stand:build` | The component stand (Storybook) on port 6006, and its static build in `apps/stand/dist`: see [docs/component-stand.md](docs/component-stand.md) |
| `pnpm run stand:test` | Every story as a test in headless Chromium: it renders, its interactions pass, axe finds no accessibility violation |
| `pnpm run docs` / `pnpm run docs:build` | The guide on port 3100 with hot reload, and its static build with the federation remote: see [apps/docs/README.md](apps/docs/README.md) |
| `pnpm run docs:test` | Builds the guide and its test host, then Playwright loads the docs remote inside the host |
| `pnpm run mcp` | The MCP server over stdio, for an assistant: see [For language models and tools](#for-language-models-and-tools) |
| `pnpm run docker:smoke` | Builds the planner's Docker image and checks it in throwaway containers (`--proxy` adds the HTTPS proxy): see [docs/deployment.md](docs/deployment.md) |
| `pnpm run plan` | Rebuilds `plan.json` from the course content, schedule rules and manual edits |
| `pnpm run plan --ics` | Same, plus writes `packages/plan-data/exports/*.ics` and import instructions |
| `pnpm run test` | Vitest unit tests in every project that has them: the rules, the use cases, the adapters, the modules, the MCP server and the guide's citations. The calendar sync runs against a fake Google and a fake Outlook, never the real ones |
| `pnpm run check` | Typecheck, lint, Feature-Sliced check, translation check and format check |
| `pnpm run affected` | The same checks plus build, only for projects changed since `main` |
| `pnpm run typecheck` | `tsc --noEmit` (TypeScript 7) in every project |
| `pnpm run lint` | [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) (type-aware, React, accessibility, workspace boundaries) and [Steiger](https://github.com/feature-sliced/steiger) (layers inside modules) |
| `pnpm run fmt` / `pnpm run fmt:check` | [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html): formatting, import order and Tailwind class order |
| `pnpm run check:i18n` | Fails on missing or empty translations, mismatched variables, missing plural forms and unused messages |
| `pnpm run graph` | Opens the project dependency graph |

One project: `pnpm exec nx run @lc/planner:typecheck`. Add `--skip-nx-cache` to force a rerun.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat: …`, `fix: …`, `build: …`);
a Husky `commit-msg` hook checks them with commitlint.

## Develop and test

### Running the apps

Each app starts on its own; there is no command that starts them all. Day to day, `pnpm run dev` is enough.

| App | Command | Address |
|---|---|---|
| The planner (`apps/web`) | `pnpm run dev` | http://localhost:3000 |
| The planner, production build | `pnpm run build`, then `pnpm start` | http://localhost:3000 |
| The planner in Docker | `docker compose up -d --build`, then once `docker compose --profile seed run --rm seed`: see [docs/deployment.md](docs/deployment.md), which also covers servers and hosted services | http://localhost:3000 |
| The guide (`apps/docs`) | `pnpm run docs` | http://localhost:3100 |
| The guide inside the planner | `pnpm run docs:build`, then `pnpm --filter @lc/docs preview` | http://localhost:4310 |
| The guide's test host (`apps/docs-harness`) | `pnpm --filter @lc/docs-harness dev` | http://localhost:4320 |
| The component stand (`apps/stand`) | `pnpm run stand` | http://localhost:6006 |
| The MCP server (`apps/mcp`) | `pnpm run mcp`, usually started by the assistant through `.mcp.json` | stdio |

In development the planner's docs button loads the guide's remote from port 4310 (`DOCS_REMOTE_URL` sets another
address), so it works only while the guide's preview runs. The planner and the MCP server read and write the same
files in `packages/plan-data/data`; `PLAN_DATA_DIR` points either at another directory and `PLAN_READONLY=1` switches
writing off.

### Testing

| What changed | Where its test goes | Run |
|---|---|---|
| A rule in `plan-domain` | a `*.test.ts` beside the file, with the fixtures of `@lc/plan-domain/fixtures` | `pnpm run test` |
| A use case in `plan-service` | beside the service, over `createMemoryPorts()` from `@lc/plan-service/testing` | `pnpm run test` |
| An adapter in `plan-data` | the port's contract suite (`describePlanRepository`, `describeSyncStateStore`, …) plus its own cases; Google and Outlook against their fakes | `pnpm run test` |
| A component, widget or page | a story in the module; the stand turns every story into a test | `pnpm run stand:test` |
| The guide or its remote | the chapter's citations, and the remote in the test host | `pnpm --filter @lc/docs test`, `pnpm run docs:test` |
| The Docker image, `compose.yaml` or the `Caddyfile` | a check in `scripts/docker-smoke.sh` | `pnpm run docker:smoke` (`--proxy` for the proxy) |

Before a commit, run `pnpm run check` and `pnpm run test`; format with `pnpm run fmt`. After changing the courses or
the schedule rules: `pnpm run plan && pnpm run check && pnpm run test && pnpm run build`. CI
(`.github/workflows/ci.yml`) runs the format check, `pnpm run affected` and the stand's tests on pull requests and on
pushes to `main` and `develop`; the docs workflow runs the guide's own tests.

### Where the how-to lives

- [docs/architecture.md](docs/architecture.md): the layers, what may import what, and **Adding things**, the steps for a
  use case, a kind of edit, a port, an adapter, a page, a module or a server function.
- A `README.md` in every project under `apps/`, `modules/` and `packages/`: what it is, its public entry, how to run
  and test it.
- [docs/component-stand.md](docs/component-stand.md): the stand and how to add a story.
- [docs/rebalancing.md](docs/rebalancing.md): how a calendar is re-balanced.
- [CLAUDE.md](CLAUDE.md): the project's rules in short, for coding agents and people alike.

## What the viewer does

- **Views**: week grid (drag to move, drag the bottom edge to resize; drag across an empty part of a day to draw a
  new event, or double-click a slot: the form opens beside it and the dashed block follows what you type), month,
  one day, the whole year, and the whole plan as a list. `24 hours` shows the full day, `Expand` gives the
  calendar the whole window and `Full screen` the whole screen (where the browser allows it), `Work week` leaves
  Monday to Friday, and the two magnifiers change the time scale.
  The year view shades each day by its study hours. An event's dialog opens beside the event.
- **Quick event**: type a line with a time into the command search, such as `Разбор завтра 14:00 1ч` or
  `Review friday 18:30 30 min`, and it is offered as a new event. A day (today, tomorrow, a weekday, `23.11`) and
  a length are optional; Russian, English and Spanish words are known.
- **Second time zone**: `⋮` → `Second time zone` puts the clock of another zone next to the plan's Minsk time in
  the hour column. The choice is kept in the browser.
- **Dates**: the `Dates` tab of the side card is a month to jump with: a day or an ISO week number opens it.
- **Your real calendar behind the plan**: `Integrations` → `My calendar behind the plan` takes the secret iCal
  address of a work or personal calendar (Google: calendar settings → `Secret address in iCal format`; Outlook:
  `Publish` a calendar and copy the ICS link). Its busy time is then drawn in grey behind the week and day views,
  and the overlap warning names it. Nothing of it is stored in the plan or exported. The address is kept in the
  untracked `packages/plan-data/data/local.json`, or set with `BUSY_ICS_URL` on a host without a writable checkout;
  the browser only ever learns its host. The compact grid keeps the plan's hours: `24 hours` shows the whole day.
  Titles of that calendar are shown to anyone who can open the planner, so set it only where that is you.
- **Google Calendar and Outlook, kept in step**: `Integrations` → `Google Calendar` or `Outlook Calendar` writes the
  plan into calendars of its own in your account and keeps them up to date with every change, see
  [Keeping the plan in Google Calendar or Outlook](#keeping-the-plan-in-google-calendar-or-outlook).
- **Reminders**: `⋮` → `Reminders` shows a system notification ten minutes before each start, while the planner
  is open in a tab.
- **Focus**: `/focus` (the `Focus` tab) is one session and a stopwatch. `Finish` marks the session done and logs
  the time it really took, in quarter-hour steps; the stopwatch survives a reload. A pixel hourglass beside the
  digits counts down the planned session, or work blocks of 25 + 5, 50 + 10 or your own minutes, in the course's
  colour. When the sand runs out it chimes once; taking the break pauses the stopwatch and pours the rest through
  the glass, `Later` turns it for another block, and both survive a reload. The tab title shows the minutes left.
  The glass can be hidden or kept still (it also keeps still when the system asks for reduced motion). `Expand`
  (`E`) and `Full screen` (`Shift F`) make the glass and the digits the centre of the screen, as large as it allows,
  with the queue still beside them. How the glass was chosen: `docs/focus-hourglass-research.md`.
- **The plan's name**: click the title to rename the plan (Enter saves, Escape cancels). It is one history step,
  and the plan's own download (`<Title>.json`) and the combined `.ics` are named after it.
- **Your own calendars and events**: `＋ Calendars` renames and recolors any calendar and adds new ones;
  `＋ Event` creates an event in any of them.
- **One calendar at a time**: a click on a calendar chip hides or shows it; the eye that appears on the chip
  (or a double click, or `Only …` in the command search) leaves it as the only one, and `Show all` brings the
  rest back. It works the same with the calendar expanded.
- **Moving things**: every event can be dragged, in the week and in the month: one repeat of a repeating event moves
  alone and the other repeats stay (the event card's buttons and its form change the whole series), an all-day
  one moves between days. Both edges resize. Held at the top or the bottom of the hours on screen, an event (or a
  new one being drawn) scrolls the hidden hours in and then makes the day an hour longer at a time, so there is no
  need to switch to `24 hours` first. On a touch screen rest a finger on the event first. With the keyboard: `Alt`
  + arrows move the focused event, `Alt Shift ↑ ↓`
  change its length, `Delete` removes it; the event card has the same steps as buttons.
- **Trash**: any event or calendar can be removed, and a calendar can be cleared. What is removed waits in the
  trash for 30 days and can be restored; one repeat of a series can be skipped instead of deleting the series.
- **Progress**: mark a session done in its card. The side panel shows the session in progress or the next one
  with a countdown, the week's budget, a ring per course, and a map of all weeks (red bar = over the budget).
- **Plan files**: `Plan file` opens a reader on the plan: an overview, every event with search, and the file
  itself as colored JSON with line numbers, sections that fold (`Collapse sections` leaves the outline) and find. Choose or drop another `plan.json` to read it, see how it differs
  from the project plan, and open it for editing. Those changes stay in the browser until you download the file.
- **A library of plan files**: the `Library` tab of the reader keeps plan files with their versions on this
  computer (`packages/plan-data/data/library/`, not committed). `Save as a new file` stores the plan on screen;
  `Save a version here` adds a version to a file (up to 30 are kept, and saving an unchanged plan adds nothing).
  Each version can be viewed, compared with the one before it (`What changed`) or deleted; a file can be renamed,
  deleted, or opened with `Edit`, after which the bar on top saves your changes back as a new version.
- **Working with an AI chat**: the `AI chat` tab gives a brief to copy into any chat (the rules of the plan, how
  to add a course, how to name events and make them repeat, how to answer, and the plan itself) and takes the
  answer back. The chat answers with an *update*, a short JSON list of changes; the tab shows what it would add,
  remove and change, warns about weeks filled past the budget and about the rules it breaks (a session on a
  holiday or a weekend, at the same time as another, after its course's deadline, a finished one moved), and applies it as steps of the history that Undo
  takes back. An update is all or nothing: when one change does not fit, the tab says which, in words to send
  back to the chat. Ready requests fill the text for the common cases (a new course, days off, catching up, a
  lighter week, marking what is done, a weekly habit); `Copy and open` puts the brief on the clipboard and opens a
  new conversation in Claude, ChatGPT or Gemini; a single change of an update can be unticked before applying;
  when an answer does not fit, `Copy a request to fix it` gives the line to send back. `Connect a tool instead of
  copying` holds an instruction for an agent with HTTP access and the MCP entry.
  See [For language models and tools](#for-language-models-and-tools).
- **Progress dashboard**: `/dashboard` (the `Progress` tab) shows how much is done, whether that is ahead of or
  behind the plan, hours added up against the plan, the load of every week by calendar against the budget, and
  a bar per course. Every chart has a hover readout and the same numbers as a table. `Study streak` counts the
  study days in a row on which something was done (a day with no session does not break the run) and draws every
  day of the plan as a cell: done, missed or still ahead. `Expand` (`E`) spreads the charts across the whole
  window and `Full screen` (`Shift F`) across the whole screen.
- **History**: every change is a step you can take back and redo: `↶` `↷` in the toolbar, `Ctrl/⌘ Z` and
  `Ctrl/⌘ Shift Z`, or the `History` window (`H`), where any point of the timeline can be picked. The last 100
  steps are kept in `packages/plan-data/data/history.json`, which is local and not committed.
- **Real pace**: a session marked done shows `Time spent` in its card, in quarter-hour steps; without it the
  session counts as planned. From that the planner works out a pace per course (real hours per planned hour) and
  the dashboard's `Forecast at your pace` shows when the rest of each course will really be finished and how
  that sits against the nearest deadline. In the calendar such a session keeps its planned slot and shows
  what happened in it: the part it did not need is dashed, a session that ran over gets a hatched tail, and a
  timer next to its times (and `took …` in the list) gives the real length. The slot is not shortened, because
  the pace is the difference between the two.
- **Goals and the week review**: under the weekly budget the side panel lists the goals the schedule implies:
  the modules whose last session falls in the week on screen, what the month asks of each course, and how far
  the certificates are. They tick themselves as sessions are marked done. `Week review` sums the week up: hours
  done against the plan, the time they really took, goals met, sessions missed (with a way to catch up) and the
  goals of the next week.
- **Overlaps**: the event form and the event card name what else is planned for the same time. It is a warning:
  free time and all-day events block nothing, and two things at once can still be saved.
- **Reviews**: when every session of a module is done, a bar above the calendar offers three short reviews, one,
  three and seven days later, each in the first free half hour of its day. `Plan the reviews` adds them as one
  history step; they are sessions like any other (they count toward the budget and can be marked done), and the
  cross declines them for that module.
- **Catching up**: when sessions in the past are not done, a bar above the calendar offers to mark them done or
  to catch up. `Catch up` (also in the `⋮` menu) compares whole scenarios side by side: leave the plan, push
  every open session to the next study days (same weekly load, later end), or make the missed sessions up in the
  Saturday buffers and an extra hour a day (same end, heavier weeks). Each shows the day the plan ends, the room
  before the nearest deadline and the heaviest week, and is applied as one history step. In the week and day
  views the missed sessions are also listed under the bar as chips: drag one onto a slot of the grid to give it
  that time (its length stays), or click it to pick a time in its dialog. An event can be duplicated to the next
  day from its dialog.
- **Reschedule**: `⋮` → `Reschedule` has two modes.
  - `Move` shifts every session that is not done, from a chosen day, in every calendar or in the ones picked. It
    shifts by days and by hours; `+1 h`, `−1 h`, `+1 day`, `+1 week` and `−1 week` fill both in.
  - `Re-balance` spreads one calendar's open sessions over the study days ahead instead, from the course's first
    open session: it changes the rhythm and the end, never the start. It aims at one of two things. `Pace` keeps
    a pace, from one session every three study days to three a day; it starts at the course's own pace, which the
    dialog names. `Finish by` spreads the sessions evenly up to a day, which starts at the day before the
    calendar's deadline, or at the course's last session; another day there leaves the deadline as it is.
    The study hours, and whether a week may go over the budget, are part of the request.

  While the inputs change, the dialog shows when the course ends, its heaviest week and how many sessions move.
  When it cannot do better, it says why ("the weeks of 11 Jan – 7 Feb are full"). Apply stores the result as one
  history step. Each calendar can have its own deadline, set, moved or cleared in the same dialog and kept as the
  calendar's milestone. Catch up uses the nearest one. How the re-balance chooses, with a worked example:
  [docs/rebalancing.md](docs/rebalancing.md).
- **Countdown**: the bar above the calendar counts the days to one course's deadline and names the course and the
  day under the number. `Set up` on it chooses what to count to: the nearest deadline of any course, or a course of
  your choice, and sets, moves or clears that course's deadline day. The choice is kept in the plan (an undoable
  step of the history), so the goals, the days-left tile and the forecast on Progress count to the same deadline.
  With nothing to count to, the bar offers to set a deadline instead of disappearing.
- **Timeline**: `/timeline` (the `Timeline` tab) is a lane per course, in its colour: its sessions from the first
  to the last (done, open, missed), the spare days before its deadline (◆) or the late ones after it, and today.
  The whole plan fits the width; `Month` and `Week` zoom in and scroll (the mouse wheel, Shift + wheel or a swipe,
  or grab the empty days and drag), keeping the day in the middle of the view; `Today` jumps back. `Expand` (`E`)
  gives the chart the whole window and `Full screen` (`Shift F`) the whole screen; the how-to under the title folds
  away. Drag a lane to move its
  open sessions by whole weeks, its end to re-balance the course to finish by that day, ◆ to move the deadline; the
  end and ◆ also move with the arrow keys and Enter. Or pick a course and change it on the panel beside the chart,
  which shows its dates, deadline and spare days now and in the draft; `More options…` opens Reschedule for it.
  Nothing is stored on a drop: changes gather in a draft drawn over the plan as it is (a dashed line where the
  course was, moved sessions ringed, the days it moves by), and the bar at the bottom counts the courses and
  sessions it changes and the rules it breaks. `Review` lists every session old → new, `Discard` drops the draft and
  `Apply` stores it in one go, each change a history step, with Undo for all of them. A re-balance is worked out on
  the server while the course says so; Apply waits for it. Leaving for another section with a draft asks first.
- **Controls**: the toolbar keeps the view switch, the week navigation (the title opens a date picker), search,
  undo/redo and `＋ Event`; History, Trash, Reschedule, Calendars and Shortcuts live in the `⋮` menu, which
  on a phone also holds search, undo/redo and the view toggles.
- **The list**: a filter leaves what is open, done or overdue, and each day shows its hours of study. On an
  editable plan the rows have checkboxes: the ticked events can be marked done or not done, moved a day back, a
  day or a week forward, or sent to the trash together. A repeat is changed from its own card.
- **A free slot**: the event card of an open session finds the nearest time with no overlaps (repeats and your
  real calendar included), not on a weekend or a holiday and inside the weekly budget, trying the session's own
  hour first; `Move here` takes it. The card also copies a link to the event and opens Google Calendar with the
  event filled in.
- **Split a long session**: the scissors on the card of a session of an hour or more cut it in two on the half
  hour, the second part right after the first, to drag to another time. Both keep the title and notes; a lab, a
  repeat and a finished session stay whole. A chat does the same with `event.split`, on any days.
- **Less on screen, and on paper**: `⋮` → `Hide what is done` (key `X`) leaves the finished sessions out of the
  day, week and month views. `Print or PDF` prints the calendar alone, whole, without the toolbars and the side
  panel. The month view shows the hours of study of each day.
- **Help marks**: the `?` button in the header of every page (in the `⋮` menu on a phone and in the expanded
  calendar) shows a question mark next to the main features; a click on a mark opens a short note about the thing
  beside it. The choice is kept in the browser.
- **Icons only**: the `T` button next to `?` (in the `⋮` menu on a phone and in the expanded calendar) hides the
  word of every button that has an icon, so a toolbar takes less room. The word stays the button's name for a
  screen reader, and its tooltip shows it. Tooltips come a moment after the pointer rests on a button, at once
  along a toolbar and when the keyboard reaches it. The choice is kept in the browser.
- **Keyboard**: `Ctrl/⌘ K` or `/` searches events and commands (including the theme and the language), `?` lists
  the shortcuts: `D` `W` `M` `Y` `L` for the views, `5` for the work week, `+` `-` for the time scale, `E` to
  expand and `Shift F` for full screen.

Everything changed in the viewer is stored in `packages/plan-data/data/edits.json` (event patches, calendars,
added events, the trash) and applied on top of the generated schedule, so `pnpm run plan` never loses it.

## Languages

The interface is in Russian (`/ru/…`, the default), English (`/en/…`) and Spanish (`/es/…`), built with
[Paraglide JS](https://paraglidejs.com). Plan content (event titles, descriptions, calendar notes) and the
exported files are Russian only.

A URL without a language prefix redirects to `/ru/…`. The `/api/…` endpoints have no prefix.

- Messages live in `packages/i18n/messages/{ru,en,es}.json`; `packages/i18n/project.inlang/` holds the locale list and compiler options.
- `packages/i18n/src/paraglide/` is generated and git-ignored: never edit it.
- Dates and hours are formatted per locale in `packages/i18n/src/format.ts`.
- To review translations side by side, open the repo in [Fink](https://fink.inlang.com) or use the Sherlock
  extension in VS Code.

Styling is [Tailwind CSS](https://tailwindcss.com) v4; the color tokens and theme are in `packages/ui/src/theme.css`.

## How the plan is made

1. **Content** — `packages/plan-content/src/content.ts`: every course is a queue of sessions (title, 1 h or 2 h, description).
   Calendars and their colors are defined here too.
2. **Rules** — `packages/plan-content/src/schedule.ts` (`DEFAULT_CONFIG`): date ranges, holidays, slots, weekly budget.
   - Certificates: weekdays 12:00–14:00 from 23 Nov; a 2 h challenge lab always starts at 12:00.
   - From 4 Jan: 11:00 HF LLM → Practical Python, 12:00 HF Agents, Mon/Wed 13:00 Practical Python.
   - Saturday 10:00–12:00 buffer (free time), gym Tue/Thu 08:30–10:30 (recurring).
3. **Database** — `pnpm run plan` writes `packages/plan-data/data/plan.json`. The app, the API and the export all read this file.
   The script warns if any week goes over the budget.

To change the plan: edit content or rules → `pnpm run plan` → check it in the viewer → export.
You can also open any `plan.json` in the viewer ("Открыть файл плана") without changing the project.

## Importing into a calendar

Use `Integrations` → `Export to calendar` in the viewer (separate calendars as a zip or one `.ics` each, or
everything as one `.ics` for a single calendar), or `pnpm run plan --ics`. Pick the calendar app under `Where to`
(Google Calendar, Outlook, Apple Calendar or another) and the dialog shows the import steps for it; the choice is
remembered. `Mark finished sessions` puts a ✓ before the title of every done session and stops it blocking time;
when its real length was logged, its notes start with it, `✓ 1:15 / 1:00` (took / planned). `Add a reminder` puts a
10-minute alarm on every timed session that is not done; the calendar app decides whether to keep it.

1. Create the calendars marked "создать календарь" (Gemini Certs, Practical Python, Личное).
2. Delete old future events from existing calendars, otherwise you get duplicates.
3. Import each `.ics` into the calendar with the same name:
   - Google Calendar: Settings → Import & export → Import.
   - Outlook: Add calendar → Upload from file.

## Keeping the plan in Google Calendar or Outlook

The planner can write the plan into Google Calendar, Outlook (Microsoft 365 or Outlook.com) or both, so a phone
shows it without importing or subscribing to anything. Each plan calendar becomes a calendar of its own in your
account, named the same. Remove an imported or subscribed copy of the plan first, or it shows twice. Both apps are
set up and watched from `Integrations` in the header (also in the `⋮` menu), which shows how each stands next to
the busy-time overlay and the export.

What goes where, the same for both apps:

- **Plan → app**: every change saved in the planner or through `POST /api/plan-update`, undo and redo included,
  is sent right away; a change made by `pnpm run plan` or the MCP server goes with the next round. A round runs when
  the planner opens, when it is shown again after a minute away, about every ten minutes while it is open, and on
  `Sync now`. A done session gets ✓ before its title, stops blocking time and starts its notes with how long it took.
- **App → plan**: an edit made in the app is taken into the plan by itself, like one made in the planner: a ✓
  typed before a title (or taken away), a new title, a single session moved, one repeat of a series moved or
  deleted, and a deleted session, which goes to the trash. Each is a step of the history marked with the calendar
  icon and the app's name, and a bar offers `Undo` for the latest ones; undoing writes the plan's version back.
- **Decisions**: an edit to something the planner changed too since it was last sent (the time of a session moved in
  both places, say) or one the plan cannot take waits in a bar over the calendar, `Changes from your calendars that
  need a decision`, and is left alone in the app until you pick `Keep plan` or `Use Google's` / `Use Outlook's`. A
  cleared title, a whole series moved in the app and notes edited there are not taken: the plan's version is written
  back the next time that event changes.

Each app needs an OAuth client of your own, made once; its dialog walks through it, each step with a link to its
page of the provider's console and the value to paste there. The client and the sign-in are kept in the untracked
`packages/plan-data/data/local.json`, readable only by you; `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and
`OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET` set the clients instead. What was written to each app and the changes
waiting for you are in the untracked `data/sync.json`. `Disconnect` signs out and leaves the calendars in the app;
connecting again picks them up. The app chooses the calendars' colours. Nothing is synced where the plan cannot be
edited (`PLAN_READONLY=1`).

### Google Calendar

The app sees only the calendars it made (scope `calendar.app.created`, no access to your address or other
calendars). About ten minutes:

1. [Turn on the Google Calendar API](https://console.cloud.google.com/flows/enableapi?apiid=calendar-json.googleapis.com);
   Google offers to make a project for it.
2. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), `Get started`: any app name, your
   address as the support and contact address. As the audience, pick `Personal` when it is offered: only your own
   account can sign in, with no weekly sign-out and no verification (it cannot be changed later). Otherwise pick
   `External`, and under `Audience` either `Publish app` (Google shows an "unverified app" screen at sign-in:
   `Advanced` → `Go to …`) or add your account as a test user, which Google signs out every 7 days; the planner
   then asks to connect again, and nothing is lost meanwhile.
3. Under [Data access](https://console.cloud.google.com/auth/scopes), `Add or remove scopes`, paste
   `https://www.googleapis.com/auth/calendar.app.created` under `Manually add scopes`, add it to the table and save.
4. Under [Clients](https://console.cloud.google.com/auth/clients), `Create client` of type **Web application**, with
   the address you open the planner at plus `/api/google/callback` (`http://localhost:3000/api/google/callback` for
   `pnpm run dev`) as its authorized redirect URI. Download the JSON Google offers: the secret is shown only then.
5. In the dialog, load that JSON (or paste the client ID and secret) and press `Save and connect`, then allow access
   on Google's page. The dialog says so when the file lacks the redirect URI of the page you are on.

### Outlook

Microsoft has no scope limited to the calendars an app made, so the app is granted `Calendars.ReadWrite` on the
whole account; the planner only ever reads and writes the calendars it made. About five minutes, in
[Microsoft Entra](https://entra.microsoft.com), with a work, school or personal Microsoft account:

1. Under App registrations, `New registration`, any name. For `Supported account types`, pick the option that
   includes personal Microsoft accounts.
2. In the same form, under `Redirect URI`, choose `Web` and enter the address you open the planner at plus
   `/api/outlook/callback` (`http://localhost:3000/api/outlook/callback` for `pnpm run dev`), then `Register`.
3. Under `Certificates & secrets`, add a `New client secret` and copy its **Value** (not the Secret ID): it is shown
   only once.
4. In the dialog, paste the `Application (client) ID` from the registration's `Overview` and the secret, press
   `Save and connect`, then allow access on Microsoft's page.

With a work or school account, an administrator may have to approve the app first. A Microsoft account without an
Outlook mailbox has no calendars to write to, and the dialog says so. Outlook cannot bring back a cancelled repeat
of a series, so undoing one deletes the series and writes it again.

## API

| Route | Response |
|---|---|
| `GET /api/plan` | The plan as JSON |
| `GET /api/ics/:calendarId` | One calendar as `.ics` (`certs`, `hfllm`, `hfagents`, `pypy`, `journey`, `personal`); add `?download=1` for an attachment, `?done=1` to mark finished sessions, `?alarm=10` for a reminder that many minutes before each start |
| `GET /api/ics/all` | Every calendar's events in one `.ics`; `?calendars=certs,hfllm` narrows it |
| `GET /api/ics-zip` | All calendars in one zip |

Once deployed on a public URL, `/api/ics/:calendarId` can be added in Google Calendar or Outlook as a
subscription ("From URL"). The calendar then updates itself after each deploy, with no re-import and no duplicates.
Subscribed calendars are read-only; Outlook refreshes them about every 3 hours, Google does not say. Every event
carries its version (`SEQUENCE`, `LAST-MODIFIED`), counted up with each change in the untracked
`packages/plan-data/data/sync.json`, and a client that sends back the `ETag` gets `304` while nothing changed.
`docs/calendar-sync-research.md` compares the ways of keeping a calendar in step.


## For language models and tools

The plan is described so that a model can change it without guessing. Three documents come from
`packages/plan-domain` and are the same wherever they are served:

- **The guide** (`planGuide`): Markdown generated from the plan itself, with its calendars, the hours planned per
  week, the rules (budget, holidays, what is done stays), how to name things, how to add a course, how to mark a
  repeat and how to answer. It opens with the contract in five lines, its examples are dated from today, and the
  brief puts the plan in `<plan>` tags, the request in `<request>` tags after it and the contract once more at the
  end. Why: [docs/llm-integration-research.md](docs/llm-integration-research.md).
- **The schemas** (`PLAN_SCHEMA`, `UPDATE_SCHEMA`): JSON Schema of the plan file and of an update, with a
  description on every field.
- **The update** (`parseUpdate`, `previewUpdate`): `{ "summary": "…", "changes": [ … ] }`. The changes are the same
  `PlanChange` values the viewer stores, among them `course.add` (a calendar with all its sessions) and
  `events.add`; a new event may carry `"rrule": "FREQ=WEEKLY;BYDAY=TU,TH"`. The whole update is checked before any
  change is stored. Its preview lists the rules of the plan it breaks (`ruleWarnings`): they warn, the person decides.

| Way in | What it gives |
| --- | --- |
| `Plan file` → `AI chat` | Copy the brief, paste the answer, preview, apply. No network: the clipboard only |
| `GET /api/plan-guide` | The guide; `?brief=1` adds the plan, `&descriptions=1` keeps event notes |
| `GET /api/plan-schema` | `{ plan, update }`: both JSON Schemas |
| `GET /api/plan-accuracy` | How logged times compare with the plan, per course and kind, with each course's finish range; `?calendar=` keeps one course |
| `POST /api/plan-update` | Takes an update as JSON or as the text of a chat answer; `?dry=1` only reports what it would do. 422 names the change at fault, 403 on a read-only host |
| `pnpm run mcp` | An MCP server over stdio: tools `get_guide`, `get_plan`, `get_accuracy`, `preview_update`, `apply_update`, `rebalance_calendar`; resources `plan://guide`, `plan://plan`, `plan://schema/plan`, `plan://schema/update`; prompt `change_plan` |

`rebalance_calendar` works out a re-balance of one calendar and changes nothing itself. It returns the moves as
an update to pass to `preview_update` and `apply_update`, with the same report the dialog shows.

`.mcp.json` registers the MCP server for Claude Code in this repository. For another client, run
`pnpm --silent run mcp` from the repository root (`--silent` keeps stdout for the protocol). `pnpm run test`
checks that the schemas, the examples of the guide and the parser agree.

Every open page follows the plan on disk: a change made in another tab or window, the AI chat, the MCP server, a
calendar sync or `pnpm run plan` shows on the planner, the timeline, Focus and Progress within two seconds, without
a reload. A page out of sight checks again when it comes back.

## Structure

```
apps/web/                    TanStack Start shell: routes, server functions, /api/*; builds the services once
  src/routes/                index.tsx (planner; ?week=YYYY-MM-DD&view=day|week|month|year|list), timeline.tsx,
                             focus.tsx, dashboard.tsx, api/ (plan, plan-update, plan-accuracy, plan-schema,
                             plan-guide, ics, ics-zip, calendar sign-in)
apps/mcp/                    the MCP server over stdio
apps/docs/                   the guide: a static site and the docs remote
apps/docs-harness/           a minimal host that tests the docs remote
apps/stand/                  the component stand (Storybook)
modules/planner/             planner, timeline and focus pages, Feature-Sliced layers inside
modules/calendar-export/     export dialog
modules/dashboard/           progress page
packages/plan-domain/        the rules, pure TypeScript: core, insights, protocol, ics, sync, rebalance, fixtures
packages/plan-content/       the courses (content.ts) and the schedule (schedule.ts)
packages/plan-service/       ports, use cases, failures as values; ./testing for tests
packages/plan-data/          the adapters (files, iCal, HiGHS, Google, Outlook), data/, and `pnpm run plan`
packages/docs-contract/      the docs remote's public contract
packages/remote-host/        loading a federated module into a React host
packages/i18n/               messages, Paraglide output, format.ts
packages/ui/                 the UI kit and the theme
```

The rules for what may import what are in [docs/architecture.md](docs/architecture.md).

Times are stored as Europe/Minsk wall-clock strings (`2026-11-23T12:00`, UTC+3, no DST) and handled as
UTC-naive values, so the server and any browser agree regardless of their own time zone.
