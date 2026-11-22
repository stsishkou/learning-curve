# learning-curve

Personal study plan as code: a schedule database (`src/data/plan.json`), a viewer built on
[TanStack Start](https://tanstack.com/start), and `.ics` export for Google Calendar and Outlook.

## Quick start

```bash
pnpm install
pnpm run dev          # http://localhost:3000
```

Requires Node 26+ and pnpm 12.

## Scripts

| Command | What it does |
|---|---|
| `pnpm run dev` | Dev server on port 3000 |
| `pnpm run plan` | Rebuilds `src/data/plan.json` from the course content and schedule rules |
| `pnpm run plan --ics` | Same, plus writes `exports/*.ics` and import instructions |
| `pnpm run build` / `pnpm start` | Production build (Nitro) and Node server from `.output/` |
| `pnpm run typecheck` | Compiles the messages, then `tsc --noEmit` |
| `pnpm run i18n` | Compiles `messages/*.json` into `src/paraglide/` (also runs on install, dev and build) |
| `pnpm run check:i18n` | Fails on missing or empty translations, mismatched variables, missing plural forms and unused messages |
| `pnpm run lint` / `pnpm run lint:fix` | [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) with type-aware, React, accessibility and Paraglide rules (`.oxlintrc.json`) |
| `pnpm run fmt` / `pnpm run fmt:check` | [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html): formatting, import order and Tailwind class order (`.oxfmtrc.json`) |
| `pnpm run check` | Typecheck, lint, format check and translation check in one go |

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat: …`, `fix: …`, `build: …`);
a Husky `commit-msg` hook checks them with commitlint.

## Languages

The interface is in Russian (default, unprefixed URLs), English (`/en/…`) and Spanish (`/es/…`), built with
[Paraglide JS](https://paraglidejs.com). Plan content (event titles, descriptions, calendar notes) and the
exported files are Russian only.

- Messages live in `messages/{ru,en,es}.json`; `project.inlang/` holds the locale list and compiler options.
- `src/paraglide/` is generated and git-ignored: never edit it.
- Dates and hours are formatted per locale in `src/lib/format.ts`.
- To review translations side by side, open the repo in [Fink](https://fink.inlang.com) or use the Sherlock
  extension in VS Code.

Styling is [Tailwind CSS](https://tailwindcss.com) v4; the color tokens and theme are in `src/styles.css`.

## How the plan is made

1. **Content** — `src/lib/plan/content.ts`: every course is a queue of sessions (title, 1 h or 2 h, description).
   Calendars and their colors are defined here too.
2. **Rules** — `src/lib/plan/schedule.ts` (`DEFAULT_CONFIG`): date ranges, holidays, slots, weekly budget.
   - Certificates: weekdays 12:00–14:00 from 23 Nov; a 2 h challenge lab always starts at 12:00.
   - From 4 Jan: 11:00 HF LLM → Practical Python, 12:00 HF Agents, Mon/Wed 13:00 Practical Python.
   - Saturday 10:00–12:00 buffer (free time), gym Tue/Thu 08:30–10:30 (recurring).
3. **Database** — `pnpm run plan` writes `src/data/plan.json`. The app, the API and the export all read this file.
   The script warns if any week goes over the budget.

To change the plan: edit content or rules → `pnpm run plan` → check it in the viewer → export.
You can also open any `plan.json` in the viewer ("Открыть файл плана") without changing the project.

## Importing into a calendar

Use **Экспорт в календарь** in the viewer (zip or one `.ics` per calendar), or `pnpm run plan --ics`.

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
| `GET /api/ics-zip` | All calendars in one zip |

Once deployed on a public URL, `/api/ics/:calendarId` can be added in Google Calendar or Outlook as a
subscription ("From URL"). The calendar then updates itself after each deploy, with no re-import and no duplicates.
Subscribed calendars are read-only and Google refreshes them every few hours.

## Structure

```
scripts/build-plan.ts        regenerates the database
src/data/plan.json           the database (generated, committed)
src/lib/plan/
  content.ts                 courses, sessions, calendars
  schedule.ts                scheduling rules → Plan
  ics.ts                     RFC 5545 export
  occurrences.ts             expands events (RRULE, all-day) for a date range
  dates.ts                   Minsk wall-clock date helpers
  types.ts
src/components/              Runway, WeekGrid, AgendaList, BudgetPanel, Dialogs
src/routes/
  index.tsx                  viewer; ?week=YYYY-MM-DD&view=week|list
  api/                       plan, ics.$calendarId, ics-zip
```

Times are stored as Europe/Minsk wall-clock strings (`2026-11-23T12:00`, UTC+3, no DST) and handled as
UTC-naive values, so the server and any browser agree regardless of their own time zone.
