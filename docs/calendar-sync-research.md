# Calendar sync research: progress and updates in both directions

Fetched 2026-11-23, 09:40–10:15 UTC (12:40–13:15 Europe/Minsk). Only first-party pages were used: RFCs, provider API
references and guides, provider help centres, npm registry entries and official SDK repositories, and vendors' own
help pages for precedent products. Two public holiday feeds (Google, iCloud) were fetched with `curl` to observe
headers; no personal calendar, address or account was used. Every claim is followed by the page it was read from.

This document builds on [calendar-integration-research.md][prev] (2026-11-22). Facts established there are linked,
not repeated: no-login mechanisms, OAuth basics, scopes, verification, CalDAV providers, unified APIs, cal.com's
adapter pattern, the first one-way-versus-two-way table.

Legend: **(d)** = documented on the linked first-party page; **(f)** = de facto: it works in practice, was observed
here, or third parties rely on it, but no first-party page describing it was found; **(k)** = my general knowledge,
not re-verified here. Treat every (f) and (k) as a lead to test, not a fact. Section 13 lists them all.

## 1. Short answer

- **Keep the plan the source of truth and sync by state, not by replaying changes.** Every push compares "what the
  plan says now" with "what was last pushed" per uid, so `PlanChange`s, undo/redo, `pnpm run plan`, the MCP server
  and the AI chat all reach the calendar the same way. Nothing in the calendar changes the plan without a reviewed
  `PlanChange`.
- **App → calendar, no login: fix the feed first (S).** Add `SEQUENCE` and `LAST-MODIFIED` per event, make the
  bytes stable, and answer `If-None-Match` with `304`. The ✓ prefix and `TRANSP:TRANSPARENT` already carry "done";
  add the real time to the description. It costs a day and helps every subscriber, but Google and Outlook can only
  read it from a public URL ([prev §3.2][prev-3.2]); on `localhost` only Apple Calendar on the same Mac can.
- **App → calendar while the app stays on `localhost`: push into an app-owned Google calendar (M).** An API push
  needs only *outbound* HTTPS and a loopback OAuth redirect, so it works from the local server today, which the feed
  does not. Scope `calendar.app.created`; event `id` = base32hex of the app's uid, so every write is an idempotent
  upsert with no id lookup.
- **Calendar → app: read edits back as a *proposed update*, never as an automatic merge.** Poll the app's calendars
  with a sync token, drop the app's own writes by etag, and turn what the person did on their phone (a ✓ in the
  title, a moved session, a deleted repeat) into `PlanChange`s shown in the same preview the AI chat uses. Accepted,
  they become history steps that Undo takes back; rejected, the next push puts the plan's version back.
- **Precedent agrees on the small gestures, not on two-way sync.** Todoist marks a finished task's event with a
  checkmark in its name and reads name and time edits back; deleting an event does not delete the task. Reclaim
  treats a deleted event as "reschedule". Sunsama shrinks a session finished early; Toggl Track writes real time as
  a separate read-only feed and never updates entries from calendar edits (section 4.2).
- **Do not reshape a done session to its real length.** The planner keeps the planned slot on purpose (the pace is
  the difference); show "took 1 h 15 min" beside it instead (section 3.2).
- **Two-way sync stays rejected** until the conditions in section 12 hold. Microsoft Graph and iCloud CalDAV are the
  same design with different adapters; build them only on demand.

## 2. What the app has today, re-checked in the code

| Piece                                   | State, read from the code                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/plan-domain/src/ics.ts`       | `METHOD:PUBLISH`; `DTSTAMP` = time of the request; no `SEQUENCE`, no `LAST-MODIFIED`; `STATUS:CONFIRMED` always; `EXDATE` per skipped day; `NAME`, `X-WR-CALNAME`, `REFRESH-INTERVAL`, `X-PUBLISHED-TTL`, `X-APPLE-CALENDAR-COLOR`, `SOURCE`; `markDone` → `✓ ` title prefix and `TRANSP:TRANSPARENT`; `VALARM` only on sessions not done |
| `GET /api/ics/:calendarId`              | `Cache-Control: no-store`, no `ETag`, no token; `SOURCE` is the request URL                                                    |
| uids (`schedule.ts`)                    | `${calendar}-${NNN}@learning-curve`, a counter per calendar in generation order. Stable across `pnpm run plan` only while nothing is inserted *before* that position in `content.ts`; an insertion renumbers the rest of that calendar. Viewer-made uids are `custom-<time><random>@learning-curve` |
| `event.split` / `event.detach`          | Split: the first part keeps the uid, the others get new uids. Detach: the series gets a `skip` day and a new single event with a new uid; no `RECURRENCE-ID` override is ever produced |
| Progress model                          | `done`, `actual` (5–1440 min) on single events. `isSession` excludes repeats, and the guide says "A repeat cannot be marked done". `actual` is logged in the event card and by the focus page (`done` + `actual` in one patch) |
| Plan size                               | 148 events, 6 calendars, 1 repeating event (the gym) in `plan.json` today                                                    |
| Update preview (`update.ts`, `diff.ts`) | `diffPlans` compares only `title`, `start`, `end`, `calendar`: a proposal that only marks something done, logs time or skips a day shows no "changed" row today |
| `packages/plan-data/src/busy.ts`        | Fetches the person's secret iCal address with ical.js, reuses it for 10 minutes, no conditional GET                            |
| "Add to Google Calendar" link           | Uses `calendar/render?action=TEMPLATE&ctz=…`, the de facto form; [prev §3.1][prev-3.1] recommended the documented `r/eventedit` with `stz`/`etz` |
| Secrets                                 | `data/local.json` (untracked) holds `busyFeed`; `writeBusyFeed` overwrites the whole file. `.env` is git-ignored               |

Findings that matter for sync:

1. **The feed bytes change on every request** (`DTSTAMP` = now), so a validator over the body is useless as it
   stands. RFC 5545 allows two readings: with `METHOD`, `DTSTAMP` is "the date and time that the instance of the
   iCalendar object was created"; without it, it is "the date and time that the information associated with the
   calendar component was last revised" and "is equivalent to the "LAST-MODIFIED" property" ([RFC 5545
   §3.8.7.2][rfc5545-dtstamp]). Google's own public feed takes the first reading: two fetches 3 s apart were
   byte-identical except `DTSTAMP`, which was the fetch time (f, observed; section 5.1).
2. **Nothing tells a subscriber which version is newer.** No `SEQUENCE`, no `LAST-MODIFIED` ([prev §2][prev-2]
   finding 2 still open). Google's own feed emits both per event (f, observed).
3. **Positional uids are an identity risk for any stored mapping**, not only for `edits.json`. A push keyed by uid
   still mirrors the plan correctly after a renumbering (it updates the provider event in place), but a pending
   calendar-side proposal keyed by uid could land on a different session. Section 7.1 guards against it.
4. **Per-occurrence progress is not in the model**, so the only per-occurrence updates to sync are skips and
   detaches of the one repeat.

## 3. Progress, app → calendar

### 3.1 What each target can carry

| Progress                | iCalendar feed / file                                                                                                                                                                       | Google Calendar API                                                                                                                                                              | Microsoft Graph                                                                                                                                                                        | CalDAV (iCloud, Google)                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Done                    | No done state on `VEVENT`: `STATUS` is `TENTATIVE`, `CONFIRMED`, `CANCELLED` (d). Carry it as the `✓ ` title prefix (exists) and `TRANSP:TRANSPARENT`, which decides "whether it appears to consume time" (d) | `status` is `confirmed`, `tentative`, `cancelled` ("cancelled (deleted)") (d). Use `summary` prefix, `transparency: "transparent"` (d), a `colorId` from the event palette (d), and `extendedProperties.private` for the machine-readable flag (d) | `categories` (strings matching the user's `outlookCategory` master list, up to 25 colours, `Preset4` is green) (d), `showAs: "free"` (d), `subject` prefix; app data in an open extension or a single-value extended property (d) | Same bytes as the feed, written per event; `X-` properties survive on the server (f)                          |
| Real time (`actual`)    | `DESCRIPTION` line; an `X-` property is allowed, but receivers "can ignore them" (d)                                                                                                         | `description` line + private extended property (key ≤ 44, value ≤ 1024 chars, [prev §4.1][prev-4.1])                                                                           | `body` line + open extension                                                                                                                                                           | `DESCRIPTION` + `X-LC-ACTUAL`                                                                                 |
| Skipped occurrence      | `EXDATE` (exists)                                                                                                                                                                           | `recurrence` accepts "RRULE, EXRULE, RDATE and EXDATE lines" (d), or cancel the instance by `status: "cancelled"` (d)                                                           | Delete the occurrence; the master then lists it in `cancelledOccurrences` (d). `patternedRecurrence` has no excluded-dates property (d, by its property list)                         | `EXDATE` in the same resource                                                                                 |
| Partly done             | Nothing standard: `PERCENT-COMPLETE` and `COMPLETED` exist only on `VTODO` (d)                                                                                                              | Nothing                                                                                                                                                                          | Nothing on events; `todoTask.status` has `inProgress` (d)                                                                                                                             | `VTODO` is not portable: Google's CalDAV "Doesn't support `VTODO`" (d); upgraded iCloud reminders "won't be compatible with earlier versions" (d) |

Sources: [RFC 5545 §3.8.1.11, §3.8.2.7, §3.8.1.8, §3.8.2.1, §3.8.8.2][rfc5545], [Google event resource][g-events],
[Graph event][ms-event], [outlookCategory][ms-category], [Graph extensions][ms-ext],
[patternedRecurrence][ms-recurrence], [Google CalDAV guide][g-caldav], [Apple, Reminders upgrade][a-reminders].

- **`CATEGORIES` and per-event `COLOR` in a feed** cost nothing, but no provider documents reading them from a
  subscription ([prev §3.4][prev-3.4]). Do not rely on them.
- **Open extensions** on Graph "aren't strongly typed, discoverable, or filterable" (d, [Graph
  extensions][ms-ext]): fine for a payload read back with the event, useless for finding events. The mapping lives
  in the app (section 7.1), so that is enough.
- **Verdict:** the title prefix plus "free" time is the only done marker that every target shows. Use it
  everywhere; add the provider-specific colour or category where an API is in play, because those are also what a
  person can set on a phone (section 4.1).

### 3.2 Reshape the event to the real time, or log it beside?

| Precedent                       | What it does                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sunsama (timeboxing)            | Reshapes: with auto-reschedule on, a session scheduled 1–2 PM and completed at 1:30 becomes 1–1:30; completed before its start, it is removed (d, [FAQ][sunsama-faq]) |
| Toggl Track                     | Logs beside: time entries go out as a separate subscribable feed, "a read-only view of your time entries in the calendar", paid plans, past two weeks (d, [Toggl iCal][toggl-ical]) |
| Toggl Track, other direction    | Creates entries from calendar events, and "Once created, we don't update or delete time entries based on calendar event changes" (d, [Toggl calendar view][toggl-calview]) |
| Clockify                        | Reads only: "Copy as time entry" turns an event into an entry; nothing is written to the calendar (d, [Clockify][clockify-cal])                                   |
| This planner                    | Keeps the planned slot and draws the real length inside it: "The slot is not shortened, because the pace is the difference between the two" (`README.md`)        |

**Recommendation: log beside, in the same event.** Keep start and end; title `✓ <title>`; first description line
`✓ Done · took 1 h 15 min of 2 h`; machine-readable `actual` in the private property. Reasons: the calendar then
matches the planner's week grid; a resize made in the calendar keeps one meaning (a move, section 4.1) instead of
"maybe a time log"; and `feature-research.md` §1.1 reads the incumbents' boards the same way: "two-way sync with
Google/Outlook makes silently rewriting event times risky" ([feature research §1.1][feature-1.1]). If real time
must be *seen as blocks*, the Toggl pattern (a second, read-only "Done — real time" calendar) is the clean
extension; do not mix the two.

### 3.3 Per-occurrence progress of a repeating event

The app forbids it (section 2), and that is the right call for sync too. What each provider would need:

- **iCalendar:** an override is a component with the same `UID` and a `RECURRENCE-ID`; "To reference an instance
  of a recurring component, the primary key is composed of the "UID" and" the `RECURRENCE-ID`; cancelling one
  instance also names its `RECURRENCE-ID` ([RFC 5546 §2.1.5, §3.2.5][rfc5546]).
- **Google:** instances have their own `id`, `recurringEventId` and `originalStartTime`, which "uniquely identifies
  the instance within the recurring event series even if the instance was moved" (d, [event resource][g-events]). To
  change one, "client applications must first retrieve the instance", then `PUT` it; the guide warns that modifying
  instances one by one "creates lots of exceptions that clutter the calendar" (d, [recurring events][g-recurring]).
- **Graph:** `type` is `singleInstance`, `occurrence`, `exception` or `seriesMaster`; occurrences carry
  `seriesMasterId` and `originalStart`; `instances` "doesn't include occurrences canceled from the series" (d,
  [event][ms-event]). Moving an
  occurrence past its neighbour's day fails with `ErrorOccurrenceCrossingBoundary` (d, [update event][ms-update]).

**Verdict:** if a repeat ever needs progress, detach the occurrence first (`event.detach` exists), so every
progress-bearing item is a single event with its own uid on every provider. No instance bookkeeping is needed.

## 4. Progress, calendar → app

### 4.1 What a person can do in the calendar app, and what comes back

| Gesture in the calendar app                    | Feed (subscription)  | Google API                                                     | Graph                                                     | CalDAV                          | Proposed `PlanChange`                                                       |
| ---------------------------------------------- | -------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Types `✓ ` before the title                    | Read-only: cannot    | `summary` changes, new `etag` (d)                              | `subject` changes, new `changeKey` (d)                    | `SUMMARY` changes, new `getetag` | `events.done` `done: true` (removing it: `false`)                           |
| Sets an event colour / category                | Cannot               | `colorId` (d); the app-owned calendar's events are editable    | `categories` (d)                                          | No per-event colour (k)         | Same, if the colour or category is the agreed "done" one                    |
| Moves or resizes a single session              | Cannot               | `start`/`end` (d)                                              | `start`/`end` (d)                                         | `DTSTART`/`DTEND`               | `event.patch` `{start, end}` (what `moveOccurrence` builds today)           |
| Moves one repeat                               | Cannot               | an instance with `recurringEventId`, `originalStartTime` (d)   | an `exception` with `seriesMasterId`, `originalStart` (d) | override with `RECURRENCE-ID` (d) | `event.detach` (`moveOccurrence`)                                          |
| Deletes one repeat                             | Cannot               | cancelled exception: only `id`, `recurringEventId`, `originalStartTime` guaranteed (d) | `cancelledOccurrences` on the master (d)    | `EXDATE` appears (k)            | `event.patch` `{skip}` (`removeOccurrence`)                                 |
| Deletes a single session                       | Cannot               | `status: "cancelled"`, only `id` guaranteed (d)                | `@removed: {reason: "deleted"}` in delta (d)              | `404` member in sync report (d) | No automatic change: see section 7.5                                        |
| Ticks a Google task / To Do item               | n/a                  | Tasks `status` `completed` (d)                                 | `todoTask.status` `completed` (d)                         | n/a                             | `events.done`                                                               |

Sources: [event resource][g-events], [Graph event][ms-event], [Graph delta][ms-delta-ref], [RFC 6578 §3.2][rfc6578],
[Google Tasks][g-tasks], [todoTask][ms-todo], and `packages/plan-domain/src/occurrence-changes.ts`.

- **Tasks are a poor carrier of a time slot.** Google: "It isn't possible to read or write the time that a task is
  scheduled for using the API", and `due` records only the date (d, [tasks][g-tasks]); `tasks.list` offers
  `updatedMin` and `completedMin`, but no sync token or push is mentioned (d, [tasks.list][g-tasks-list]). Microsoft
  To Do has `status` and `completedDateTime`, and `delta` works with personal accounts (`Tasks.ReadWrite`) (d,
  [todoTask][ms-todo], [delta][ms-todo-delta]), but a task is a second item beside the event. Keep tasks out unless
  the person already lives in Google Tasks.
- **A feed carries nothing back.** One loophole exists without OAuth: import the plan once into a Google calendar,
  then read that calendar's *secret iCal address* with the existing `busy.ts` code and match events by `UID`. Title
  edits and moves would come back; colour would not, and every app-side change still needs a re-import, which may
  duplicate ([prev §3.3][prev-3.3]). Whether Google keeps the imported `UID` in its export was not tested (f).
- **A calendar add-on button** ("Mark done" inside Google Calendar's side panel) is how Reclaim does it (section
  4.2). It needs a published Workspace add-on and a public endpoint (k): out of reach for a local app.

### 4.2 Precedent products: what happens when a session is completed or moved in the calendar

| Product                  | What it writes to the calendar                                       | Completed in the product                                                                                  | Changed in the calendar app                                                                                                                                       | Source |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Todoist (Calendar integration) | A calendar named "Todoist" that the integration creates; tasks with date, time and duration | "the event's name is updated with a checkmark ✔️"; one occurrence of a recurring task leaves the name unchanged | Name, start date and times sync back to the task; cancelling the event removes the task; deleting the event leaves the task; "This event only" edits do not change the recurrence | (d) [Todoist][todoist-cal], [troubleshooting][todoist-trouble] |
| Sunsama                  | Working sessions as events                                           | Session ends at completion (shrinks; removed if completed before it starts)                               | Not covered by the FAQ read                                                                                                                                         | (d) [FAQ][sunsama-faq] |
| Reclaim.ai               | Task events                                                          | "Mark Done" in its planner, or in the Reclaim add-on inside Google Calendar                              | Dragging an event locks it at the new time; deleting it makes Reclaim "find the next open slot"                                                                     | (d) [Reclaim tasks][reclaim-tasks] |
| Morgen                   | Task sessions; a user on its feedback board mentions the `⏹️` mark on them | Not read on a first-party help page                                                                       | A request to tell sessions apart on the source calendar is "In Review"                                                                                              | (f) [feedback][morgen-fb] |
| Akiflow                  | A locked time slot is "one event" on Google, Outlook or iCloud      | The help page read does not say                                                                           | Not stated                                                                                                                                                          | (d) [time slots][akiflow-slots] |
| Toggl Track              | Read-only iCal feed of time entries                                  | n/a                                                                                                       | Entries made from events are never updated or deleted afterwards                                                                                                    | (d) [iCal][toggl-ical], [calendar view][toggl-calview] |
| Clockify                 | Nothing                                                              | n/a                                                                                                       | Calendar edits show up in Clockify's view; entries are copied by hand                                                                                               | (d) [Clockify][clockify-cal] |
| Motion, TickTick         | Not established: Motion's help URL redirected to its index; TickTick's own help page was not found | —                                                                                    | —                                                                                                                                                                   | not read |

What the precedent says for this app:

1. **A checkmark in the title is the recognised done marker** (Todoist, d). The app's `✓ ` prefix already matches;
   reading the same marker back is symmetric and works on every provider and on CalDAV.
2. **Nobody completes from the native calendar UI** except through a title edit (Todoist reads names back) or a
   vendor add-on (Reclaim). So "type ✓ in the title" and "pick the green colour/category" are the realistic phone
   gestures; document them in the UI.
3. **Deletion in the calendar is not "done" and not "remove"**: Todoist keeps the task, Reclaim reschedules
   (section 7.5).
4. **Moves made in the calendar are honoured** by both Todoist and Reclaim. Here they become a proposal, because a
   move in this plan has rules (budget, holidays, deadlines) that the preview already checks.

## 5. Updates, app → calendar

### 5.1 A polled feed: how a subscriber reconciles a refresh

- **Identity and ordering** come from iTIP: "The primary key for referencing a particular iCalendar component is the
  "UID" property value"; among revisions with the same `UID` and `RECURRENCE-ID`, "the component with the highest
  numeric value for the "SEQUENCE" property obsoletes all other revisions"; when those match, "The component with the
  latest "DTSTAMP" overrides all others" ([RFC 5546 §2.1.5][rfc5546]).
- **When `SEQUENCE` must grow:** for changes to `DTSTART`, `DTEND`, `DURATION`, `DUE`, `RRULE`, `RDATE`, `EXDATE`
  and `STATUS` "the sequence number MUST be incremented"; other changes "MAY also require" it ([RFC 5546
  §2.1.4][rfc5546]). It starts at 0 and is "monotonically incremented" ([RFC 5545 §3.8.7.4][rfc5545]).
  `LAST-MODIFIED` "MUST be specified in the UTC time format" ([RFC 5545 §3.8.7.3][rfc5545]).
- **Removal is absence.** RFC 5546 only describes `CANCEL` sent by an organizer to attendees, and a published
  component has no attendees (§3.2.1, §3.2.5). No RFC read here defines "an event missing from the next refresh is
  deleted"; it is what subscribers do (f) and what the README already promises.
- **Conditional GET.** `If-None-Match` on a `GET` gets "the 304 (Not Modified) status code" when it matches;
  `If-Modified-Since` avoids transfer "if that data has not changed" ([RFC 9110 §13.1.2, §13.1.3][rfc9110-cond]).
  Whether Google's, Outlook's or Apple's *fetchers* send these headers to a subscribed feed is not documented (f).

Observed on two public holiday feeds, 2026-11-23 (f):

| Feed                         | Validators sent                                                   | Conditional GET                       | Per-event properties                                                    |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| [Google public calendar][obs-google] | None; `cache-control: no-cache, no-store, max-age=0, must-revalidate` | Nothing to send                       | `METHOD:PUBLISH`, `DTSTAMP` = fetch time, `LAST-MODIFIED`, `SEQUENCE:0`; no `ORGANIZER` |
| [iCloud public calendar][obs-icloud] | Stable `ETag`                                                     | `If-None-Match` with it → `200`, not `304` | No `METHOD`; a fixed `DTSTAMP;VALUE=DATE:19760401` on every event       |

Two consequences: the busy overlay gains nothing from conditional GET against these hosts (keep the 10-minute
reuse), and Google itself publishes `METHOD:PUBLISH` without `ORGANIZER`, which softens [prev §2][prev-2] finding 1
(how importers treat that shape is still untested).

### 5.2 An API: idempotent upsert keyed by the app's uid

| Provider | Identity                                                                                                                                                                                                                                       | Create twice safely                                                                                                                         | Concurrency                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Google   | Client-chosen `id`: "lowercase letters a-v and digits 0-9", "between 5 and 1024 characters", "unique per calendar"; collisions not guaranteed to be detected; `id` and `iCalUID` "are not identical and only one of them should be supplied" (d, [event][g-events], [insert][g-insert]) | Insert of an existing id: `409` "The requested identifier already exists" → "use the update method for the existing one" (d, [errors][g-errors]) | `If-Match` with the etag → `412` "Precondition failed"; inserts are not conditional (d, [ETags][g-versions], [errors][g-errors]) |
| Graph    | `iCalUId` is read-only; `id` "changes when the item is moved" unless `Prefer: IdType="ImmutableId"`, which holds "so long as the item stays in the same mailbox" (d, [event][ms-event], [immutable ids][ms-immutable]) | `transactionId` lets the server "avoid redundant POST operations in case of client retries"; it cannot be changed later (d, [event][ms-event]) | `changeKey` "changes as well" on every change (d); `If-Match` is not mentioned on the update page (unverified) |
| CalDAV   | Resource name chosen by the client; one `UID` per resource with its overrides in the same resource; `CALDAV:no-uid-conflict` refuses a second resource with the same `UID` (d, [RFC 4791 §4.1, §5.3.2][rfc4791]) | `PUT` with `If-None-Match: *` so the client "will not inadvertently overwrite an existing resource" (d, [RFC 4791 §5.3.2][rfc4791]; [RFC 9110 §13.1.2][rfc9110-cond]) | `If-Match` with `getetag`. A server returns a strong `ETag` on `PUT` only if it stored the bytes unchanged; otherwise re-fetch before the next change (d, [RFC 4791 §5.3.4][rfc4791]) |

**Google id from the uid.** Base32hex-encode the UTF-8 bytes of the uid, lowercase, without padding:
`certs-001@learning-curve` → `cdin4t3j5ko30ca0dhim2sjed5n6ebb3elp7cp8` (39 characters, computed here). It is
reversible, inside the allowed alphabet, and the same uid always gives the same id, so an upsert needs no lookup and a
lost mapping can be rebuilt from the calendar. A SHA-256 in base32hex (52 characters) is the fixed-length
alternative, but is not reversible. Prefer this over `events.import` with `iCalUID`, whose behaviour on an existing
`iCalUID` is still undocumented ([prev §10][prev-10]).

**Graph needs a stored id map.** Create with `transactionId` (derived from the uid) so a retried `POST` does not
duplicate, store the returned immutable `id` against the uid, and send `Prefer: IdType="ImmutableId"` on every call.

### 5.3 How each structural edit maps per provider

| Plan edit                                  | Feed                                              | Google                                                                                                          | Graph                                                                                                      | CalDAV                                    |
| ------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `event.split` (first part keeps the uid)   | First `VEVENT` changes, `SEQUENCE`+1; new `VEVENT`s | `patch` the existing id; `insert` the new parts                                                                 | `PATCH` the mapped id; `POST` the new parts                                                                | `PUT` with `If-Match`; `PUT` new resources |
| `event.detach` (skip + new single uid)     | Series gains `EXDATE`, `SEQUENCE`+1; new `VEVENT`  | `patch` the series' `recurrence` with the `EXDATE` line (d); `insert` the single                                | Delete the occurrence (found through `instances`); `POST` the single                                       | `PUT` series with `EXDATE`; `PUT` single  |
| `skip` added                               | `EXDATE`, `SEQUENCE`+1                            | `patch` `recurrence` (one idempotent call), or cancel the instance (d)                                          | Delete the occurrence                                                                                      | `PUT` with `EXDATE`                       |
| `skip` removed (un-skip)                   | `EXDATE` gone, `SEQUENCE`+1                       | `patch` `recurrence`                                                                                             | No documented way to restore a cancelled occurrence (k): delete and recreate the series (one series here) | `PUT`                                     |
| `event.remove`, `calendar.clear`           | Absent next time                                  | `delete`; keep the mapping row marked deleted                                                                   | `DELETE`                                                                                                   | `DELETE` with `If-Match`                  |
| `trash.restore`                            | Present again, higher `SEQUENCE` (row kept)       | `insert` → `409` → `update` the same id (d for the 409 advice; un-deleting by update is (f))                     | `POST` again, new id                                                                                       | `PUT` with `If-None-Match: *`             |

Doing a detach as `EXDATE` + a new event (rather than a `RECURRENCE-ID` override) is valid iCalendar and keeps one
code path for all providers; there is no reason to change the model for sync.

### 5.4 Batching, quotas and backoff

| Provider | Batch                                                                                                                                                                        | Limits                                                                                                                                                         | Backoff                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google   | "limited to 1000 calls in a single batch request"; n calls count "as n requests"; "The server might perform your calls in any order" (d, [batch][g-batch])                   | 10,000 requests/min per project, 600/min per user, 1,000,000/day before charges, planned for "later in 2026" (d, [quota][g-quota]); creating "more than 100,000 events during a short period" reduces creation (d, [use limits][g-limits]) | "truncated exponential backoff"; "vary the interval +/- 25%" (d, [quota][g-quota]); `403 rateLimitExceeded` and `429` mean back off (d, [errors][g-errors]) |
| Graph    | "limited to 20 individual requests"; `dependsOn` orders them; each is throttled on its own with `429` (d, [JSON batching][ms-batch])                                          | Per app and mailbox: "10,000 API requests in a 10-minute period", "Four concurrent requests"; unordered batches run four at a time (d, [Outlook limits][ms-throttle-limits]) | Wait the `Retry-After` seconds, then retry (d, [throttling][ms-throttle])                                                                               |
| CalDAV   | None in the protocol; `calendar-multiget` reads many by href (k)                                                                                                             | Google's CalDAV "has the same quota limits as the Calendar API" (d, [CalDAV guide][g-caldav]); iCloud publishes none (f)                                        | Exponential (k)                                                                                                                                          |

At 148 events a full first push is two Google batches of up to 100 (section 11.4; 148 requests against a 600/min
user quota) or eight Graph batches. Neither quota is a design constraint for this plan; ordering inside a Google batch is.

## 6. Updates, calendar → app: change detection

| Provider            | Incremental read                                                                                                                                                                                                                       | Deletions                                                                                                  | Token loss                                                                                         | Push                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google              | `events.list` with `syncToken`; not combinable with `timeMin`, `timeMax`, `updatedMin`, `q`, `privateExtendedProperty` and others; `nextSyncToken` "is present only on the very last page" (d, [list][g-list], [sync][g-sync]); `calendar.app.created` is an accepted scope (d) | "All events deleted since the previous list request will always be in the result set" (d)                 | `410` `fullSyncRequired`, "a full sync is required": wipe the local copy and list again (d, [errors][g-errors]) | Needs a public HTTPS endpoint and renewal ([prev §4.1][prev-4.1]); Google itself calls repeated polling of every calendar "An anti-pattern" (d, [quota][g-quota])                                                                |
| Graph               | `calendarView/delta` with a fixed range encoded in the token; no `$select`, `$filter`, `$expand` (d, [delta][ms-delta-ref]). The v1.0 reference lists only `/me/calendarView/delta` "of the user's primary calendar"; `/me/calendars/{id}/calendarView/delta` appears in the beta reference (d, [beta][ms-delta-beta]); the guide says a calendar view can be "some other specified calendar" (d, [guide][ms-delta-guide]) | `@removed: {reason: "deleted"}`, also for events *outside* the range that changed: "Filter the events under `@removed`" (d) | Not stated on the pages read                                                                       | Subscriptions ≤ 10,080 minutes for events; lifecycle `reauthorizationRequired`, `subscriptionRemoved`, `missed` go to a second public URL, and `missed` means "Perform a full data resync" (d, [lifecycle][ms-lifecycle]); event notification latency is listed as "Unknown" (d, [overview][ms-notify]) |
| CalDAV (RFC 6578)   | `sync-collection` with the last `sync-token`; changed members have `propstat`, removed ones "MUST contain one DAV:status with a value set to '404 Not Found'"; a server "MAY limit the number" with `507` and continue (d, [RFC 6578][rfc6578]) | `404` members                                                                                              | Invalid token: the client must "fall back to synchronizing the entire collection" (d)               | None                                                                                                                                                                                                                          |
| CalDAV `getctag`    | Apple's private extension, now "deprecated in favor of support for the WebDAV Sync REPORT" (d, [ctag][ctag]); Google's CalDAV still documents a `ctag` and requires sync-collection "after the initial sync" (d, [CalDAV guide][g-caldav]); iCloud: both work (f) | —                                                                                                          | —                                                                                                  | —                                                                                                                                                                                                                             |
| ICS feed            | Full refetch; validators not honoured by the two hosts tested (section 5.1)                                                                                                                                                            | Absence                                                                                                    | n/a                                                                                                | n/a                                                                                                                                                                                                                           |

**Graph and an app-owned calendar.** Because v1.0 documents delta only for the primary calendar, either push into the
primary calendar with a category, use the beta endpoint, or simply read the app calendar's `calendarView` in full on
each poll and compare `changeKey`s. At about 150 events the full read is one or two requests; it is the robust
choice and avoids beta.

**Polling from `localhost`.** Pull on server start, when the planner tab gets focus, after every push, on "Sync now",
and every 10 minutes ± 25 % while the server runs. With six calendars that is at most ~900 cheap requests a day
against 600 per *minute* per user (Google) or 10,000 per 10 minutes (Graph).

**A tunnel for webhooks is not worth it.** It would expose a server that has no login (the issue [prev §1][prev-1]
raises) to receive notifications that Google calls "not 100% reliable" ([prev §4.1][prev-4.1]) and Microsoft rates at
"Unknown" latency, so polling must stay anyway; the gain is minutes → seconds for edits that a person reviews before
they apply.

## 7. Identity, echo suppression and conflicts

### 7.1 The mapping row

One row per `(provider, uid)`, in an untracked file (section 11):

| Field          | Why                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`           | Provider event id (Google: derivable from the uid, stored anyway; Graph: immutable id; CalDAV: resource href)             |
| `calendar`     | Provider calendar id, so a calendar change becomes a move or delete + insert                                              |
| `etag`         | Last etag / `changeKey` / `getetag` the app *wrote or accepted*                                                           |
| `pushed`       | The fields the app owns as last pushed: title, description hash, start, end, recurrence lines, done marker, actual, colour |
| `planHash`     | Hash of the plan event when it was pushed: detects that a uid now means another session (positional uids, section 2)      |
| `deleted`      | Set when the app deleted it, so a restore updates instead of inserting (Google `409`, section 5.3)                        |
| `unlinked`     | The person chose "stop syncing this event"                                                                                |

### 7.2 Echo suppression

- **Google, Graph:** keep the etag / `changeKey` returned by each write. An incoming item whose etag equals the
  stored one is the app's own write coming back: skip it. Any other etag is a change made elsewhere.
- **CalDAV:** the `PUT` response may carry no `ETag` when the server rewrote the data (RFC 4791 §5.3.4), so compare
  the incoming *owned fields* with `pushed` instead. Use that comparison as the second check on all providers: a new
  etag with identical owned fields (a reminder or colour the app ignores) needs no proposal, only a new stored etag.
- **Pull before push.** Each round reads first, so a person's edit is seen before the app could overwrite it, and a
  uid with an open proposal is left alone by the push until the person decides.

### 7.3 Conflict strategies

| Strategy                              | How it works                                                                                           | Fits this app?                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App wins (overwrite)                  | Every push writes the plan's fields                                                                    | Yes for text and for everything after a rejection. Alone, it silently undoes what was done on a phone                                                     |
| Field ownership                       | The app owns title, description, calendar; the calendar may propose time and progress                 | **Yes**: it decides which calendar edits are worth proposing                                                                                               |
| Last writer wins (`updated`, `lastModifiedDateTime`) | Newer timestamp wins per event                                                           | No: Google's `updated` does not move for reminder changes (d, [event][g-events]); clocks and `pnpm run plan` regenerations make "newer" meaningless          |
| Three-way merge against `pushed`      | Compare calendar vs `pushed` (what the person changed) and plan vs `pushed` (what the app changed)    | **Yes, as the detector**: it tells "changed in the calendar" from "changed in the app" and finds true conflicts (both changed the same field)               |
| Calendar edits become a proposed update | The three-way result is turned into `PlanChange`s, previewed, accepted or rejected, then undoable     | **Yes, as the resolver**: it reuses `parseChange`, `previewUpdate` and its rule warnings, `saveChanges` and the history; nothing bypasses `applyChange`     |

Optimistic concurrency closes the remaining race: Google `If-Match` → `412` when "The etag supplied in the If-match
header no longer corresponds to the current etag"; the advice is to fetch again and reapply (d,
[errors][g-errors]); CalDAV `If-Match` → `412` (d, [RFC 9110 §13.1.1][rfc9110-cond]); Graph: compare `changeKey`
before writing, since `If-Match` support is not documented on the update page.

### 7.4 What a deletion made in the calendar should mean

| Deleted in the calendar     | Precedent                                                       | Proposed handling                                                                                                                          |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| One repeat of a series      | Todoist ignores single-instance edits (d)                        | Propose `skip` for that day (`removeOccurrence` builds it): the meaning is unambiguous                                                     |
| A single session            | Todoist keeps the task; Reclaim reschedules it (d)               | No default change. Review item with three choices: move to trash (`event.remove`, undoable), put it back in the calendar, stop syncing it |
| A whole app-owned calendar  | —                                                               | Pause that calendar, offer "recreate and push again" or "stop syncing this calendar"                                                       |

"Stop syncing" is local sync state, not a plan edit, so it is not a `PlanChange` and does not enter the history.

## 8. Libraries for Node / TypeScript

Versions and dates are from the npm registry on 2026-11-23 (d, [npm][npm]).

| Package                              | Latest, published                    | Module, types, Node                       | Status and notes                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `googleapis`                         | 190.0.0, 2026-11-12                  | CommonJS with `.d.ts`; Node ≥ 22          | "considered complete and are in maintenance mode … will not add any new features" (d, [README][gh-googleapis]). Its README lists the 7-day "Testing" token expiry among refresh-token failures (d). No batch helper is described (unverified) |
| `@googleapis/calendar`               | 20.2.0, 2026-11-12                   | CommonJS with `.d.ts`; Node ≥ 22          | The same generator as a single API: "install a submodule as its own dependency" to cut startup time (d, [README][gh-googleapis])                                                                                |
| `google-auth-library`                | 11.3.4, 2026-11-09                   | CommonJS with `.d.ts`; Node ≥ 22          | OAuth client used by both; usable alone with plain `fetch` for the ~6 Calendar calls needed                                                                                                                      |
| `@microsoft/microsoft-graph-client`  | 3.1.0, 2026-11-14                    | CommonJS with `.d.ts`; Node ≥ 22          | The established fluent client                                                                                                                                                                                    |
| `@microsoft/msgraph-sdk`             | 1.0.0-preview.95, 2026-11-20         | ESM; Node 22, 24, 26                      | "currently in Pre-Release" (d, [README][gh-msgraph-ts]); avoid for now                                                                                                                                           |
| `@azure/msal-node`                   | 7.2.3, 2026-11-18                    | ESM with types; Node ≥ 20                 | "MSAL does not expose refresh tokens for security reasons"; persist its serialized token cache instead (d, [caching doc][gh-msal-cache])                                                                         |
| `tsdav`                              | 2.5.1, 2026-11-17                    | CommonJS and ESM, types; Node ≥ 18        | "Works in … Node.js (>= 18)" and browsers; README shows Google CalDAV with OAuth and iCloud examples (d, [README][gh-tsdav])                                                                                       |
| `ical.js`                            | 2.2.1, 2025-08-08                    | ESM with types                            | Already in the catalog and used by `busy.ts`; parses incoming CalDAV bodies and recurrence exceptions                                                                                                            |

All run server-side in a Nitro app (Node). For this small surface the lighter path is `google-auth-library` + `fetch`
(and the Graph REST API + `@azure/msal-node` later): fewer generated types to load and no maintenance-mode wrapper.

## 9. Auth deltas that change the sync design

- **Google "Testing" means weekly re-consent.** Refresh tokens of an external app in Testing expire after 7 days
  ([prev §4.5][prev-4.5]; also in [googleapis README][gh-googleapis]). Background sync then stops silently every week.
  For a personal project the documented way out is publishing the app unverified under the personal-use exemption
  ([prev §4.5][prev-4.5]). Because the push is state-based, an expired token loses nothing: the next run after
  reconnecting pushes the whole difference.
- **Request no identity scopes.** `calendar.app.created` alone is enough; without `openid email` no address reaches
  the app, so none can leak into a label or a log.
- **Microsoft personal accounts:** delta works with `Calendars.Read` for personal accounts (d, [delta][ms-delta-ref]);
  creating a calendar needs `Calendars.ReadWrite` (d, [create calendar][ms-post-calendars]); no Graph permission
  limited to app-created calendars was found (k), so the consent covers all calendars. Refresh tokens live "90 days"
  outside SPAs and "replace themselves with a fresh token upon every use" (d, [refresh tokens][ms-refresh]): register
  the app as a confidential web app, not an SPA (24 hours), and persist MSAL's cache in the untracked secrets file.
- **iCloud CalDAV write** uses the app-specific password from [prev §4.3][prev-4.3]: all are revoked when the Apple
  Account password changes, so a CalDAV adapter needs a "reconnect" state too.

## 10. Ranked approaches for this app

Effort: S = a day or two, M = about a week, L = several weeks. Latency is from an edit to the other side seeing it.

| Rank | Approach                                                                                      | Effort | Login                 | Public URL                         | Direction                                    | Latency                                                       | Providers                                       | What breaks                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------- | ------ | --------------------- | ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Feed + `SEQUENCE`/`LAST-MODIFIED` + stable bytes + `ETag`/`304`, with progress markers**     | S      | No                    | Yes for Google/Outlook; no for Apple on this Mac | App → calendar                               | The client's refresh: Outlook ~3 h, up to 24 h+; Google unstated; Apple user-chosen ([prev §3.2][prev-3.2]) | All that subscribe                              | Nothing comes back; on `localhost` Google and Outlook cannot subscribe; whether fetchers use the validators is unknown             |
| 2    | **One-way push to an app-owned Google calendar + read-back as a proposed update** (recommended) | M      | OAuth (`calendar.app.created`) | No (loopback redirect, outbound calls) | App → calendar; calendar → app reviewed      | Push: seconds after a save; read-back: the poll interval (≤ 10 min) or on focus | Google                                          | Weekly token expiry in Testing; gesture ambiguity (a delete); positional uids if `content.ts` gains a session mid-course            |
| 3    | One-way push to an app-owned calendar, progress fields, no read-back                          | M      | OAuth                 | No                                 | App → calendar                               | Seconds                                                       | Google                                          | Calendar-side edits are silently overwritten at the next push                                                                       |
| 4    | Feed only, progress markers (what exists)                                                     | done   | No                    | As rank 1                          | App → calendar                               | As rank 1, plus clients cannot tell a newer version           | All that subscribe                              | No versioning signal; bytes differ on every fetch                                                                                    |
| 5    | Rank 2 for Microsoft Graph                                                                    | M      | OAuth (`Calendars.ReadWrite`, all calendars) | No                                 | Both, reviewed                               | As rank 2                                                     | Outlook.com, Microsoft 365                      | Id map is mandatory; delta for secondary calendars only in beta; un-skipping a repeat means recreating it                           |
| 6    | CalDAV push + `sync-collection` read-back for iCloud                                          | M      | App-specific password | No                                 | Both, reviewed                               | Seconds / poll                                                | iCloud (also Fastmail, Nextcloud)               | Endpoint not documented by Apple (f); password revoked on Apple Account changes; no per-event colour                                |
| 7    | Import once, read back through the calendar's secret iCal address (busy-overlay code)         | S      | No                    | No                                 | Calendar → app only                          | The provider's export delay (unknown)                         | Google, Outlook (if they keep `UID`)            | Every app-side change needs a re-import that may duplicate; no colour; untested                                                     |
| 8    | Mirror sessions as Google Tasks / To Do items                                                 | M      | OAuth                 | No                                 | Both for done only                           | Poll                                                          | Google Tasks, Microsoft To Do                   | A task has no time slot through the API; two items per session                                                                      |
| 9    | Full two-way sync (automatic merge)                                                           | L+     | OAuth                 | Yes for webhooks, or poll          | Both, automatic                              | Seconds to minutes                                            | Each provider separately                        | Edits bypass the preview and rules, fight `pnpm run plan` and undo, and silently change progress statistics                        |

## 11. Recommended design

> **Built** (2026-11): the feed fix as described, and the Google push with read-back. The names differ from the
> sketch below: the pure core is `plan-domain/src/google-sync.ts` (`googleBody`, `planPush`, `readGoogleEvent`,
> `triage`), the adapter and the round are `plan-data/src/google/`, and the planner feature is `google-sync`.
> Calendar colours are not set, and an event made in Google in an app calendar is left alone.
>
> One change from section 11.6 after use: reviewing every edit asked the person to approve what they had just done
> in Google, so a round takes edits in as history steps marked as coming from Google, with Undo as the way back, and
> the inbox keeps only those that clash with a change made in the planner (field by field) or that the plan cannot
> take. A rename is taken as a title change. The client is a Web application one, whose redirect URI the planner
> shows, rather than a Desktop one, which Google documents only for loopback addresses without a path.

Two pieces, in order: the feed fix (rank 1) because it is cheap and serves Apple now and everyone after a deployment,
then the Google push with reviewed read-back (rank 2), which is what keeps a phone calendar in step while the app runs
on `localhost`. Microsoft and iCloud reuse the same core later.

### 11.1 Where the code goes

Following [architecture.md][arch]:

- **`packages/plan-domain/src/sync.ts` (pure, tested):** `projectEvent(event)` → the provider-neutral fields the app
  owns (title with `✓ `, transparency, description with the "took …" line, times, recurrence lines including
  `EXDATE`); `fingerprint(fields)`; `planPush(desired, rows)` → inserts, patches, deletes; `classifyIncoming(row,
  incoming, planEvent)` → a `PlanChange`, a review item, or nothing. Moves and skips reuse `moveOccurrence` and
  `removeOccurrence` from `occurrence-changes.ts`.
- **`packages/plan-data/src/sync/` (Node):** a Google adapter over `fetch`, the push/pull engine, and the poller.
  `store.ts` stays the only writer: it gains `readSyncState`/`writeSyncState` and a merging `writeLocal`.
- **`apps/web/src/server/sync.ts` + `routes/api/google.callback.ts`:** connect, status, "Sync now", the review list;
  the OAuth callback on the loopback address.
- **`modules/planner` feature `calendar-sync`:** a status chip and a "3 changes from Google Calendar" bar that opens
  the existing update preview. Data and callbacks come in as props.

### 11.2 Data stored, all untracked

| File                                  | Content                                                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env` (already ignored)              | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                                                                                                                     |
| `packages/plan-data/data/local.json`  | Existing `busyFeed`, plus `google: { refreshToken, scope, connectedAt }` (later the MSAL cache, the iCloud password). Written with owner-only permissions; never returned by a server function |
| `packages/plan-data/data/sync.json` (new; add to `.gitignore`) | `feed.revisions[uid] = { seq, modified, hash }`; `google.calendars[planCalendarId] = { id, syncToken }`; `google.events[uid]` = the mapping row of section 7.1; `google.inbox` = open proposals with the etag they were seen at and the `planHash` they were based on; `google.status`, `lastPull`, `lastPush` |

### 11.3 The feed fix (rank 1)

1. `writePlan` in `store.ts` updates `feed.revisions`: for each event, hash the fields the feed emits; when the hash
   changes, `seq` + 1 and `modified` = now. Rows of removed events stay, so a restore continues upwards. Bumping on
   every emitted change is simpler than tracking the RFC 5546 list and is allowed ("MAY also require").
2. `ics.ts` takes the revisions as an option and writes `SEQUENCE` and `LAST-MODIFIED`. For stable bytes, drop
   `METHOD` and set `DTSTAMP` = `LAST-MODIFIED` (the no-`METHOD` reading of RFC 5545 §3.8.7.2), after testing an
   import in Google, Outlook and Apple as [prev §2][prev-2] asks. Fallback: keep `METHOD:PUBLISH` (Google's own feed
   does) and compute a weak `ETag` over everything except `DTSTAMP`.
3. Done sessions: keep `✓ ` and `TRANSP:TRANSPARENT`; first `DESCRIPTION` line `✓ Done · took 1 h 15 min of 2 h`;
   `X-LC-DONE` / `X-LC-ACTUAL` for the app's own CalDAV round trips.
4. The route answers `If-None-Match` and `If-Modified-Since` with `304`, sends `ETag` and `Last-Modified` (the
   newest `LAST-MODIFIED`), and `Cache-Control: no-cache` instead of `no-store`, so revalidation is allowed.

### 11.4 The Google sync loop (rank 2)

Triggers: server start, a plan write by anyone (viewer, `/api/plan-update`, MCP, `pnpm run plan`, undo/redo: detect
by the plan file's content hash, since the MCP server is another process), planner focus, "Sync now", and a 10-minute
timer with ± 25 % jitter. One round, never two at once:

1. **Pull.** For each app calendar, `events.list` with its `syncToken` through every page. On `410`, list everything
   (`showDeleted=true`) and drop the token.
2. **Suppress echoes.** For each incoming item, find its row by `id` (or by decoding the base32hex id). Same etag as
   stored → skip. Owned fields equal to `pushed` → store the new etag, skip.
3. **Classify** the rest with `classifyIncoming` (section 11.6) into the inbox. A uid with an open inbox item is
   frozen for the push.
4. **Desire.** Read the plan (`readPlan()`), project every event, and diff against `pushed`: insert, patch, delete,
   calendar create/rename.
5. **Push** in batches of ≤ 100 with `If-Match`; one batch per kind where order matters (calendars before events).
   Store each returned etag, `pushed` and `planHash`. `412` → leave for the next pull; `409` on insert → `update`;
   `403 rateLimitExceeded`/`429` → truncated exponential backoff.
6. **Save** `sync.json` (write a temporary file, then rename) and publish the status to the planner.

### 11.5 How each `PlanChange` kind reaches Google

The engine computes calls from state, so this table is what a change *results in*, not code per kind.

| `PlanChange`                                         | Google calls                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `event.patch` (time, title, description)             | `events.patch` with `If-Match`                                                                            |
| `event.patch` `calendar`                             | `events.move` to the other app calendar (k), or delete + insert                                           |
| `event.patch` `done` / `actual`, `events.done`       | `events.patch`: `summary`, `transparency`, `colorId`, `description`, `extendedProperties.private`         |
| `event.patch` `skip` / `rrule`                       | `events.patch` of `recurrence` (RRULE + EXDATE lines)                                                     |
| `event.add`, `events.add`, `reviews.plan`            | `events.insert` with `id` = base32hex(uid), batched                                                       |
| `course.add`                                         | `calendars.insert`, then the inserts                                                                      |
| `event.split`                                        | `events.patch` (first part) + `events.insert` (the others)                                                |
| `event.detach`                                       | `recurrence` patch + `events.insert`                                                                      |
| `events.shift`, `events.move`                        | Batched `events.patch`                                                                                    |
| `event.remove`, `calendar.clear`                     | `events.delete`; row marked `deleted`                                                                     |
| `trash.restore`                                      | `events.update` of the kept id (insert → `409` → update)                                                  |
| `trash.empty`                                        | None (already deleted); purge the rows                                                                    |
| `calendar.save`                                      | New: `calendars.insert`; rename: `calendars.patch` `summary`; colour: per-user calendar-list colour (k)    |
| `calendar.remove`                                    | Delete its events and the calendar, or keep it empty if deleting it is refused under the narrow scope (k) |
| `plan.rename`                                        | None                                                                                                      |
| Undo, redo, `pnpm run plan`, a plan file opened      | Not changes, but they change the plan: the state diff pushes them like any other                          |

### 11.6 Turning calendar edits into a proposed update

| Calendar-side delta (incoming vs `pushed`)                         | Proposal                                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `✓ ` added to the title, or `colorId` = the done colour            | `{ type: 'events.done', uids: [uid], done: true }`                                                          |
| `✓ ` removed, or the done colour removed                           | `events.done` with `done: false`                                                                            |
| Start/end changed, single event                                    | `event.patch` `{ start, end }`, converted to Minsk wall-clock with the domain's date helpers               |
| An instance of the repeat moved                                    | `event.detach` (`moveOccurrence`)                                                                           |
| An instance of the repeat cancelled                                | `event.patch` `{ skip }` (`removeOccurrence`)                                                               |
| Single event deleted                                               | Review item with three buttons (section 7.4); no `PlanChange` until one is picked                           |
| New event without the app's private property, in an app calendar   | Review item "Not in the plan": `event.add` if wanted, otherwise left alone                                  |
| Other title or description edits                                   | Not proposed: the app owns text; the review list says the next push will reset it                           |

The inbox is shown as an *update* (`{ summary: 'From Google Calendar', changes }`) in the AI chat's preview:
`previewUpdate` gives the diff and the rule warnings (a finished session moved, a holiday, over budget), and single
changes can be unticked. Accepting calls `savePlanChanges`, so each becomes a history step that Undo takes back; the
next round pushes the result and recognises its own echo. Rejecting pushes the plan's version with `If-Match` on the
etag the proposal was seen at (`412` → pull again). Before applying, an item whose `planHash` no longer matches the
plan's event is marked stale and re-classified, which covers both an in-app edit in the meantime and a positional uid
that now names another session. `diffPlans` should learn to report `done`, `actual` and `skip`, or a done proposal
previews as "no change" (section 2).

### 11.7 Recovery

| Failure                                   | Recovery                                                                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `410` on a sync token                     | Full list of that calendar, compare with `pushed` as usual                                                                                                                             |
| `sync.json` lost or corrupt               | "Resync": list every event of the app calendars, rebuild rows from the base32hex ids and the private `lcUid`; with no `pushed` base, the plan wins for every field except a `✓ ` on a session not done, which becomes a proposal |
| Token expired or revoked (`invalid_grant`) | Status "Reconnect Google"; nothing is queued, the next round after reconnecting pushes the full difference                                                                           |
| Calendar deleted by the person            | That calendar paused; "Recreate" creates it again and pushes all its events                                                                                                            |
| Everything else                           | "Start over": delete the app calendars (they hold nothing the plan lacks), clear the Google part of `sync.json`, push again                                                             |

### 11.8 Microsoft and iCloud later

> **Built** (2026-11): Microsoft, through the same engine as Google. The core became app-neutral
> (`plan-domain/src/calendar-sync.ts`: `Written`, `planPush`, `RemoteEvent`, `readRemote`, `triage`), with each app's
> format beside it (`google-sync.ts`, `outlook-sync.ts`) and one engine and OAuth flow in
> `plan-data/src/calendar-sync/`. Graph differs from the sketch below: no MSAL (the same code flow as Google, with the
> rotated refresh token stored), no category for done (the ✓ in the title, as in Google), and no delta query: a round
> reads each calendar's events and, when it holds a series, its `calendarView` over a window around today. An absent
> event is a deletion, an absent repeat of a series that still has others a cancelled one. `changeKey` is checked
> right before each patch; a changed series is deleted and written again, and a cancelled repeat cannot be restored,
> so undoing one writes the series again. In the planner both apps sit in one `Integrations` dialog with a shared
> review. iCloud is not built.

Same `sync.ts` core, different adapters. Graph: immutable ids, `transactionId`, a full `calendarView` read per poll
compared by `changeKey`, a `learning-curve: done` category in `Preset4`, MSAL cache persistence. iCloud: `tsdav`,
resource name = base32hex(uid) + `.ics`, `If-None-Match: *` / `If-Match`, `sync-collection`, body written by the
existing `ics.ts` (one event per resource, `X-LC-*` properties kept), done read back from `SUMMARY` only.

## 12. When two-way sync would become worth it

Automatic merge (no review step) is worth building only when all of these hold:

1. **The calendar has become where the plan is edited**, measured: over a month, most proposals from the inbox are
   accepted unchanged. A middle step comes first: auto-accept *only* the ✓ marker (low risk, still a history step,
   still undoable) and keep moves reviewed.
2. **Uids are stable by content**, not by position in `content.ts`, so a mapping cannot silently point to another
   session after `pnpm run plan`.
3. **A `PlanChange` records its source** (viewer, chat, MCP, calendar), so the history can show and undo a calendar
   edit as such, and the rules (budget, holidays, "what is done stays") are enforced without a person looking.
4. **The app runs on a public host with a login**, so webhooks can be received safely and tokens are not usable by
   any visitor ([prev §1][prev-1]); or the latency of polling has been shown to matter.
5. **More than one person or device edits the plan** through calendars, so a review step per change no longer
   scales.

## 13. Not verified, or de facto

| Claim                                                                                                         | Status                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Subscribers delete an event that is missing from the next refresh                                            | De facto; no RFC read here defines it                                                                                             |
| Google, Outlook and Apple fetchers send `If-None-Match` / `If-Modified-Since` to a subscribed feed           | Not documented                                                                                                                     |
| The behaviour of the two public holiday feeds holds for personal secret addresses                            | Observed on public feeds only; secret addresses were not fetched                                                                  |
| Import, Outlook and Apple reaction to a feed without `METHOD` and with `DTSTAMP` = `LAST-MODIFIED`           | Not tested; [prev §2][prev-2] already asks for the test                                                                            |
| Un-deleting a Google event by `events.update` on its id                                                       | The errors guide advises update after `409`; un-deleting a cancelled event that way was not tested                                |
| Google keeps the imported `UID` in a calendar's secret iCal export (approach 7)                               | Not tested                                                                                                                         |
| `events.move` between the app's calendars, `calendarList` colour and `calendars.delete` under `calendar.app.created` | General knowledge; the scope text mentions making calendars and editing their events                                         |
| Google event colour ids (the reference page shows the palette's shape, not its entries)                       | Read them from `colors.get` at runtime                                                                                             |
| Graph `If-Match` on event update                                                                              | Not on the update page                                                                                                             |
| Graph delta on a secondary calendar in v1.0                                                                   | The v1.0 reference lists only the primary calendar; the beta reference and the guide disagree                                    |
| Restoring a cancelled Graph occurrence                                                                        | No documented way found                                                                                                           |
| No Graph permission limited to app-created calendars                                                          | General knowledge                                                                                                                  |
| Outlook mobile can set a category on an event; Google Calendar mobile can set an event colour                 | General knowledge                                                                                                                  |
| iCloud CalDAV supports `sync-collection`, `getctag`, `MKCALENDAR`; `caldav.icloud.com` as endpoint            | De facto (cal.com, tsdav); Apple publishes no developer page ([prev §4.3][prev-4.3])                                               |
| `EXDATE` appears on a CalDAV series when one instance is deleted in Apple Calendar                            | General knowledge                                                                                                                  |
| A Google Workspace add-on would need a public endpoint                                                        | General knowledge                                                                                                                  |
| Morgen's `⏹️` session marker                                                                                  | A user's statement on Morgen's feedback board                                                                                     |
| Motion's and TickTick's behaviour                                                                             | Motion's help URL redirected to its index; TickTick's help page was not found                                                     |
| `googleapis` has no Calendar batch helper                                                                     | Not described in its README                                                                                                       |

Pages that could not be read directly: Motion's "Tasks as Complete" (redirects to `usemotion.com/help`, whose Google
page does not cover completion); two older Toggl help URLs (404; the current ones were read); the Graph extensibility
overview and throttling-limits pages were read only in part (the sections cited were reached); RFC 5545 and RFC 9110
were read in chunks by offset.

[prev]: calendar-integration-research.md
[prev-1]: calendar-integration-research.md#1-short-answer
[prev-2]: calendar-integration-research.md#2-what-the-app-has-today-and-what-the-research-found-in-it
[prev-3.1]: calendar-integration-research.md#31-add-to-calendar-links-one-pre-filled-event
[prev-3.2]: calendar-integration-research.md#32-subscribing-by-url-the-feed
[prev-3.3]: calendar-integration-research.md#33-file-import
[prev-3.4]: calendar-integration-research.md#34-icalendar-properties-worth-emitting
[prev-4.1]: calendar-integration-research.md#41-google-calendar-api
[prev-4.3]: calendar-integration-research.md#43-apple
[prev-4.5]: calendar-integration-research.md#45-oauth-for-a-local-single-user-app
[prev-10]: calendar-integration-research.md#10-not-verified-or-de-facto
[feature-1.1]: feature-research.md#11-reality-fed-plan-log-actual-time-the-rest-of-the-plan-and-the-deadline-forecast-re-flow
[arch]: architecture.md
[rfc5545]: https://www.rfc-editor.org/rfc/rfc5545
[rfc5545-dtstamp]: https://www.rfc-editor.org/rfc/rfc5545#section-3.8.7.2
[rfc5546]: https://www.rfc-editor.org/rfc/rfc5546
[rfc4791]: https://www.rfc-editor.org/rfc/rfc4791
[rfc6578]: https://www.rfc-editor.org/rfc/rfc6578
[rfc9110-cond]: https://www.rfc-editor.org/rfc/rfc9110#section-13.1
[ctag]: https://github.com/apple/ccs-calendarserver/blob/master/doc/Extensions/caldav-ctag.txt
[obs-google]: https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics
[obs-icloud]: https://calendars.icloud.com/holidays/us_en.ics
[g-events]: https://developers.google.com/workspace/calendar/api/v3/reference/events
[g-insert]: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
[g-list]: https://developers.google.com/workspace/calendar/api/v3/reference/events/list
[g-sync]: https://developers.google.com/workspace/calendar/api/guides/sync
[g-versions]: https://developers.google.com/workspace/calendar/api/guides/version-resources
[g-recurring]: https://developers.google.com/workspace/calendar/api/guides/recurringevents
[g-errors]: https://developers.google.com/workspace/calendar/api/guides/errors
[g-batch]: https://developers.google.com/workspace/calendar/api/guides/batch
[g-quota]: https://developers.google.com/workspace/calendar/api/guides/quota
[g-limits]: https://knowledge.workspace.google.com/admin/calendar/avoid-calendar-use-limits
[g-caldav]: https://developers.google.com/workspace/calendar/caldav/v2/guide
[g-tasks]: https://developers.google.com/workspace/tasks/reference/rest/v1/tasks
[g-tasks-list]: https://developers.google.com/workspace/tasks/reference/rest/v1/tasks/list
[ms-event]: https://learn.microsoft.com/en-us/graph/api/resources/event
[ms-update]: https://learn.microsoft.com/en-us/graph/api/event-update
[ms-delta-ref]: https://learn.microsoft.com/en-us/graph/api/event-delta
[ms-delta-beta]: https://learn.microsoft.com/en-us/graph/api/event-delta?view=graph-rest-beta
[ms-delta-guide]: https://learn.microsoft.com/en-us/graph/delta-query-events
[ms-immutable]: https://learn.microsoft.com/en-us/graph/outlook-immutable-id
[ms-batch]: https://learn.microsoft.com/en-us/graph/json-batching
[ms-throttle]: https://learn.microsoft.com/en-us/graph/throttling
[ms-throttle-limits]: https://learn.microsoft.com/en-us/graph/throttling-limits#outlook-service-limits
[ms-lifecycle]: https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events
[ms-notify]: https://learn.microsoft.com/en-us/graph/change-notifications-overview
[ms-category]: https://learn.microsoft.com/en-us/graph/api/resources/outlookcategory
[ms-ext]: https://learn.microsoft.com/en-us/graph/extensibility-overview
[ms-recurrence]: https://learn.microsoft.com/en-us/graph/api/resources/patternedrecurrence
[ms-todo]: https://learn.microsoft.com/en-us/graph/api/resources/todotask
[ms-todo-delta]: https://learn.microsoft.com/en-us/graph/api/todotask-delta
[ms-post-calendars]: https://learn.microsoft.com/en-us/graph/api/user-post-calendars
[ms-refresh]: https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens
[a-reminders]: https://support.apple.com/en-gb/102457
[todoist-cal]: https://www.todoist.com/help/todoist/integrations/use-the-calendar-integration-rCqwLCt3G
[todoist-trouble]: https://www.todoist.com/help/todoist/troubleshooting/troubleshoot-google-calendar-integration-issues-in-todoist-SsSatVeir
[sunsama-faq]: https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-faqs
[reclaim-tasks]: https://help.reclaim.ai/en/articles/12304458-carve-out-time-for-work-with-tasks
[morgen-fb]: https://feedback.morgen.so/p/task-visual-difference-on-source-calendar-eg-checkmark
[akiflow-slots]: https://akiflow.featurebase.app/en/help/articles/3089241-time-slots
[toggl-ical]: https://support.toggl.com/icalendar-integration
[toggl-calview]: https://support.toggl.com/integrating-calendar-view-with-google-and-outlook-calendars
[clockify-cal]: https://clockify.me/help/getting-started/integrate-google-outlook-with-your-clockify-account
[npm]: https://www.npmjs.com/
[gh-googleapis]: https://github.com/googleapis/google-api-nodejs-client/blob/main/README.md
[gh-msgraph-ts]: https://github.com/microsoftgraph/msgraph-sdk-typescript/blob/main/README.md
[gh-msal-cache]: https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/caching.md
[gh-tsdav]: https://github.com/natelindev/tsdav/blob/main/README.md
