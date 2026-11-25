import { MIN_LOGGED } from './accuracy'
import { accuracyReport } from './accuracy-report'
import { DAY, mondayOf, startOfDay, weekday, ymd } from './dates'
import { isSession, plannedHours } from './progress'
import { weeklyHours } from './schedule'
import { UPDATE_FORMAT } from './schema'
import type { Plan, PlanEvent } from './types'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The first day after `now` that is the weekday `dow` (0 Sunday … 6 Saturday), so the examples are never in the past. */
const nextWeekday = (now: number, dow: number) => startOfDay(now) + (((dow - weekday(now) + 6) % 7) + 1) * DAY

const CONTRACT = `- Answer with **one** \`\`\`json block that holds an update, and no other code block.
- Point at events only by a \`uid\` you read in the plan.
- Every time is \`YYYY-MM-DDTHH:MM\` in the plan's time zone.
- Send only what changes, never a copy of the plan.
- When the request is unclear or breaks a rule, ask a question instead of sending an update.`

const code = (value: unknown) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``

/** A plan small enough for a prompt: the same file with the event descriptions left out unless asked for. */
export function compactPlan(plan: Plan, descriptions = false): Plan {
  if (descriptions) return plan
  return {
    ...plan,
    events: plan.events.map(({ description: _notes, ...event }): PlanEvent => ({ ...event, description: '' })),
  }
}

function calendarLines(plan: Plan): string[] {
  return plan.calendars.map((c) => {
    const sessions = plan.events.filter((e) => e.calendar === c.id && isSession(e))
    const left = sessions.filter((e) => !e.done)
    const short = sessions[0]?.title.match(/^(.+?) — /)?.[1]
    const titles = short ? `, short name in titles: "${short}"` : ''
    const facts = sessions.length
      ? `${sessions.length} sessions, ${left.length} not done (${left.reduce((sum, e) => sum + plannedHours(e), 0)} h)${titles}`
      : 'no sessions'
    const labels = c.labels?.length ? `, labels: ${c.labels.map((label) => `"${label}"`).join(', ')}` : ''
    const hidden = c.hidden ? ', hidden in the viewer' : ''
    return `- \`${c.id}\`: ${c.name} (${c.color}${labels}${hidden}): ${facts}`
  })
}

function weekLines(plan: Plan, now: number): string[] {
  const hours = weeklyHours(plan)
  const first = mondayOf(now)
  return Array.from({ length: 8 }, (_, i) => ymd(first + i * 7 * DAY)).map(
    (week) => `- week of ${week}: ${hours[week] ?? 0} of ${plan.meta.weeklyBudgetHours} h`,
  )
}

/**
 * The instructions a chat or a tool needs to change this plan: how the plan is laid out, the rules it follows and
 * how to answer with an update. Written for a language model, in English; `now` is a Minsk wall-clock moment.
 */
export function planGuide(plan: Plan, now: number): string {
  const { meta } = plan
  const uid = plan.events.find((e) => isSession(e) && !e.done)?.uid ?? 'certs-001@learning-curve'
  const thursday = ymd(nextWeekday(now, 4))
  const wednesday = ymd(nextWeekday(now, 3))
  // A course that starts on the Monday four weeks from now and has its lab that Wednesday.
  const courseStart = mondayOf(now) + 28 * DAY
  const example = {
    format: UPDATE_FORMAT,
    summary: 'Moved one session to Thursday evening and marked it done with the 75 minutes it took.',
    changes: [
      { type: 'event.patch', uid, patch: { start: `${thursday}T19:00`, end: `${thursday}T20:00` } },
      { type: 'events.done', uids: [uid], done: true, actual: { [uid]: 75 } },
    ],
  }
  const course = {
    type: 'course.add',
    name: 'LangGraph Academy',
    color: '#0A7F5A',
    sessions: [
      {
        title: 'LangGraph — Введение: графы и состояние (1/2)',
        start: `${ymd(courseStart)}T12:00`,
        end: `${ymd(courseStart)}T13:00`,
        description:
          'Course: https://academy.langchain.com/courses/intro-to-langgraph\nModule: https://academy.langchain.com/courses/intro-to-langgraph\nГраф, узлы, рёбра, состояние.\nDone: первый граф из двух узлов запускается локально.',
      },
      {
        title: 'LangGraph — Лаба 1: агент с инструментами',
        start: `${ymd(courseStart + 2 * DAY)}T12:00`,
        end: `${ymd(courseStart + 2 * DAY)}T14:00`,
        kind: 'lab',
        description:
          'Course: https://academy.langchain.com/courses/intro-to-langgraph\nDone: агент вызывает два инструмента.',
      },
    ],
  }
  const habit = {
    type: 'events.add',
    events: [
      {
        calendar: 'personal',
        title: 'Бассейн',
        start: `${wednesday}T07:00`,
        end: `${wednesday}T08:00`,
        availability: 'free',
        rrule: 'FREQ=WEEKLY;BYDAY=WE,SA',
      },
    ],
  }

  return `# How to work with this study plan

You are helping a person keep a personal study plan called "${meta.title}". You get the plan as a JSON file and
you change it by answering with an **update**: a small JSON document that lists changes. You never return an
edited copy of the plan.

The contract, in short (each point is explained below):

${CONTRACT}

Now it is ${ymd(now)} (${WEEKDAYS[new Date(now).getUTCDay()]}) in the plan's time zone, ${meta.timezone}.

## The plan file

- \`meta\`: the name of the plan, its time zone, the weekly study budget (\`weeklyBudgetHours\`: ${meta.weeklyBudgetHours} h), days
  without study (\`holidays\`) and the last day (\`planEnd\`).
- \`calendars\`: one per course, plus personal ones. An event names its calendar by \`id\`.
- \`events\`: every event, sorted by start. Each has a \`uid\`: that is how you point at it.

Every time is a wall-clock string in ${meta.timezone}, written \`YYYY-MM-DDTHH:MM\`, with no seconds, no \`Z\` and no
offset. A day is \`YYYY-MM-DD\`. Do not convert times to another zone.

The plan's texts (titles, descriptions) are in the language the plan already uses. Write new ones in that
language. A short copy of the plan may come with empty \`description\` fields: that is the copy, not the plan, so
never "restore" or rewrite a description you were not asked to change.

Calendars now:

${calendarLines(plan).join('\n')}

Study hours already planned, by week (Monday to Sunday):

${weekLines(plan, now).join('\n')}

## Rules of the plan

1. **Budget.** A week holds at most ${meta.weeklyBudgetHours} h of study. Busy, timed events that do not repeat count; \`free\`
   events and repeats (the gym) do not. Do not fill a week past the budget unless the person asks for it, and say
   so in \`summary\` when you do.
2. **Days off.** No sessions on \`meta.holidays\`${meta.holidays.length ? ` (${meta.holidays.join(', ')})` : ''}. Weekends are free unless the person studies on them
   already or asks for it.
3. **Sessions.** A session is 1 hour, or 2 hours for a lab. It starts and ends on the same day, on the hour or the
   half hour. Do not put two busy events at the same time: read the events of that day first, repeats included.
4. **Where sessions go.** Follow the slots the course's sessions already use (look at their start times). For a
   new course, ask which days and hours suit when the person did not say.
5. **What is done stays.** Do not move, rename or remove a session with \`"done": true\`. Mark a session done only
   when the person says they finished it. A resized session keeps the length it was first planned with in
   \`estimate\`, and a part of a split session names the session it came from in \`from\`: the app keeps both, so
   read them and never send them.
6. **Deadlines.** A \`milestone\` event is a deadline: sessions of its course must end before it. A calendar has one:
   set it with \`event.add\` (\`"kind": "milestone"\`, \`start\` and \`end\` both \`<day>T00:00\`, titled
   \`Дедлайн: <calendar name>\`), move it by patching its \`start\` and \`end\`, clear it with \`event.remove\`.
7. **Lengths from logged time.** Before you resize sessions to a pace or choose the length of a new session, read
   how long sessions really take: the \`get_accuracy\` tool, \`GET /api/plan-accuracy\`, or the \`<accuracy>\` part of
   a brief. Judge a session by its kind in its course; while that has fewer than ${MIN_LOGGED} logged sessions, by its kind in
   every course; with fewer there too, keep the lengths of rule 3. Round a length to the half hour, quote the ratio
   with the number of logged sessions it rests on ("×1.3 over 12 logged sessions"), and say so in \`summary\`.

## How to name things

- A course session: \`<Course short name> — <Module or topic>\`, with an em dash (—) between spaces. When a topic
  takes several sessions, number them at the end: \`GE Agent Dev — ADK: tools (2/3)\`. Use the same short name for
  every session of a course; for a course that is in the plan, the one listed above.
- A lab: \`<Course short name> — Лаба N: <name>\`, with \`"kind": "lab"\`.
- Anything else has a plain name: \`Спортзал\`, \`Бассейн\`.
- A session's \`description\` has three parts on separate lines: \`Course: <URL>\`, \`Module: <URL>\`, then a goal of
  one to three lines ending with \`Done: <how to tell it is finished>\`. Use the real URLs the person gave or the
  ones already in the plan; leave a line out rather than invent a URL.
- A calendar is named after its course. Give a new one a color that differs from the colors above.
- Labels group calendars by provider or program (\`Google Skills for Partners\`, \`Certification\`); a name needs
  no prefix for that. Give a new course the labels of the courses it belongs with, spelled as listed above.

## How to answer: the update

Answer with one JSON code block that holds an update, and nothing the person has to edit:

${code(example)}

- \`summary\`: one or two sentences for the person, in their language: what changes and what to check.
- \`changes\`: applied in order. Each one is a step the person can undo.
- The update is all or nothing: if one change does not fit the plan, none is applied and you get the reason back.
- Its preview also lists **warnings**: a session on a holiday or a weekend, at the same time as another busy
  event, or after the deadline of its course, and a finished session changed or removed. Fix them, or keep one
  only when the person asked for it, and say so in \`summary\`.
- Point at events by the \`uid\` you read in the plan. Never make a uid up. A new event gets its uid when the
  update is applied, so one update cannot add an event and then change it.
- Send only what changes. An update that restates the whole plan is wrong.
- If the request is unclear or cannot be met inside the rules, ask before answering with an update.

The changes you can use:

| \`type\` | What it does |
| --- | --- |
| \`course.add\` | A new course: a calendar (\`name\`, \`color\`, optional \`labels\`) and all its \`sessions\`, as one step |
| \`events.add\` | Several \`events\` in calendars that exist, as one step |
| \`event.add\` | One \`event\` |
| \`event.patch\` | Changes fields of the event \`uid\`: \`title\`, \`description\`, \`start\`, \`end\`, \`calendar\`, \`done\`, \`actual\`, \`skipped\`, \`rrule\`, \`skip\` |
| \`event.detach\` | Moves one repeat (\`day\`) of a repeating event to \`start\`–\`end\`; the series stays |
| \`event.split\` | Splits the session \`uid\` into \`parts\` (\`start\`, \`end\`) that add up to its length; the first part keeps the uid |
| \`event.remove\` | Moves the event \`uid\` to the trash (restorable for 30 days) |
| \`events.move\` | New \`start\` and \`end\` for several sessions (\`moves\`), as one step |
| \`events.shift\` | Moves every not-done session from the day \`from\` on by \`days\`, \`hours\` or both, in the \`calendars\` named or in all |
| \`events.done\` | Marks the sessions \`uids\` done or not done |
| \`calendar.save\` | Renames or recolors the calendar \`id\` |
| \`calendar.labels\` | Gives the calendar \`id\` its \`labels\`, all of them; an empty list takes them off |
| \`plan.rename\` | Gives the plan another \`title\` |

The JSON Schema of the update describes every field; follow it when you have it.

## How to add a new course

1. Find out, from the person or a page they gave: the course's name and URL, its modules with their URLs, and how
   many hours each takes. Do not invent modules.
2. Choose a short name for the titles (two or three words) and a color.
3. Split each module into sessions of 1 hour; a lab or an exam is one block of 2 hours.
4. Put the sessions on free slots in order, inside the weekly budget, skipping holidays and days that are taken.
   Start after the sessions the plan already has for those hours, or on the date the person named.
5. Answer with **one** \`course.add\` change that carries every session:

${code({ format: UPDATE_FORMAT, summary: `Added the course LangGraph Academy: 2 sessions from ${ymd(courseStart)}.`, changes: [course] })}

For more sessions of a course that is already in the plan, use \`events.add\` with its calendar \`id\`.

## How to mark something as repeating

A repeat is for a habit or a standing appointment: the gym, a weekly call. Add it with \`rrule\`:

${code(habit)}

- The only form is \`FREQ=WEEKLY;BYDAY=\` and two-letter days (\`MO TU WE TH FR SA SU\`). It has no end: no \`UNTIL\`,
  \`COUNT\` or \`INTERVAL\`.
- \`start\` and \`end\` are the first repeat; it must fall on one of the named days.
- Use \`"availability": "free"\` when it should not block study time; leave it out when it does.
- **A course session is never a repeat.** A repeat cannot be marked done and does not count toward progress.
  "Every Tuesday for six weeks" is six events with their own dates and \`(1/6)\`…\`(6/6)\` in the titles.
- One repeat on another day or hour: \`event.detach\`. One repeat cancelled: \`event.patch\` with the full \`skip\`
  list. Other days for the whole series: \`event.patch\` with a new \`rrule\`. To stop a series: \`event.remove\`.
- An event that does not repeat cannot be turned into a repeat: remove it and add a repeating one.

## How to give other updates

- **Finished sessions**: \`events.done\` with their uids, and the minutes each took in \`actual\` (by uid) when the
  person says them. Time spent on one session: \`event.patch\` with \`actual\` in minutes. \`measured\`, \`began\` and \`paused\` are written by the stopwatch of the Focus page: read
  them, never send them. A time you send replaces them, as the person recalled it. When the person says a session
  ended before its goal was met, add \`unfinished: true\` to the same patch: the rest of the module goes on later.
- **A session the person will not do**: \`event.patch\` with \`done: true, skipped: true\`. It leaves the open work
  (no catch-up, no forecast) and counts as missed in every success figure. \`done: false\` brings it back.
- **Moving a few sessions**: one \`events.move\` with all of them, so it is one step to undo.
- **A session too long for one sitting**: \`event.split\` with the slots of its parts, on the same or other days.
  They must add up to its length. A lab stays one block.
- **Time off or a late start**: \`events.shift\` from the first affected day, then check that nothing landed on a
  holiday or a weekend and fix those with \`events.move\`.
- **Studying at another time of day**: \`events.shift\` with \`hours\` (whole or half, negative for earlier). A session
  that would cross midnight stops the change: shift fewer sessions or move that one with \`events.move\`.
- **More or fewer sessions a day, or finishing a course by a date**: re-balancing works out the days and times, in
  the planner's Reschedule dialog or with the \`rebalance_calendar\` tool. Its result is an \`events.move\` with
  \`reason: "rebalance"\`, previewed and applied like any update.
- **A course is dropped**: \`event.remove\` for each session that is not done. Removing a calendar is left to the
  person.
- **Renaming**: \`event.patch\` with \`title\`, keeping the naming pattern.

After the person applies an update the uids of new events exist. Ask for the plan again before you change them.
`
}

/** One text to paste into a chat: the guide, the plan and, when given, what the person wants. */
export function planBrief(
  plan: Plan,
  now: number,
  options: { request?: string | undefined; descriptions?: boolean } = {},
): string {
  const request = options.request?.trim()
  return [
    planGuide(plan, now),
    // The tags keep the data apart from the instructions; the request comes last, after the long plan.
    `## The plan\n\n<plan>\n${JSON.stringify(compactPlan(plan, options.descriptions))}\n</plan>`,
    `## How long sessions really take\n\n<accuracy>\n${JSON.stringify(accuracyReport(plan, now))}\n</accuracy>`,
    `## What I want\n\n<request>\n${request || 'Ask me what to change.'}\n</request>`,
    `## Before you answer\n\n${CONTRACT}`,
  ].join('\n\n')
}
