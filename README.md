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
`.ics` for a single calendar), or `pnpm run plan --ics`.

1. Create the calendars marked "создать календарь" (Gemini Certs, Practical Python, Личное).
2. Delete old future events from existing calendars, otherwise you get duplicates.
3. Import each `.ics` into the calendar with the same name:
   - Google Calendar: Settings → Import & export → Import.
   - Outlook: Add calendar → Upload from file.

## API

| Route | Response |
|---|---|
| `GET /api/plan` | The plan as JSON |
| `GET /api/ics/:calendarId` | One calendar as `.ics` (`certs`, `hfllm`, `hfagents`, `pypy`, `journey`, `personal`); add `?download=1` for an attachment |
| `GET /api/ics/all` | Every calendar's events in one `.ics`; `?calendars=certs,hfllm` narrows it |
| `GET /api/ics-zip` | All calendars in one zip |

Once deployed on a public URL, `/api/ics/:calendarId` can be added in Google Calendar or Outlook as a
subscription ("From URL"). The calendar then updates itself after each deploy, with no re-import and no duplicates.
Subscribed calendars are read-only and Google refreshes them every few hours.

## Structure

```
apps/web/                    TanStack Start shell
  src/routes/                index.tsx (planner; ?week=YYYY-MM-DD&view=week|list), api/ (plan, ics, ics-zip)
  src/server/                server functions: read the plan, save an event edit
modules/planner/             planner page, Feature-Sliced layers inside
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
