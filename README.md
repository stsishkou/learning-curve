# learning-curve

Personal study plan as code: a schedule database (`packages/plan-data/data/plan.json`), a viewer built on
[TanStack Start](https://tanstack.com/start), and `.ics` export for Google Calendar and Outlook.

The repository is an [Nx](https://nx.dev) + pnpm workspace: a thin app in `apps/web`, feature modules in
`modules/`, shared packages in `packages/`. See [docs/architecture.md](docs/architecture.md).

## Quick start

```bash
pnpm install
pnpm run dev          # http://localhost:3000
```

Requires Node 26+ and pnpm 12.

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
| `pnpm run plan` | Rebuilds `plan.json` from the course content, schedule rules and manual edits |
| `pnpm run plan --ics` | Same, plus writes `packages/plan-data/exports/*.ics` and import instructions |
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

## What the viewer does

- **Views**: week grid (drag to move, drag the bottom edge to resize; drag across an empty part of a day to draw a
  new event, or double-click a slot: the form opens beside it and the dashed block follows what you type), month,
  one day, the whole year, and the whole plan as a list. `24 hours` shows the full day, `Expand` gives the
  calendar the whole window, `Work week` leaves Monday to Friday, and the two magnifiers change the time scale.
  The year view shades each day by its study hours. An event's dialog opens beside the event.
- **Quick event**: type a line with a time into the command search, such as `Разбор завтра 14:00 1ч` or
  `Review friday 18:30 30 min`, and it is offered as a new event. A day (today, tomorrow, a weekday, `23.11`) and
  a length are optional; Russian, English and Spanish words are known.
- **Second time zone**: `⋮` → `Second time zone` puts the clock of another zone next to the plan's Minsk time in
  the hour column. The choice is kept in the browser.
- **Dates**: the `Dates` tab of the side card is a month to jump with: a day or an ISO week number opens it.
- **Your real calendar behind the plan**: `⋮` → `My calendar behind the plan` takes the secret iCal address of a
  work or personal calendar (Google: calendar settings → `Secret address in iCal format`; Outlook: `Publish` a
  calendar and copy the ICS link). Its busy time is then drawn in grey behind the week and day views, and the
  overlap warning names it. Nothing of it is stored in the plan or exported. The address is kept in the untracked
  `packages/plan-data/data/local.json`, or set with `BUSY_ICS_URL` on a host without a writable checkout; the
  browser only ever learns its host. The compact grid keeps the plan's hours: `24 hours` shows the whole day.
  Titles of that calendar are shown to anyone who can open the planner, so set it only where that is you.
- **Reminders**: `⋮` → `Reminders` shows a system notification ten minutes before each start, while the planner
  is open in a tab.
- **Focus**: `/focus` (the `Focus` tab) is one session and a stopwatch. `Finish` marks the session done and logs
  the time it really took, in quarter-hour steps; the stopwatch survives a reload.
- **The plan's name**: click the title to rename the plan (Enter saves, Escape cancels). It is one history step,
  and the plan's own download (`<Title>.json`) and the combined `.ics` are named after it.
- **Your own calendars and events**: `＋ Calendars` renames and recolors any calendar and adds new ones;
  `＋ Event` creates an event in any of them.
- **One calendar at a time**: a click on a calendar chip hides or shows it; the eye that appears on the chip
  (or a double click, or `Only …` in the command search) leaves it as the only one, and `Show all` brings the
  rest back. It works the same with the calendar expanded.
- **Moving things**: every event can be dragged, in the week and in the month: one repeat of a repeating event moves
  alone and the other repeats stay (the event card's buttons and its form change the whole series), an all-day
  one moves between days. Both edges resize. On a touch screen
  rest a finger on the event first. With the keyboard: `Alt` + arrows move the focused event, `Alt Shift ↑ ↓`
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
  remove and change, warns about weeks filled past the budget, and applies it as steps of the history that Undo
  takes back. An update is all or nothing: when one change does not fit, the tab says which, in words to send
  back to the chat. See [For language models and tools](#for-language-models-and-tools).
- **Progress dashboard**: `/dashboard` (the `Progress` tab) shows how much is done, whether that is ahead of or
  behind the plan, hours added up against the plan, the load of every week by calendar against the budget, and
  a bar per course. Every chart has a hover readout and the same numbers as a table.
- **History**: every change is a step you can take back and redo: `↶` `↷` in the toolbar, `Ctrl/⌘ Z` and
  `Ctrl/⌘ Shift Z`, or the `History` window (`H`), where any point of the timeline can be picked. The last 100
  steps are kept in `packages/plan-data/data/history.json`, which is local and not committed.
- **Real pace**: a session marked done shows `Time spent` in its card, in quarter-hour steps; without it the
  session counts as planned. From that the planner works out a pace per course (real hours per planned hour) and
  the dashboard's `Forecast at your pace` shows when the rest of each course will really be finished and how
  that sits against the certificate deadline.
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
  before the certificate deadline and the heaviest week, and is applied as one history step. `Shift the plan`
  moves every session that is not done, from a chosen
  day and optionally in one calendar, by a number of days; it is one history step. An event can be duplicated
  to the next day from its dialog.
- **Controls**: the toolbar keeps the view switch, the week navigation (the title opens a date picker), search,
  undo/redo and `＋ Event`; History, Trash, Shift the plan, Calendars and Shortcuts live in the `⋮` menu, which
  on a phone also holds search, undo/redo and the view toggles.
- **Keyboard**: `Ctrl/⌘ K` or `/` searches events and commands (including the theme and the language), `?` lists
  the shortcuts: `D` `W` `M` `Y` `L` for the views, `5` for the work week, `+` `-` for the time scale.

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

1. **Content** — `packages/plan-domain/src/content.ts`: every course is a queue of sessions (title, 1 h or 2 h, description).
   Calendars and their colors are defined here too.
2. **Rules** — `packages/plan-domain/src/schedule.ts` (`DEFAULT_CONFIG`): date ranges, holidays, slots, weekly budget.
   - Certificates: weekdays 12:00–14:00 from 23 Nov; a 2 h challenge lab always starts at 12:00.
   - From 4 Jan: 11:00 HF LLM → Practical Python, 12:00 HF Agents, Mon/Wed 13:00 Practical Python.
   - Saturday 10:00–12:00 buffer (free time), gym Tue/Thu 08:30–10:30 (recurring).
3. **Database** — `pnpm run plan` writes `packages/plan-data/data/plan.json`. The app, the API and the export all read this file.
   The script warns if any week goes over the budget.

To change the plan: edit content or rules → `pnpm run plan` → check it in the viewer → export.
You can also open any `plan.json` in the viewer ("Открыть файл плана") without changing the project.

## Importing into a calendar

Use **Экспорт в календарь** in the viewer (separate calendars as a zip or one `.ics` each, or everything as one
`.ics` for a single calendar), or `pnpm run plan --ics`. Pick the calendar app under `Where to` (Google Calendar, Outlook,
Apple Calendar or another) and the dialog shows the import steps for it; the choice is remembered. `Mark finished
sessions` puts a ✓ before the title of every done session and stops it blocking time. `Add a reminder` puts a
10-minute alarm on every timed session that is not done; the calendar app decides whether to keep it.

1. Create the calendars marked "создать календарь" (Gemini Certs, Practical Python, Личное).
2. Delete old future events from existing calendars, otherwise you get duplicates.
3. Import each `.ics` into the calendar with the same name:
   - Google Calendar: Settings → Import & export → Import.
   - Outlook: Add calendar → Upload from file.

## API

| Route | Response |
|---|---|
| `GET /api/plan` | The plan as JSON |
| `GET /api/ics/:calendarId` | One calendar as `.ics` (`certs`, `hfllm`, `hfagents`, `pypy`, `journey`, `personal`); add `?download=1` for an attachment, `?done=1` to mark finished sessions, `?alarm=10` for a reminder that many minutes before each start |
| `GET /api/ics/all` | Every calendar's events in one `.ics`; `?calendars=certs,hfllm` narrows it |
| `GET /api/ics-zip` | All calendars in one zip |

Once deployed on a public URL, `/api/ics/:calendarId` can be added in Google Calendar or Outlook as a
subscription ("From URL"). The calendar then updates itself after each deploy, with no re-import and no duplicates.
Subscribed calendars are read-only and Google refreshes them every few hours.


## For language models and tools

The plan is described so that a model can change it without guessing. Three documents come from
`packages/plan-domain` and are the same wherever they are served:

- **The guide** (`planGuide`): Markdown generated from the plan itself, with its calendars, the hours planned per
  week, the rules (budget, holidays, what is done stays), how to name things, how to add a course, how to mark a
  repeat and how to answer.
- **The schemas** (`PLAN_SCHEMA`, `UPDATE_SCHEMA`): JSON Schema of the plan file and of an update, with a
  description on every field.
- **The update** (`parseUpdate`, `previewUpdate`): `{ "summary": "…", "changes": [ … ] }`. The changes are the same
  `PlanChange` values the viewer stores, among them `course.add` (a calendar with all its sessions) and
  `events.add`; a new event may carry `"rrule": "FREQ=WEEKLY;BYDAY=TU,TH"`. The whole update is checked before any
  change is stored.

| Way in | What it gives |
| --- | --- |
| `Plan file` → `AI chat` | Copy the brief, paste the answer, preview, apply. No network: the clipboard only |
| `GET /api/plan-guide` | The guide; `?brief=1` adds the plan, `&descriptions=1` keeps event notes |
| `GET /api/plan-schema` | `{ plan, update }`: both JSON Schemas |
| `POST /api/plan-update` | Takes an update as JSON or as the text of a chat answer; `?dry=1` only reports what it would do. 422 names the change at fault, 403 on a read-only host |
| `pnpm run mcp` | An MCP server over stdio: tools `get_guide`, `get_plan`, `preview_update`, `apply_update`; resources `plan://guide`, `plan://plan`, `plan://schema/plan`, `plan://schema/update`; prompt `change_plan` |

`.mcp.json` registers the MCP server for Claude Code in this repository. For another client, run
`pnpm --silent run mcp` from the repository root (`--silent` keeps stdout for the protocol). `pnpm run test`
checks that the schemas, the examples of the guide and the parser agree.

## Structure

```
apps/web/                    TanStack Start shell
  src/routes/                index.tsx (planner; ?week=YYYY-MM-DD&view=day|week|month|year|list), focus.tsx,
                             dashboard.tsx, api/ (plan, ics, ics-zip)
  src/server/                server functions: read the plan, save an event edit
modules/planner/             planner and focus pages, Feature-Sliced layers inside
modules/calendar-export/     export button and dialog
packages/plan-domain/src/
  content.ts                 courses, sessions, calendars
  schedule.ts                scheduling rules → Plan
  edits.ts                   manual changes applied over the schedule
  ics.ts                     RFC 5545 export
  occurrences.ts             expands events (RRULE, all-day) for a date range
  dates.ts                   Minsk wall-clock date helpers
packages/plan-data/          data/plan.json (generated, committed), data/edits.json, scripts/build-plan.ts
packages/i18n/               messages, Paraglide output, format.ts
packages/ui/                 buttons, segmented control, modal, theme.css
```

The rules for what may import what are in [docs/architecture.md](docs/architecture.md).

Times are stored as Europe/Minsk wall-clock strings (`2026-11-23T12:00`, UTC+3, no DST) and handled as
UTC-naive values, so the server and any browser agree regardless of their own time zone.
