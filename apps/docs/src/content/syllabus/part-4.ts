import type { Syllabus } from './types'

export const PART_4 = [
  {
    id: 'calendar-sync',
    summary:
      'You connect the plan to real calendars three ways. The server reads the busy time of your own calendar from its secret iCal address, the `.ics` feeds get a version per event and answer `304` when nothing changed, and the plan is kept in Google Calendar and Outlook in both directions. One sync engine drives both apps through a small kit of API calls, signs in with OAuth 2.0 and PKCE, and stores edits made on a phone as history steps that Undo takes back.',
    whereWeAre:
      'The plan lives in `data/plan.json` plus `data/edits.json`, every change is a `PlanChange` stored by `saveChanges`, and each one is a step of `PlanHistory`. The planner exports `.ics` files at `/api/ics/:calendarId` and talks to language models through the update protocol of chapter 17. Nothing comes back from a calendar app, and the feed has no notion of versions: its `DTSTAMP` changes on every request.',
    problem:
      'The owner studies around a job and checks the plan on a phone. The planner cannot see the work meetings it should plan around. A subscribed feed cannot tell a newer copy of an event from an older one. A session ticked off or moved in Google Calendar never reaches the plan. Two-way sync is the usual answer, and also the usual source of silent loss: duplicated events, a phone edit overwritten by the next push, and conflicts nobody is shown.',
    outcomes: [
      'Expand an iCalendar feed (repeats, exceptions, time zones) on the server with ical.js, and keep its secret address out of the browser.',
      'Version every event of an `.ics` feed with `SEQUENCE` and `LAST-MODIFIED`, and answer `If-None-Match` with `304 Not Modified` through a weak `ETag`.',
      'Implement the OAuth 2.0 authorization code flow with PKCE and a refresh token on a server, with a narrow scope and an owner-only secrets file.',
      'Read only what changed in a Google calendar with sync tokens, recover from `410 Gone`, and avoid lost updates with `If-Match` and `412`.',
      'Sync by state instead of replaying edits, recognise your own writes by etag, and triage a person\'s edits into "take" and "hold".',
      'Put two providers behind one engine with a kit per app, and test it against an in-memory fake of the provider API.',
    ],
    concepts: [
      {
        term: 'iCalendar and recurrence expansion',
        explanation:
          'An `.ics` file is plain text: a `VCALENDAR` holding `VEVENT`s, each with a `UID`, a start, an end and optionally an `RRULE` that repeats it. One changed repeat is a separate `VEVENT` with the same `UID` and a `RECURRENCE-ID`. To know when you are busy you must expand the rule, apply its exceptions and convert time zones. `parseBusy` in `packages/plan-data/src/busy.ts` does that with ical.js and skips `TRANSP:TRANSPARENT` (free) and `STATUS:CANCELLED` events.',
        link: { label: 'RFC 5545: iCalendar', href: 'https://www.rfc-editor.org/rfc/rfc5545' },
      },
      {
        term: '`SEQUENCE`, `LAST-MODIFIED` and `DTSTAMP`',
        explanation:
          'A subscriber keeps events by `UID`. When two copies share a `UID`, the one with the higher `SEQUENCE` wins (RFC 5546), and `LAST-MODIFIED` says when it changed. `DTSTAMP` is only when the file was written, so it differs on every request. The repo keeps one row per uid in the untracked `data/sync.json` (`seq`, `modified`, a hash of what the feed carries) and `reviseEvents` bumps `seq` whenever that hash changes.',
        link: { label: 'RFC 5546: iTIP', href: 'https://www.rfc-editor.org/rfc/rfc5546' },
      },
      {
        term: 'Conditional GET: `ETag`, `If-None-Match`, `304`',
        explanation:
          'A server labels a response with an `ETag`. A client that already holds that copy sends the tag back in `If-None-Match`, and the server answers `304 Not Modified` with no body. A weak tag (`W/"…"`) promises the same meaning, not the same bytes. `icsETag` hashes the file without its `DTSTAMP` lines, and `Cache-Control: no-cache` lets a client store the feed but makes it ask every time.',
        link: {
          label: 'MDN: ETag',
          href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag',
        },
      },
      {
        term: 'OAuth 2.0 authorization code with PKCE',
        explanation:
          'The browser is sent to the provider with `client_id`, `redirect_uri`, `scope`, a random `state` and a `code_challenge`, the SHA-256 of a secret `code_verifier`. The provider redirects back with a one-time `code`. The server exchanges it, with the client secret and the verifier, for a short-lived access token and a long-lived refresh token. `state` ties the answer to this sign-in; PKCE ties the code to the party that started it. Later the refresh token alone buys new access tokens, so rounds run without the person.',
        link: { label: 'RFC 7636: PKCE', href: 'https://www.rfc-editor.org/rfc/rfc7636' },
      },
      {
        term: 'A narrow scope: `calendar.app.created`',
        explanation:
          'The planner asks Google only for `https://www.googleapis.com/auth/calendar.app.created`: it may create calendars and work only inside the calendars it created. It asks for no identity scope, so no email address ever reaches the app. The narrow scope is also why `deleteCalendar` is best effort and accepts a `403`, and why the busy overlay reads your own calendar through a separate secret iCal address.',
        link: {
          label: 'Google Calendar API: choose scopes',
          href: 'https://developers.google.com/workspace/calendar/api/auth',
        },
      },
      {
        term: 'Incremental sync with sync tokens',
        explanation:
          'The first `events.list` reads every event (with `showDeleted`), and its last page carries a `nextSyncToken`. The next call sends `syncToken` and gets only what changed since, deleted events included. When Google answers `410 Gone` the token is too old and the client lists everything again. `pull` in `engine.ts` remembers the new cursor but writes it only in `advance()`, after the edits it read are stored.',
        link: {
          label: 'Google Calendar API: synchronize resources efficiently',
          href: 'https://developers.google.com/workspace/calendar/api/guides/sync',
        },
      },
      {
        term: 'Optimistic concurrency with `If-Match`',
        explanation:
          "Every Google event has an `etag` that changes with each edit. A `PATCH` sent with `If-Match: <etag>` succeeds only if nobody changed the event since; otherwise Google answers `412 Precondition Failed`. The engine then reads the event again, absorbs a person's edit and retries once (`patch` in `engine.ts`). Graph's update page does not mention `If-Match`, so the Outlook adapter compares `changeKey` right before it writes.",
        link: {
          label: 'Google Calendar API: version resources (ETags)',
          href: 'https://developers.google.com/workspace/calendar/api/guides/version-resources',
        },
      },
      {
        term: 'Sync by state, echo suppression and triage',
        explanation:
          "`planPush` compares what the plan says now with what was last written, per uid, through a hash of `Written`, so an edit, an Undo, `pnpm run plan` and an MCP update reach the calendar the same way. Reading back, an item whose etag equals the stored one is the app's own write coming back and only its etag is noted. Anything else becomes a `Proposal`, and `triage` takes it into the plan unless the planner changed the same field since the last write (`both`) or the plan cannot take it (`misfit`).",
      },
    ],
    decisions: [
      {
        question: "How should the plan's changes reach the person's calendar apps?",
        options: [
          {
            name: 'A subscribed .ics feed only',
            pros: [
              'No login and no client to register',
              'Every calendar app can subscribe',
              'Already served at `/api/ics/:calendarId`',
            ],
            cons: [
              'Google and Outlook fetch a feed only from a public URL, never from `localhost`',
              'Clients refresh on their own schedule, from hours to a day',
              'Nothing made in the calendar comes back',
            ],
          },
          {
            name: 'CalDAV or a unified calendar API',
            pros: ['One protocol or one vendor for several providers'],
            cons: [
              'A unified API keeps the grants and tokens at the vendor and adds a monthly bill, without removing the OAuth app registration',
              'The research ranks iCloud CalDAV below a direct Google push for this app',
            ],
          },
          {
            name: 'Push into app-owned calendars through each provider API',
            pros: [
              'Works from `localhost`: only outbound HTTPS and a loopback redirect',
              'A change arrives seconds after a save',
              'Edits made in the calendar can be read back',
            ],
            cons: [
              'Each person registers an OAuth client',
              'Provider quirks: ids, recurrence, missing operations',
              'Refresh tokens of a Google app left in Testing expire after 7 days',
            ],
          },
        ],
        chosen: 'Push into app-owned calendars through each provider API',
        why: 'The sync research ranks a versioned feed first, because it costs a day and helps every subscriber, and recommends a push into an app-owned Google calendar with read-back, because an API push needs only outbound HTTPS and a loopback redirect, so it works from `localhost`, which the feed does not. Both were built: the feed fix in `8958caa`, the push in `2ed2657`. Microsoft Graph later reused the same design.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/calendar-sync-research.md', note: '§1 Short answer, §10 Ranked approaches' },
          { kind: 'file', ref: 'docs/calendar-integration-research.md', note: '§5.1 Unified calendar APIs' },
          { kind: 'commit', ref: '8958caa' },
          { kind: 'commit', ref: '2ed2657' },
        ],
      },
      {
        question: 'What should happen to an edit the person makes in Google Calendar or Outlook?',
        options: [
          {
            name: 'Review every edit as a proposal',
            pros: ['Nothing changes the plan without a look', 'Reuses the update preview and its rule warnings'],
            cons: ['Asks the person to approve what they did on the phone a minute ago'],
          },
          {
            name: 'Take edits in as history steps and hold only clashes',
            pros: [
              'The phone behaves like the planner: an edit is a decision',
              'Undo is the way back, as for any change',
              'Real conflicts and edits the plan cannot take still wait',
            ],
            cons: ['A stray tap changes the plan until undone', 'Needs a field-by-field clash check'],
          },
          {
            name: 'Automatic last-writer-wins merge',
            pros: ['No inbox at all'],
            cons: [
              'Google\'s `updated` does not move for every change, and `pnpm run plan` regenerations make "newer" meaningless',
              'Edits would bypass the preview and the rules',
            ],
          },
        ],
        chosen: 'Take edits in as history steps and hold only clashes',
        why: "The first build reviewed every edit (`2ed2657`, `bc9ec92`). The commit that replaced it says an edit made in Google is the person's own decision, so `triage` lets it in like one made in the planner, with Undo as the way back; only an edit to something the planner changed too, compared field by field, and one the plan cannot take wait for a decision.",
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: 'd542fd2' },
          { kind: 'commit', ref: '250d519' },
          {
            kind: 'file',
            ref: 'docs/calendar-sync-research.md',
            note: '§7.3 Conflict strategies, the "Built" note in §11',
          },
        ],
      },
      {
        question: 'Where do the OAuth client and the tokens live?',
        options: [
          {
            name: 'A browser-only token (Google Identity Services token model)',
            pros: ['No secret stored anywhere'],
            cons: ['A new token only from a user gesture, so no background rounds'],
          },
          {
            name: "Server-side code flow with PKCE and the person's own client",
            pros: [
              'The refresh token never reaches the browser',
              'Rounds run in the background',
              'A project used only by its owner needs no Google verification',
            ],
            cons: [
              'The person creates a client in Google Cloud or Microsoft Entra',
              'Secrets on disk need owner-only permissions',
            ],
          },
          {
            name: 'One shared app client for every installation',
            pros: ['One-click connect'],
            cons: ['A public Google app needs verification', 'Every local installation would share one client secret'],
          },
        ],
        chosen: "Server-side code flow with PKCE and the person's own client",
        why: "The commit body: signing in uses the person's own OAuth client with PKCE and the `calendar.app.created` scope; the client and refresh token stay in `data/local.json`, readable by its owner only. The integration research treats the app as a confidential client because it has a server, and rules out the browser token model for lack of background sync.",
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '2ed2657' },
          {
            kind: 'file',
            ref: 'docs/calendar-integration-research.md',
            note: '§4.5 OAuth for a local, single-user app',
          },
          { kind: 'commit', ref: '8ecbe99', note: 'the client type and audience Google now asks for' },
        ],
      },
      {
        question: 'Outlook arrives: copy the Google engine, or generalise it?',
        options: [
          {
            name: 'A second engine for Outlook',
            pros: ['No risk to the working Google sync'],
            cons: ['Rounds, triage, review and Undo written twice and drifting apart'],
          },
          {
            name: 'One engine with a kit per app',
            pros: [
              'The rules live once, in `calendar-sync.ts` and `engine.ts`',
              'A new app is a kit, an entry in `CALENDAR_PROVIDERS`, a setup component and its messages',
            ],
            cons: [
              'The adapter interface must absorb real differences: Graph has no move, no restore of a cancelled repeat, no delta for app calendars in v1.0',
            ],
          },
        ],
        chosen: 'One engine with a kit per app',
        why: 'The commit body: what a plan event says in a calendar app, what an edit there means and which edits wait are now provider-neutral; each app only maps its own format; sign-in, rounds, take-in, review and Undo are one engine for both. The architecture note lists what a new app takes.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '960f8ae' },
          { kind: 'file', ref: 'docs/architecture.md', note: 'the "calendar app the plan is written to" entry' },
        ],
      },
    ],
    steps: [
      {
        title: 'Show your own busy time behind the plan',
        detail:
          "Read a work or personal calendar from its secret iCal address on the server only: the address is a credential, so it lives in the untracked `data/local.json` (or `BUSY_ICS_URL`) and the browser learns its host and nothing else. `loadBusy` fetches with a timeout and a size cap and reuses the file for ten minutes. `parseBusy` registers the file's `VTIMEZONE`s, relates changed repeats to their series, expands each rule up to a guard of 5000 repeats and skips free and cancelled events. Times become Minsk wall-clock ms like every time of the plan, and nothing of that calendar is stored or exported.",
        files: [
          {
            path: 'packages/plan-data/src/busy.ts',
            lines: [30, 73],
            note: '`parseBusy`: time zones registered, exceptions related to their series, repeats expanded, free and cancelled events skipped.',
          },
          {
            path: 'packages/plan-data/src/busy.ts',
            lines: [75, 88],
            note: '`loadBusy`: one fetch reused for ten minutes, refused when the answer is not a calendar or is over 5 MB.',
          },
          {
            path: 'apps/web/src/server/busy.ts',
            lines: [5, 22],
            note: '`BusyFeed` returns only the host of the address; the secret stays on the server.',
          },
          {
            path: 'packages/plan-domain/src/busy.ts',
            lines: [1, 12],
            note: '`BusyBlock`, the only shape of that calendar the browser ever sees.',
          },
        ],
        commit: '75998b8',
      },
      {
        title: 'Give every feed event a version and answer 304',
        detail:
          'A refreshed feed could not say which copy of an event is newer. `reviseEvents` fingerprints what the feed carries of each event and bumps its `seq` when that changes; `feedRevisions` stores the rows in `data/sync.json` on every write and every request, so a plan changed by `git pull` is counted too. `buildICS` writes `SEQUENCE` and `LAST-MODIFIED`. The route sends a weak `ETag` computed without the `DTSTAMP` lines plus `Cache-Control: no-cache`, and answers a matching `If-None-Match` with `304` and no body.',
        files: [
          {
            path: 'packages/plan-domain/src/revisions.ts',
            lines: [47, 61],
            note: '`reviseEvents`: a new event starts at 0, a changed one counts up, an unchanged one keeps its row.',
          },
          {
            path: 'packages/plan-data/src/store.ts',
            lines: [112, 123],
            note: '`feedRevisions` brings the stored rows up to the plan and writes `data/sync.json` only when they changed.',
          },
          {
            path: 'packages/plan-domain/src/ics.ts',
            lines: [179, 183],
            note: '`icsETag`: a weak validator over the file with its `DTSTAMP` lines removed.',
          },
          {
            path: 'apps/web/src/routes/api/ics.$calendarId.ts',
            lines: [44, 49],
            note: 'The `ETag` and `Cache-Control` headers, and the `304` for a matching `If-None-Match`.',
          },
        ],
        commands: ['curl -i http://localhost:3000/api/ics/hfllm'],
        commit: '8958caa',
      },
      {
        title: 'Write what a calendar should show as pure functions',
        detail:
          'Before any HTTP, write the rules in `plan-domain` with no API in them. `writtenOf` turns a plan event into what a calendar shows: a ✓ and free time once done, the real length first in the notes. `googleEventId` encodes the uid in base32hex, the alphabet Google allows for client-chosen ids, so writing twice updates one event and a lost record can be rebuilt from the calendar. `planPush` compares the plan with what was last written and lists what to create, rename, insert, move, patch, remove and drop. At `2a4c3f5` this was Google-only in `google-sync.ts`; `960f8ae` moved the neutral part to `calendar-sync.ts`.',
        files: [
          {
            path: 'packages/plan-domain/src/calendar-sync.ts',
            lines: [23, 55],
            note: '`Written`, `writtenOf` and `writtenHash`: the provider-neutral event and the hash that detects a change.',
          },
          {
            path: 'packages/plan-domain/src/google-sync.ts',
            lines: [6, 29],
            note: 'The narrow scope and `googleEventId`, a reversible id derived from the uid.',
          },
          {
            path: 'packages/plan-domain/src/calendar-sync.ts',
            lines: [110, 142],
            note: '`planPush`: the work list computed from state; events with a decision pending (`frozen`) are left alone.',
          },
          {
            path: 'packages/plan-domain/src/google-sync.ts',
            lines: [170, 200],
            at: '2a4c3f5',
            note: 'The first `planPush`, Google-only, before the provider-neutral rewrite.',
          },
        ],
        commands: ['pnpm --filter @lc/plan-domain exec vitest run src/calendar-sync.test.ts src/google-sync.test.ts'],
        commit: '2a4c3f5',
      },
      {
        title: "Sign in with OAuth 2.0, PKCE and the person's own client",
        detail:
          "`connectAddress` stores a pending sign-in (a random `state`, a 48-byte verifier, the redirect URI, the time) and builds the provider URL with `code_challenge` and `code_challenge_method=S256`. `finishConnect` checks `state` and its ten-minute age, exchanges the code with the client secret and the verifier, refuses a grant whose scope lacks the calendars, and keeps the refresh token. `accessToken` caches the access token until a minute before it expires, stores a rotated refresh token, and forgets one the provider answers with `invalid_grant`, so the planner asks to connect again. Google's kit adds `access_type=offline` and `prompt=consent` so every sign-in returns a refresh token.",
        files: [
          {
            path: 'packages/plan-data/src/calendar-sync/oauth.ts',
            lines: [86, 109],
            note: '`connectAddress`: pending state and verifier written to `data/local.json`, the S256 challenge in the URL.',
          },
          {
            path: 'packages/plan-data/src/calendar-sync/oauth.ts',
            lines: [141, 158],
            note: '`finishConnect`: state check, code exchange with the verifier, scope check, refresh token kept.',
          },
          {
            path: 'packages/plan-data/src/calendar-sync/oauth.ts',
            lines: [160, 182],
            note: '`accessToken`: cached token, rotated refresh token stored, a refused one forgotten.',
          },
          {
            path: 'packages/plan-data/src/google/kit.ts',
            lines: [83, 95],
            note: "Google's endpoints, scope, `access_type=offline`, `prompt=consent` and the environment variables.",
          },
        ],
        commit: '2ed2657',
      },
      {
        title: 'Call the Calendar API: sync tokens, If-Match and backoff',
        detail:
          '`GoogleCalendarApi.send` is plain `fetch` with a bearer token: a `401` renews the token once; `429`, `5xx` and rate-limit `403`s back off exponentially with ±25 % jitter; statuses that are answers (`404`, `409`, `410`, `412`) come back as values. `listEvents` pages through `events.list` with `syncToken`, or everything with `showDeleted` the first time, and returns `gone` on `410`, after which the adapter lists everything again. `patchEvent` sends `If-Match` with the stored etag and maps `412` to `conflict`. `insertEvent` treats `409` (the id exists, even deleted) as a cue to `PUT` over it.',
        files: [
          {
            path: 'packages/plan-data/src/google/api.ts',
            lines: [33, 35],
            note: 'Exponential backoff capped at 32 s, varied by ±25 %.',
          },
          {
            path: 'packages/plan-data/src/google/api.ts',
            lines: [63, 85],
            note: '`send`: bearer token, one renewal after `401`, retries only for slowed or failing answers.',
          },
          {
            path: 'packages/plan-data/src/google/api.ts',
            lines: [109, 161],
            note: 'Paged listing with `syncToken` and `410`, insert over `409`, and `If-Match` with `412` as a conflict.',
          },
          {
            path: 'packages/plan-data/src/google/kit.ts',
            lines: [37, 46],
            note: '`readCalendar`: an expired token falls back to a full listing; a missing calendar is reported.',
          },
        ],
        commit: '2ed2657',
      },
      {
        title: 'Test against a fake Google, not a mock per call',
        detail:
          '`FakeGoogle` is an in-memory Google: a token endpoint and the Calendar calls the sync makes, behind a `fetch` the test installs with `vi.stubGlobal`. Every change bumps one version that serves as the etag and, as `v<n>`, the sync token; switches such as `revoked`, `expired`, `apiOff` and `granted` reproduce failures. The store finds its files when first imported, so the test points `PLAN_DATA_DIR` at a temporary folder before it imports the modules. Each test is a story: the first round writes everything and the next writes nothing, a ✓ typed in Google becomes a history step, Undo writes the plan back.',
        files: [
          {
            path: 'packages/plan-data/src/google/fake-google.ts',
            lines: [1, 35],
            note: 'The fake: one version counter, stored events, and the switches that reproduce failures.',
          },
          {
            path: 'packages/plan-data/src/google/google.test.ts',
            lines: [21, 45],
            note: 'A temporary data folder, cleared client variables and the fake `fetch`, set before the modules load.',
          },
          {
            path: 'packages/plan-data/src/google/google.test.ts',
            lines: [52, 72],
            note: 'The sign-in test: PKCE challenge matches the verifier, `state` is checked, `local.json` is mode `0600`.',
          },
        ],
        commands: ['pnpm --filter @lc/plan-data exec vitest run src/google/google.test.ts'],
        commit: '2ed2657',
      },
      {
        title: 'Routes for the sign-in, server functions, and when rounds run',
        detail:
          'The sign-in needs two plain HTTP routes, not server functions, because the browser navigates to them. `/api/$provider/connect` redirects to the provider with the callback on the address the planner was opened at; `/api/$provider/callback` finishes the sign-in, starts a round and redirects to `/?link=<app>&signin=<outcome>` (they began as `google.connect.ts` and `google.callback.ts` in `bc9ec92`). Every save calls `syncCalendars()` without awaiting it. In the browser, `useCalendarSync` runs a round when the planner opens, when it is focused or shown again (at most once a minute) and every ten minutes ± 25 %.',
        files: [
          {
            path: 'apps/web/src/routes/api/$provider.connect.ts',
            lines: [10, 26],
            note: 'A file route with a server `GET` handler: unknown app 404, read-only host 403, else a 302 to the sign-in.',
          },
          {
            path: 'apps/web/src/routes/api/$provider.callback.ts',
            lines: [11, 36],
            note: 'The callback: `access_denied`, a finished sign-in that starts a round, or the reason it failed.',
          },
          {
            path: 'modules/planner/src/features/calendar-sync/model/use-calendar-sync.ts',
            lines: [62, 89],
            note: 'Rounds on open, on focus or visibility, and on a jittered ten-minute timer.',
          },
          {
            path: 'apps/web/src/server/plan.ts',
            lines: [48, 52],
            note: 'After every save each connected app is sent the plan in the background.',
          },
        ],
        commit: 'bc9ec92',
      },
      {
        title: 'Triage: take edits in, hold only clashes and misfits',
        detail:
          '`readRemote` turns one remote event into a reading: `seen` (an echo, by etag), `reset` (a cleared title or a moved series, written back) or proposals (done, a new title or time, a skipped or detached repeat, a deletion to the trash). `triage` groups proposals by the remote event and holds a group when `clashes` finds the planner changed the same field since the last write, or when `previewUpdate` reports a problem. A round stores the rest with `saveChanges(changes, provider)`, a history step Undo takes back, and only then calls `advance()` to keep the new sync tokens. Rounds and decisions run one at a time through `exclusive`.',
        files: [
          {
            path: 'packages/plan-domain/src/calendar-sync.ts',
            lines: [193, 241],
            note: '`readRemote`: echo, reset, or proposals for done, title, time, repeats and deletions.',
          },
          {
            path: 'packages/plan-domain/src/calendar-sync.ts',
            lines: [247, 290],
            note: '`clashes` compares field by field; `triage` splits proposals into `take` and `hold`.',
          },
          {
            path: 'packages/plan-data/src/calendar-sync/engine.ts',
            lines: [131, 156],
            note: '`round`: pull, triage, file held edits, take in, advance cursors, push; failures kept as a code.',
          },
          {
            path: 'packages/plan-data/src/calendar-sync/engine.ts',
            lines: [206, 245],
            note: '`pull` returns `advance`; `takeIn` stores the edits as one history step with the app as source.',
          },
        ],
        commit: 'd542fd2',
      },
      {
        title: 'One engine, a kit per app: add Outlook and one Integrations dialog',
        detail:
          "Generalise instead of copying. `CalendarAdapter` is the dozen calls a round makes, already in domain terms; `OAuthConfig` holds the sign-in addresses, the scope and how to recognise a granted one; `CalendarKit` bundles both with an error mapper, and `kitOf` picks one per provider. Graph's differences stay in its adapter: `patchEvent` compares `changeKey` before it writes, a changed series is deleted and written anew because a cancelled repeat cannot be restored, and a move is an insert in the target calendar plus a delete. `ac74d5e` then gathered Google, Outlook, the busy overlay and the export in one Integrations dialog with a shared review.",
        files: [
          {
            path: 'packages/plan-data/src/calendar-sync/kit.ts',
            lines: [12, 68],
            note: '`CalendarAdapter`, `OAuthConfig` and `CalendarKit`: everything an app has to offer.',
          },
          {
            path: 'packages/plan-data/src/calendar-sync/providers.ts',
            lines: [1, 9],
            note: 'The registry: one kit per `CalendarProvider`.',
          },
          {
            path: 'packages/plan-data/src/outlook/kit.ts',
            lines: [79, 99],
            note: 'Graph without `If-Match`: read `changeKey` first, rewrite a changed series, move as insert plus delete.',
          },
          {
            path: 'docs/architecture.md',
            lines: [127, 138],
            note: 'Where the neutral core, the engine, the kits and the `$provider` routes live, and what a new app takes.',
          },
        ],
        commands: ['git show 960f8ae --stat'],
        commit: '960f8ae',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm --filter @lc/plan-domain exec vitest run src/revisions.test.ts src/calendar-sync.test.ts',
        'pnpm --filter @lc/plan-data exec vitest run src/google/google.test.ts src/outlook/outlook.test.ts',
        'curl -i http://localhost:3000/api/ics/hfllm',
        "ETAG=$(curl -s -D - -o /dev/null http://localhost:3000/api/ics/hfllm | grep -i '^etag:' | cut -d' ' -f2- | tr -d '\\r'); curl -s -o /dev/null -w '%{http_code}\\n' -H \"If-None-Match: $ETAG\" http://localhost:3000/api/ics/hfllm",
      ],
      expect: [
        'All pass: versions count up only on a change a subscriber would see, the validator ignores `DTSTAMP`, a plan in step writes nothing, and an edit is taken unless the planner changed the same thing.',
        'Both suites pass against the in-memory fakes, with no network and no account.',
        'With `pnpm run dev` running: `200`, an `ETag: W/"…"` header, `Cache-Control: no-cache`, and `SEQUENCE:` and `LAST-MODIFIED:` in each `VEVENT`.',
        'Prints `304`: the second request sent the tag back and got no body.',
      ],
      quiz: [
        {
          question:
            'A round reads an event from Google whose `etag` equals the one stored in its `SyncRow`. What does `readRemote` conclude?',
          options: [
            'The person edited it, so a proposal is filed',
            "It is the app's own write coming back, so only the etag is noted",
            'The sync token expired and a full listing is needed',
            'The event was deleted in Google',
          ],
          answer: 1,
          explanation:
            "The stored etag is the one the app's own write returned, so an equal etag means nothing changed elsewhere: `readRemote` returns `{ kind: 'seen' }`. This is echo suppression; without it every push would read back as an edit.",
        },
        {
          question: 'Why does `pull` return an `advance` function instead of saving the new sync token right away?',
          options: [
            'Google requires the token back within ten minutes',
            'So a round that fails before the edits are stored reads the same changes again next time',
            'Because a sync token is valid only for the first page',
            'So Undo can move the token back',
          ],
          answer: 1,
          explanation:
            'A sync token means "everything before this is handled". `250d519` advances it only after `takeIn` stored the edits, so a round cut short re-reads them instead of losing them.',
        },
        {
          question:
            "The person adds ✓ before a session's title in Google. Since the last push, the planner moved that session to another day but did not touch its done mark. What does `triage` do?",
          options: [
            'Holds the edit, because the planner changed the event since it was written',
            'Takes it into the plan: for `events.done` only a change of the done mark in the planner clashes',
            "Rejects it and writes the plan's version back to Google",
            "Undoes the planner's move so Google's version wins whole",
          ],
          answer: 1,
          explanation:
            '`clashes` is field by field: for an `events.done` change it asks only whether the planner changed the ✓ too. `d542fd2` made the comparison field by field so an unrelated planner change does not hold back an edit.',
        },
      ],
    },
    pitfalls: [
      'Advancing a sync token as soon as a page is read: if storing the edits then fails, the next round asks for changes after them and they are lost. `250d519` moved the cursor update into `advance()`, called only after the edits are stored.',
      "Reading a Google `dateTime` that has no offset on the machine's clock. `wallOf` reads such a time on the event's own clock, which the app writes in the plan's zone (`2ed2657`); never parse a wall-clock string with `new Date`.",
      'Counting a sign-in as connected when the person unticked calendar access on the consent page. The token response then lacks the scope; `finishConnect` checks `granted(scope)` and fails with `scope` (`250d519`).',
      'Registering a Desktop OAuth client: Google documents loopback redirects for it without a path, while the callback is `/api/google/callback`. The README and the setup dialog moved to a Web application client with that redirect URI (`8ecbe99`, `d454f6a`).',
      'Leaving the Google app in Testing: refresh tokens expire after 7 days and background sync stops weekly (research §9). `8ecbe99` recommends the Personal audience where Google offers it; a refused refresh token is forgotten and the status asks to connect again.',
      'Assuming every provider can do what Google can. Graph cannot move an event between calendars or bring back a cancelled repeat, so the Outlook adapter inserts and deletes, and writes a changed series anew (`960f8ae`).',
    ],
    tradeoffs: [
      'Polling on open, on focus and every ten minutes ± 25 % instead of push notifications: edits arrive in minutes, not seconds, but the app needs no public HTTPS endpoint, which a server without a login should not expose (research §6).',
      "The narrow `calendar.app.created` scope keeps the person's other calendars away from the app, at the price of best-effort calendar deletes and a separate secret iCal address for busy time.",
      'Taking edits in automatically replaces an inbox of approvals with trust in Undo: a wrong tap on the phone changes the plan until undone, and only clashes and misfits wait.',
      'Outlook reads each app calendar whole every round, plus a `calendarView` window when a series is there, because v1.0 delta covers only the primary calendar: more data per round, no beta endpoint.',
    ],
    links: [
      { label: 'RFC 5545: iCalendar', href: 'https://www.rfc-editor.org/rfc/rfc5545' },
      { label: 'MDN: ETag', href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag' },
      { label: 'RFC 7636: Proof Key for Code Exchange', href: 'https://www.rfc-editor.org/rfc/rfc7636' },
      {
        label: 'Google: OAuth 2.0 for web server applications',
        href: 'https://developers.google.com/identity/protocols/oauth2/web-server',
      },
      {
        label: 'Google Calendar API: synchronize resources efficiently',
        href: 'https://developers.google.com/workspace/calendar/api/guides/sync',
      },
      {
        label: 'Google Calendar API: version resources',
        href: 'https://developers.google.com/workspace/calendar/api/guides/version-resources',
      },
      { label: 'Microsoft Graph: event resource', href: 'https://learn.microsoft.com/en-us/graph/api/resources/event' },
      { label: 'ical.js documentation', href: 'https://kewisch.github.io/ical.js/' },
    ],
    next: 'Chapter 19 re-balances a course around the rest of the plan and this busy time, with an integer program solved on the server.',
  },
  {
    id: 'rebalancing',
    summary:
      'You replace "Shift the plan" with a Reschedule dialog that moves a course by days or hours and re-balances one calendar, at a pace or towards its deadline. Plain rules work out the room and the start times; an integer program solved by HiGHS, a WebAssembly solver, decides which session goes on which day, one aim after another. The domain never imports the solver, the browser never loads it, and a worked example in the docs is run by a test.',
    whereWeAre:
      'Chapter 18 gave the server the busy time of your own calendar and kept the plan in Google Calendar and Outlook. "Shift the plan" moves open sessions by whole days only. The one deadline the plan knows is the certificates\', fixed in `meta.certDeadline`, and Catch up (chapter 16) only re-homes missed sessions.',
    problem:
      'The spec names it: HF LLM sits at 11:00 for 35 sessions, and moving it to 12:00 means dragging every session. Finishing a course sooner, or easing it to one session every second day, has no tool, and no course but the certificates can have a deadline. A fill-the-first-free-slot pass is the obvious fix and exactly wrong here: under full weeks it piles sessions into the first room, then leaves a gap, then a crunch. The result must be balanced, explainable, stable when asked twice, and must not put a heavy dependency in the browser.',
    outcomes: [
      'Model a scheduling question as a mixed-integer program: binary assignment variables, rows for room, order and budget, and an objective.',
      'Solve several aims in strict priority with a level-by-level (lexicographic) loop instead of tuned weights.',
      'Run HiGHS in WebAssembly on the server, feed it CPLEX LP text, and keep the package out of the browser bundle and inside the server build.',
      'Keep a heavy library out of a pure domain by injecting it as a function type: a fake in unit tests, the real one in integration tests.',
      "Tie an algorithm's documentation to its behaviour with a worked example that a test runs.",
      'Serve a slow computation to a debounced dialog without stale answers, both in the browser and on the server.',
    ],
    concepts: [
      {
        term: 'Integer program (MILP)',
        explanation:
          'A linear program picks values for variables that minimise a linear objective while meeting linear rows such as `a·x + b·y ≤ c`. When some variables must be whole numbers, or 0/1 for yes/no choices, it is a mixed-integer linear program. A solver searches the 0/1 combinations and proves the best one by closing the gap between the best solution found and a bound on what is possible. Here `y_i_d = 1` means "session `i` is on study day `d`".',
        link: { label: 'HiGHS: terminology', href: 'https://ergo-code.github.io/HiGHS/dev/terminology/' },
      },
      {
        term: 'A sparse model',
        explanation:
          '`buildModel` creates `y_i_d` only where session `i` can actually go: on or after the earliest day it can reach, on a day with enough room, on a day with a two-hour block for a lab. Most of the session × day matrix is never built. The docs report HF LLM, 35 sessions, proven best at every pace and deadline tried in 1.5 s or less.',
      },
      {
        term: 'Relaxation and the strength of a formulation',
        explanation:
          'A MIP solver first ignores integrality to get a bound; the tighter the bound, the less it has to search. "Sessions keep their order" can be written with day indices and a big-M constant, which is short but has a weak bound, or with running sums `Y_i_d` (1 once session `i` is placed by day `d`) and `Y_{i+1,d} ≤ Y_{i,d}`. The repo switched to the running sums because the big-M version could not place a real course within its time limit.',
      },
      {
        term: 'Lexicographic (level-by-level) objectives',
        explanation:
          'The aims rank in strict order, for example: fewest sessions left out, fewest late, least over the budget, closest to the rhythm, lightest heaviest week and day, most sessions staying put, earliest days. `solveInOrder` minimises level 1, adds the row `level_1 ≤ best + slack`, minimises level 2 under it, and so on. A lower aim can never buy itself at the cost of a higher one, and there are no weights to tune.',
      },
      {
        term: 'Warm start, time limit and gap',
        explanation:
          "Each level gets 2 seconds and starts from the previous level's solution through `setSolution`; the first starts from the rhythm's target placement. A level stopped by the clock still returns a feasible answer at least as good as its start. The result is then marked not proven best, with the largest MIP gap HiGHS reported.",
        link: {
          label: 'HiGHS: option definitions',
          href: 'https://ergo-code.github.io/HiGHS/dev/options/definitions/',
        },
      },
      {
        term: 'CPLEX LP format',
        explanation:
          'HiGHS reads models as text. `lpText` writes `Minimize` with an `obj:` row, `Subject To` with one named row per constraint, `Bounds`, `Binaries`, `Generals` and `End`. Names must be plain identifiers, so variables are named by index (`y_3_12`), never by uid.',
        link: {
          label: 'IBM: LP file format',
          href: 'https://www.ibm.com/docs/en/icos/22.1.1?topic=cplex-lp-file-format-algebraic-representation',
        },
      },
      {
        term: 'Injecting a heavy library',
        explanation:
          '`plan-domain` declares `type Solve = (model, options) => Promise<LpSolution>`, and `planRebalance(plan, request, now, busy, solve)` takes one. The domain keeps no runtime dependency and its tests pass a recording fake; `plan-data` passes `solveLp`, the real HiGHS. The same inversion reaches the UI: `PlannerPage` takes an optional `rebalance` prop and leaves the Re-balance mode out without it.',
      },
      {
        term: 'WebAssembly on the server',
        explanation:
          "The `highs` package is the C++ solver compiled to WebAssembly, plus a JS loader that finds `highs.wasm` beside itself. Bundling the loader breaks that path, and Nitro's dependency tracer cannot see a file the loader reaches through `new URL`. So `vite.config.ts` keeps `highs` external in the SSR build and asks Nitro to copy the whole package with `traceDeps`.",
        link: { label: 'MDN: WebAssembly', href: 'https://developer.mozilla.org/en-US/docs/WebAssembly' },
      },
    ],
    decisions: [
      {
        question: 'How should one calendar be re-balanced?',
        options: [
          {
            name: 'Fill day by day',
            pros: ['Simple and easy to explain', 'No dependency'],
            cons: [
              'Not balanced: under full weeks everything piles into the first free room, then a gap, then a crunch',
            ],
          },
          {
            name: 'Rules for room and times, an integer program for the days',
            pros: [
              'Each step is testable on its own and explains its shortfalls',
              '"Balanced" means optimal under stated priorities, not what a heuristic happened to do',
              'One variable per session and day keeps the model small',
            ],
            cons: [
              'A solver dependency',
              'Fragmented free time can refuse what the day count allowed, so up to three rounds',
            ],
          },
          {
            name: 'One solver for the whole timetable',
            pros: ['Provably best for everything at once'],
            cons: [
              'Hard to explain',
              'Too much as the whole answer: a variable per session and half hour is six to sixteen times as many',
            ],
          },
        ],
        chosen: 'Rules for room and times, an integer program for the days',
        why: 'The spec weighed the three and picked "B with C at its core": the room and the start times stay explicit rules, which keeps the result explainable and the model small, and only the hard part, which session on which day, is one exact integer program.',
        evidence: 'evidenced',
        sources: [
          {
            kind: 'file',
            ref: 'docs/superpowers/specs/2026-11-23-reschedule-design.md',
            note: 'Approaches considered',
          },
          { kind: 'file', ref: 'docs/rebalancing.md', note: 'Why three steps' },
        ],
      },
      {
        question: 'How should competing aims be combined?',
        options: [
          {
            name: 'A weighted sum of aims',
            pros: ['One solve per answer'],
            cons: [
              'Weights trade aims, such as one more late session for a lighter week',
              'Weights need tuning per plan',
            ],
          },
          {
            name: 'Levels solved one after another',
            pros: ['Strict priorities with no weights', 'Each level can be explained on its own'],
            cons: [
              'Up to eight solves per round',
              'Each bound needs a small slack, or solver tolerance makes the next level infeasible',
            ],
          },
          {
            name: 'Constraints only, the first feasible answer',
            pros: ['Fastest'],
            cons: ['An arbitrary answer among the valid ones: neither stable nor even'],
          },
        ],
        chosen: 'Levels solved one after another',
        why: 'The docs: a weighted sum would trade one aim against another; levels minimised one after another mean a lower aim never buys anything at the cost of a higher one, and there are no weights to tune.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/rebalancing.md', note: 'The order of aims' },
          { kind: 'file', ref: 'packages/plan-domain/src/rebalance/lp.ts', note: 'comment on `solveInOrder`' },
        ],
      },
      {
        question: 'Where should the solver run?',
        options: [
          {
            name: 'In the browser, bundled with the planner',
            pros: ['No server round trip', 'Works on a static host'],
            cons: [
              'Ships a WebAssembly binary to every visitor',
              'The spec lists a heavy dependency in the browser bundle as an anti-goal',
            ],
          },
          {
            name: 'On the server, injected into a pure domain',
            pros: [
              'The browser never loads it',
              '`plan-domain` stays dependency-free and testable with a fake',
              'The MCP tool reuses the same code',
            ],
            cons: [
              'A solve blocks the server thread, so one request at a time',
              'A host without the server has no Re-balance',
            ],
          },
          {
            name: 'A pure-JavaScript solver inside plan-domain',
            pros: ['No WebAssembly and no build configuration'],
            cons: ['Breaks the rule that `plan-domain` has no runtime dependencies'],
          },
        ],
        chosen: 'On the server, injected into a pure domain',
        why: 'The commit and the architecture note: the domain describes a model as plain data and solves it through an injected solver; `plan-data` supplies HiGHS; adapters hold no rules; the web build leaves `highs` out of the bundle and copies the package beside the server.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '8e70267' },
          { kind: 'file', ref: 'docs/architecture.md', note: '"Work that needs a heavy library"' },
          { kind: 'file', ref: 'docs/superpowers/specs/2026-11-23-reschedule-design.md', note: 'Anti-goals' },
        ],
      },
      {
        question: 'How is "the sessions keep their order" written?',
        options: [
          {
            name: 'Big-M rows on day indices',
            pros: ['One row per pair of sessions'],
            cons: ['A weak relaxation: the solver could not place a real course within its time limit'],
          },
          {
            name: 'Running sums per session and day',
            pros: ['A tight relaxation, three nonzeros a row'],
            cons: ['One more continuous variable per session and day'],
          },
        ],
        chosen: 'Running sums per session and day',
        why: 'The commit that switched says the order is kept with running sums instead of day indices, whose relaxation was too weak to place a real course in time; the comment on `buildModel` repeats it.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '2a170c2' },
          { kind: 'file', ref: 'packages/plan-domain/src/rebalance/model.ts', note: 'comment on `buildModel`' },
        ],
      },
    ],
    steps: [
      {
        title: 'Write the design and the task plan before code',
        detail:
          "Start with `docs/superpowers/specs/2026-11-23-reschedule-design.md`: goals, non-goals, anti-goals (a pile-up, a heavy dependency in the browser bundle), three approaches and the pick, every variable and row of the program, and the order of aims. Then split it into ten tasks in `docs/superpowers/plans/2026-11-23-reschedule.md`, each naming what it consumes from the tasks before. The spec's objective table is not what ships: `c2d585c` later put the rhythm above the heaviest week, so read the spec as the starting design and `docs/rebalancing.md` as the current one.",
        files: [
          {
            path: 'docs/superpowers/specs/2026-11-23-reschedule-design.md',
            lines: [78, 91],
            note: 'The three approaches and why rules plus an exact program was picked.',
          },
          {
            path: 'docs/superpowers/specs/2026-11-23-reschedule-design.md',
            lines: [225, 248],
            note: 'The original lexicographic objective table, the budget rule and the size limits.',
          },
          {
            path: 'docs/superpowers/plans/2026-11-23-reschedule.md',
            lines: [5, 35],
            note: 'Goal, architecture and global constraints: `highs` pinned, 2 s a level, 300 sessions, 366 days.',
          },
        ],
        commit: '734b135',
      },
      {
        title: 'A deadline is a milestone event of its calendar',
        detail:
          "Give every calendar a deadline the planner can aim at, without a new data type. A calendar's deadline is its earliest `kind: 'milestone'` event: one source that the grid, the `.ics` export, Google, Outlook and the rule check already understand. `meta.certDeadline` and `meta.lastCertDay` leave the plan meta, and widgets ask `nextDeadline(plan, now)` instead of assuming the certificates.",
        files: [
          {
            path: 'packages/plan-domain/src/deadlines.ts',
            lines: [4, 33],
            note: '`deadlineEvent`, `deadlineOf` and `nextDeadline`, all read from milestone events.',
          },
        ],
        commands: ['pnpm --filter @lc/plan-domain exec vitest run src/deadlines.test.ts'],
        commit: 'bdd8d04',
      },
      {
        title: 'Shift by hours, and refuse to cross midnight',
        detail:
          "`events.shift` takes `hours`, whole or half, beside `days`. Every target is checked before anything moves, and a shift that would put a session across midnight fails with that session named instead of silently changing its length. `events.move` gains `reason: 'rebalance'` and `calendar`, so the history names the re-balanced course. The JSON Schema, the guide and `parseChange` change in the same commit, as the protocol requires.",
        files: [
          {
            path: 'packages/plan-domain/src/changes.ts',
            lines: [71, 89],
            note: 'The `events.shift` and `events.move` change types with `hours`, `reason` and `calendar`.',
          },
          {
            path: 'packages/plan-domain/src/changes.ts',
            lines: [484, 503],
            note: 'Applying a shift: all sessions checked for midnight first, then patched one by one.',
          },
        ],
        commit: 'b4dda08',
      },
      {
        title: 'Describe models as data and solve them level by level',
        detail:
          'An `LpModel` is plain data: variables with a kind and bounds, named rows, an objective. `Solve` is a function type, so the domain never imports a solver. `solveInOrder` minimises each level with the levels before it held at their best value plus a slack of `1e-6 · max(1, |best|)`, and starts each level from the last solution. In `plan-data`, `solveLp` loads HiGHS once (`runtime ??= highsLoader()`), writes CPLEX LP text, sets the time limit and the start, and rounds integer variables that HiGHS returned within its tolerance.',
        files: [
          {
            path: 'packages/plan-domain/src/rebalance/lp.ts',
            lines: [38, 92],
            note: '`Solve` and `solveInOrder`: each level bounded by the best of the one before it.',
          },
          {
            path: 'packages/plan-data/src/solver.ts',
            lines: [1, 5],
            note: 'HiGHS loaded once, lazily, the first time a model is solved.',
          },
          {
            path: 'packages/plan-data/src/solver.ts',
            lines: [22, 46],
            note: '`lpText`: the model as CPLEX LP text, names checked against the format.',
          },
          {
            path: 'packages/plan-data/src/solver.ts',
            lines: [53, 80],
            note: '`solveLp`: options, warm start, status mapping, integral rounding and the MIP gap.',
          },
        ],
        commands: [
          'pnpm --filter @lc/plan-domain exec vitest run src/rebalance/lp.test.ts',
          'pnpm --filter @lc/plan-data exec vitest run src/solver.test.ts',
        ],
        commit: '8e70267',
      },
      {
        title: 'Step 1: the room',
        detail:
          "Room is rules, not optimisation. `roomOf` lists the study days of the year from the first day: weekdays, and a weekend day only if the course already uses that kind; no holidays, no days the busy calendar takes whole. On each it keeps the free half-hour slots inside the study hours, minus every other busy occurrence (repeats such as the gym included), the person's busy time and the past, and derives `cap` and `lab`. Each week gets what is left of the budget. The moving sessions' own slots count as free, and a slot outside the study hours stays room for its own session.",
        files: [
          {
            path: 'packages/plan-domain/src/rebalance/room.ts',
            lines: [15, 42],
            note: "`RoomDay` and `Room`: slots, `cap`, `lab`, week budgets, days off and each session's own slot.",
          },
          {
            path: 'packages/plan-domain/src/rebalance/room.ts',
            lines: [56, 129],
            note: '`roomOf`: study days, blocking occurrences and busy time, slots on the half-hour grid.',
          },
        ],
        commands: ['pnpm --filter @lc/plan-domain exec vitest run src/rebalance/room.test.ts'],
        commit: '2610a28',
      },
      {
        title: 'Step 2: the integer program',
        detail:
          "`buildModel` creates `y_i_d` only where a session fits, `u_i` for a session left out (always the tail: `u_i ≤ u_{i+1}`), running sums `Y_i_d` for the order, `L_d` for a day's load, `over_w` only when going over the budget is allowed, and `Pw` and `Pd` for the heaviest week and day. Rows tie them together: `reach`, `order`, `once`, `room`, `labs`, `week`, `peakw`, `peakd`. The levels are two arrays at the end; at the pinned commit they read, towards a deadline `[unplaced, late, over, rhythm, Pw, Pd, stay, early]`, at a pace `[unplaced, rhythm, over, Pw, Pd, stay, early]`; empty levels are dropped. The `rhythm` level takes its place there in the last step of this chapter, and the first version (`7173882`) kept the order with big-M rows on day indices.",
        files: [
          {
            path: 'packages/plan-domain/src/rebalance/model.ts',
            lines: [147, 164],
            note: 'Every variable explained, including why running sums beat a big-M order.',
          },
          {
            path: 'packages/plan-domain/src/rebalance/model.ts',
            lines: [165, 264],
            note: 'Variables only where a session fits, then the rows for reach, order, once, room, labs and weeks.',
          },
          {
            path: 'packages/plan-domain/src/rebalance/model.ts',
            lines: [266, 295],
            note: 'The levels of each mode and the start placement handed to the solver.',
          },
          {
            path: 'packages/plan-domain/src/rebalance/model.ts',
            lines: [72, 78],
            at: '7173882',
            note: 'The first order row: `t_i − t_{i+1} − D·u_{i+1} ≤ 0`, a big-M with a weak relaxation.',
          },
        ],
        commands: ['pnpm --filter @lc/plan-domain exec vitest run src/rebalance/model.test.ts'],
        commit: '7173882',
      },
      {
        title: 'Step 3, the report and one entry point',
        detail:
          "`placeDay` picks start times by plain preferences: the session's own slot if its day stayed, the calendar's usual start for that weekday, right after the previous session, then the nearest free slot; it never squeezes a session in. `planRebalance` runs room, model and placement for up to three rounds, each time lowering a day's room by the hours placement could not fit, and returns only the sessions whose slot changed, so asking twice moves nothing.",
        files: [
          {
            path: 'packages/plan-domain/src/rebalance/placement.ts',
            lines: [8, 26],
            note: 'The order of preferences for a start time, and the promise never to squeeze a session in.',
          },
          {
            path: 'packages/plan-domain/src/rebalance/index.ts',
            lines: [75, 114],
            note: '`planRebalance`: at most 300 sessions, up to three rounds, moves only for changed slots.',
          },
        ],
        commands: ['pnpm --filter @lc/plan-data exec vitest run src/rebalance.test.ts'],
        commit: '2a170c2',
      },
      {
        title: 'Adapters, the dialog, and a worked example the tests run',
        detail:
          'The server function `rebalancePlan` validates the plan and the request and calls `rebalanceCalendar`, which adds the busy calendar and runs through `newestOnly()`: one solve at a time, and a request still waiting when a newer one arrives rejects with `Superseded` (`78cb175`). The MCP tool `rebalance_calendar` returns an update only through `rebalanceChange`, which gives nothing while a session is left without room (`d87c5de`). In the dialog, `useRebalance` waits 300 ms after the last input and keeps only the newest answer. `docs/rebalancing.md` walks a six-session example that `rebalance.example.test.ts` checks number by number with the real solver.',
        files: [
          {
            path: 'apps/web/src/server/reschedule.ts',
            lines: [12, 24],
            note: 'A POST server function that stores nothing, so it also runs on a read-only host.',
          },
          {
            path: 'packages/plan-data/src/rebalance.ts',
            lines: [18, 39],
            note: 'Busy time over the horizon, ignored when the feed does not answer; HiGHS through the newest-only queue.',
          },
          {
            path: 'packages/plan-data/src/queue.ts',
            lines: [17, 37],
            note: '`newestOnly`: one job at a time, a waiting job dropped when a newer one comes.',
          },
          {
            path: 'modules/planner/src/features/reschedule/model/use-rebalance.ts',
            lines: [6, 49],
            note: 'Debounced requests, answers matched by request id, the last answer kept while a newer one runs.',
          },
        ],
        commands: ['pnpm --filter @lc/plan-data exec vitest run src/rebalance.example.test.ts'],
        commit: 'd9eac79',
      },
      {
        title: 'Keep HiGHS on the server and inside the server build',
        detail:
          "The dialog needs the solver in a real server build, not only in tests. The loader of `highs` looks for `highs.wasm` beside itself, and `8e70267` only marked the package external for Nitro's Rollup build. `d5a6fc2` also keeps it external for Vite's SSR build (`ssr.external`), tells Nitro to copy the whole package because its tracer cannot see a file behind `new URL` (`traceDeps: ['highs*']`), and adds `highs` to `apps/web`'s dependencies. Modules never import `@lc/plan-data`, so the browser bundle cannot reach it.",
        files: [
          {
            path: 'apps/web/vite.config.ts',
            lines: [8, 27],
            note: '`ssr.external` for Vite and `rollupConfig.external` plus `traceDeps` for Nitro, each with its reason.',
          },
          {
            path: 'docs/architecture.md',
            lines: [139, 153],
            note: 'The pattern for work that needs a heavy library: model, injected library, supplier, adapters, module, bundle.',
          },
        ],
        commands: ['git show d5a6fc2 -- apps/web/vite.config.ts apps/web/package.json'],
        commit: 'd5a6fc2',
      },
      {
        title: 'Targets from a rhythm, so the solver confirms instead of searching',
        detail:
          "`c2d585c` fixes what the first runs showed: a course that lost days to a full week caught up with three sessions on the next day, the solver started from the earliest placement, and with the heaviest week ranked first far deadlines gave one session, a month without, then three a day. `rhythmDays` gives each session a target day: it steps `gap` study days from the course's first session, carries fractions over, and starts again where a session has to wait for room, so a full week is never made up for with a crunch. Towards a deadline `targetDays` halves the gap 40 times to find the slowest rhythm that still finishes before it, within the budget when that is enough. The rhythm enters the program as a cost on each `y` (`hours · |d − target|`), and the targets are the solver's start: when they place every session they are provably best at once.",
        files: [
          {
            path: 'packages/plan-domain/src/rebalance/model.ts',
            lines: [18, 72],
            note: '`rhythmDays`: the rhythm, its restart after a wait, and the fit rules it shares with the model.',
          },
          {
            path: 'packages/plan-domain/src/rebalance/model.ts',
            lines: [85, 127],
            note: '`targetDays`: the pace as asked, or the slowest rhythm that meets the deadline, found by halving.',
          },
        ],
        commit: 'c2d585c',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm --filter @lc/plan-domain exec vitest run src/rebalance',
        'pnpm --filter @lc/plan-data exec vitest run src/rebalance.example.test.ts',
        'pnpm --filter @lc/plan-data exec vitest run src/queue.test.ts src/solver.test.ts',
      ],
      expect: [
        'Every `rebalance/*.test.ts` passes without HiGHS: `lp.test.ts` hands `solveInOrder` a recording fake, and `plan-domain` never imports a solver.',
        'Four tests pass: the room of the example, the deadline case (4 moves, finish 14 January, proven best), the pace case (5 moves), and asking again moves nothing.',
        'The queue never runs a job that a newer one replaced; HiGHS solves the workshop example and proves a warm start optimal.',
      ],
      quiz: [
        {
          question: 'Why does `solveInOrder` add `level ≤ best + 1e-6 · max(1, |best|)` instead of `level = best`?',
          options: [
            'To let the next level trade a little of this aim for more of its own',
            'Because HiGHS meets bounds within a tolerance, and an exact bound could make the next level infeasible',
            'Because the LP format has no equality rows',
            'To randomise ties',
          ],
          answer: 1,
          explanation:
            'The comment on `solveInOrder` says the slack keeps a bound the solver met within its own tolerance from making the next model infeasible. The LP format does have `=` rows; `lpText` writes them.',
        },
        {
          question: 'Towards a deadline, which aim comes right after "fewest sessions left out"?',
          options: [
            'The lightest heaviest week',
            'The fewest late sessions',
            'The closest to the rhythm',
            'The most sessions on their own day',
          ],
          answer: 1,
          explanation:
            'The deadline levels are `[unplaced, late, over, rhythm, Pw, Pd, stay, early]`. Being in time comes first; the budget is used only as far as it saves sessions from being late.',
        },
        {
          question: 'What keeps `highs` out of the browser bundle?',
          options: [
            '`plan-domain` imports it with a dynamic `import()`',
            'Only `plan-data` imports it, modules never import `plan-data`, the browser reaches it through a server function, and the server build keeps it external',
            'A service worker downloads `highs.wasm` on first use',
            'Tree shaking removes `solveLp` because the client never calls it',
          ],
          answer: 1,
          explanation:
            'The dependency rules forbid modules from importing `@lc/plan-data`; the dialog calls `rebalancePlan` over HTTP. `ssr.external` and `traceDeps` in `vite.config.ts` then make the server build ship the package with its `.wasm` file.',
        },
      ],
    },
    pitfalls: [
      'Big-M order rows: `t_i − t_{i+1} − D·u_{i+1} ≤ 0` (`7173882`) is short, but its relaxation was so weak that the solver could not place a real course within its time limit; `2a170c2` switched to running sums `Y_{i+1,d} ≤ Y_{i,d}`.',
      'Ranking the heaviest week above the rhythm: the week counts every calendar, so towards far deadlines it gave one session, a month without, then three a day. `c2d585c` put the rhythm first, as a target cost per session and day.',
      'Storing a partial result: an `events.move` with sessions left without room moves the rest around them and leaves those on top of whatever took their place. `rebalanceChange` returns null unless `unplaced === 0`, and the MCP tool uses it (`d87c5de`).',
      'Queueing every request on the server: the dialog asks again on each change, but the server solved every request in turn, adding seconds per click. `newestOnly()` drops a job still waiting when a newer one arrives (`78cb175`).',
      'Bundling a WebAssembly package: its loader looks for `highs.wasm` beside itself. External for Rollup alone (`8e70267`) was not enough; `d5a6fc2` added `ssr.external`, Nitro `traceDeps` and the dependency in `apps/web/package.json`.',
      'Reading a 0/1 variable as exactly 1: HiGHS meets integrality within a tolerance, so `solveLp` rounds binaries and integers (0.9999999 is the 1 it means) and `readDays` tests `> 0.5`.',
    ],
    tradeoffs: [
      'An exact solver makes "balanced" a provable claim with explicit priorities, at the price of a WebAssembly dependency, server-only availability and up to eight solves per round.',
      'Days in the program and times by rules keep the model at one variable per session and day; fragmented free time can then refuse what the day count allowed, which costs up to three rounds.',
      'Two seconds a level keeps the dialog responsive; a level stopped by the clock is valid but not proven best, and two asks can then differ.',
      'One solve at a time protects the server thread; older waiting requests are dropped, which suits a debounced dialog but would surprise a batch caller.',
    ],
    links: [
      { label: 'HiGHS documentation', href: 'https://ergo-code.github.io/HiGHS/dev/' },
      { label: 'HiGHS: terminology', href: 'https://ergo-code.github.io/HiGHS/dev/terminology/' },
      { label: 'HiGHS: option definitions', href: 'https://ergo-code.github.io/HiGHS/dev/options/definitions/' },
      { label: 'highs-js (the `highs` package)', href: 'https://lovasoa.github.io/highs-js/' },
      {
        label: 'IBM: LP file format',
        href: 'https://www.ibm.com/docs/en/icos/22.1.1?topic=cplex-lp-file-format-algebraic-representation',
      },
      { label: 'Vite: SSR options (`ssr.external`)', href: 'https://vite.dev/config/ssr-options' },
      { label: 'Nitro: build config (`traceDeps`)', href: 'https://nitro.build/config/build' },
      { label: 'MDN: WebAssembly', href: 'https://developer.mozilla.org/en-US/docs/WebAssembly' },
    ],
    next: 'Chapter 20 puts the re-balance behind a drag: a timeline page where every course is a lane and changes wait in a draft until Apply.',
  },
  {
    id: 'timeline',
    summary:
      'You build `/timeline`: every calendar is a lane, and a course can be moved by weeks, given a finish day that the re-balancer works out, or given a new deadline, by dragging, by keys or from a panel. Changes collect in a draft that is previewed against the plan, drawn as before and after on the same lanes, and stored only on Apply, which one Undo takes back.',
    whereWeAre:
      'Chapter 19 left a Reschedule dialog that moves or re-balances one calendar. The first timeline was a strip of thin lanes on the planner page (`5daf7e2`, `ec1c80c`, `358a9a0`): a drop that broke no rule was stored at once, and a drop that opened Reschedule had the dialog closed by its own click.',
    problem:
      'After trying the strip the owner wrote: "Looks like dragging and dropping doesn\'t work, not clear what would change, how it looks like, and how it will look like." Rows of 24 px over the whole plan leave about 7 px a day, so a day-precise drag is guesswork. The spec also rules out a page that needs a mouse.',
    outcomes: [
      'Turn plan data into lanes and a date scale with pure functions, and compare lanes before and after an update.',
      'Build a drag with Pointer Events and pointer capture that also works by long press on touch and by keys as an ARIA slider, with Escape to cancel.',
      'Collect edits in a draft, work each out on the plan the previous ones leave, preview them, and store them in one Apply.',
      'Guard a draft against leaving: `beforeunload` for the browser, `useBlocker` for in-app navigation.',
      "Scroll a wide chart with a plain mouse wheel without stealing the page's own wheel, and keep a sticky column working inside a horizontal scroller.",
    ],
    concepts: [
      {
        term: 'Pointer Events and pointer capture',
        explanation:
          "One event model for mouse, pen and touch: `pointerdown`, `pointermove`, `pointerup` and `pointercancel`, each with a `pointerId` and a `pointerType`. `setPointerCapture(id)` sends the rest of that pointer's events to the element even after the pointer leaves it, so a fast drag is not lost. `useNudge` keeps a single press, remembers the `pointerId` that made it, and ignores every other pointer.",
        link: {
          label: 'MDN: Element.setPointerCapture()',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture',
        },
      },
      {
        term: 'Drag threshold, long press and non-passive listeners',
        explanation:
          'A mouse press becomes a drag only after 4 px, so a click stays a click. A finger must rest 350 ms before it picks a lane up, so a swipe still scrolls the page. While it holds, a `touchmove` listener added with `{ passive: false }` calls `preventDefault()` to keep the page still; a passive listener cannot cancel scrolling, and browsers make document-level touch listeners passive by default.',
        link: {
          label: 'MDN: addEventListener (the passive option)',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener',
        },
      },
      {
        term: 'The click after a drop',
        explanation:
          'After `pointerup` the browser fires `click` on the element under the pointer. If the drop opens a dialog in the same task, that click lands outside the new dialog and light dismiss closes it at once. `useNudge` raises a flag for 50 ms that `afterDrop()` reports, so the click handler ignores that click, and calls `onCommit` in a `setTimeout`, after the gesture is over.',
        link: {
          label: 'MDN: click event',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event',
        },
      },
      {
        term: 'A drag as an ARIA slider',
        explanation:
          'WAI-ARIA has no drag-and-drop pattern, so a draggable handle is exposed as `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and the date in `aria-valuetext`. Arrows move a day, Page Up and Page Down a week, Home and End to the bounds. One deliberate difference from the APG slider: keys move an uncommitted ghost and Enter commits, because every commit is a change; Escape puts it back.',
        link: { label: 'WAI-ARIA APG: slider pattern', href: 'https://www.w3.org/WAI/ARIA/apg/patterns/slider/' },
      },
      {
        term: 'Draft, preview, apply',
        explanation:
          'The page keeps what was asked of each course (`move`, `finishBy`, `deadline`) and works it out into `PlanChange`s, each course on the plan the ones before it leave, then previews all of them with `previewUpdate`. Lanes are drawn from `preview.after` over the plan as it is. A counter in a ref tags each async run, so a solver answer to an older draft is dropped. Nothing is stored until Apply.',
      },
      {
        term: 'Wheel events and `deltaMode`',
        explanation:
          "A mouse wheel sends `deltaY`; Shift + wheel and a trackpad swipe send `deltaX`. `deltaMode` says whether a delta counts pixels, lines or pages. `wheelSideways` turns a vertical wheel into horizontal scrolling only when the days overflow and no box around the pointer can still scroll vertically. It is added with `addEventListener(…, { passive: false })`, because React's `onWheel` cannot stop the page from scrolling too.",
        link: {
          label: 'MDN: wheel event',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event',
        },
      },
      {
        term: 'Sticky inside a scroller, and stacking contexts',
        explanation:
          '`position: sticky` keeps an element in view only inside its containing block. The names column stuck while the grid was as wide as the view, then slid away once the days scrolled past it; the grid now takes the width of the days (`w-max`). The chart is also `isolate`, its own stacking context, so its sticky names cannot paint over the page header.',
        link: {
          label: 'MDN: position',
          href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position',
        },
      },
      {
        term: 'Blocking navigation',
        explanation:
          "`beforeunload` with `preventDefault()` makes the browser ask before a reload or a closed tab; it shows its own text. A move inside a single-page app never unloads the page, so the route also uses TanStack Router's `useBlocker` with a `shouldBlockFn` (only with a draft, only to another route) and `withResolver`, and renders `LeaveDraftDialog` with `proceed` and `reset`.",
        link: {
          label: 'TanStack Router: useBlocker',
          href: 'https://tanstack.com/router/latest/docs/api/router/useBlockerHook',
        },
      },
    ],
    decisions: [
      {
        question: 'When does a drag on the timeline change the plan?',
        options: [
          {
            name: 'Draft and review, stored on Apply',
            pros: [
              'Shows exactly what will change before it does',
              'Old and new on the same lanes',
              'One Apply, one Undo',
            ],
            cons: ['One more step than a direct edit'],
          },
          {
            name: 'Direct edit with Undo',
            pros: ['Fewest clicks', 'What the strip already did'],
            cons: ['The person learns what happened only afterwards, which is what they asked to fix'],
          },
          {
            name: 'Every drop opens the Reschedule dialog',
            pros: ['Reuses the dialog and its warnings'],
            cons: ['A modal per drag hides the timeline the person is looking at'],
          },
        ],
        chosen: 'Draft and review, stored on Apply',
        why: 'The spec compares the three and records the call: draft and review, because the person asked to see what will change before it does. The research went less far: stage what a solver computes, as Jira Plans and Reclaim do, and apply a single move at once with Undo. The spec stages every edit, and its anti-goals rule out a drag that stores anything before Apply.',
        evidence: 'evidenced',
        sources: [
          {
            kind: 'file',
            ref: 'docs/superpowers/specs/2026-11-23-timeline-page-design.md',
            note: 'Approaches; Calls made without the person',
          },
          {
            kind: 'file',
            ref: 'docs/timeline-preview-research.md',
            note: '§1 item 3; §4 Committing: at once with Undo, or staged with Apply',
          },
        ],
      },
      {
        question: 'Where does the timeline live?',
        options: [
          {
            name: 'A strip on the planner page',
            pros: ['Always in sight beside the calendar'],
            cons: ['Rows too thin to aim at a day', 'Two places to edit the same thing'],
          },
          {
            name: 'A page of its own at /timeline',
            pros: ['Lanes large enough to aim at a day', 'Room for zoom, a panel and a draft bar'],
            cons: ['One more section in the navigation'],
          },
        ],
        chosen: 'A page of its own at /timeline',
        why: 'The owner asked for the timeline "under separate route"; the spec removes the strip so that there is one place to edit, and `5487601` moved the lanes into a chart with its own page.',
        evidence: 'evidenced',
        sources: [
          {
            kind: 'file',
            ref: 'docs/superpowers/specs/2026-11-23-timeline-page-design.md',
            note: 'the request quoted at the top',
          },
          { kind: 'commit', ref: '5487601' },
          { kind: 'commit', ref: 'a80003f' },
        ],
      },
      {
        question: 'How does someone without a mouse make the same edits?',
        options: [
          {
            name: 'Drag only',
            pros: ['Least code'],
            cons: ['Fails WCAG 2.2 SC 2.5.7 Dragging Movements and keyboard access'],
          },
          {
            name: 'A popover per lane with fields',
            pros: ['A single-pointer path next to the lane'],
            cons: ['Another layer over the chart on every click'],
          },
          {
            name: 'Sliders on the handles and a course panel with the same edits',
            pros: [
              'Keys work on the very thing that is dragged',
              'The panel is the single-pointer path, without dragging',
            ],
            cons: ['A deliberate difference from the APG slider: Enter commits'],
          },
        ],
        chosen: 'Sliders on the handles and a course panel with the same edits',
        why: 'The earlier timeline research maps WCAG 2.5.7 and the APG slider to the handles; the page spec makes "every edit also without dragging" a goal and gives the selected course\'s panel the same three edits as fields.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/calendar-timeline-research.md', note: '§3.1, §3.4 The pattern, concretely' },
          { kind: 'file', ref: 'docs/superpowers/specs/2026-11-23-timeline-page-design.md', note: 'Goals' },
        ],
      },
      {
        question: 'What should a plain mouse wheel do over the zoomed timeline?',
        options: [
          {
            name: 'Leave it to the browser',
            pros: ['No surprises for the page scroll'],
            cons: ['Only Shift + wheel or a trackpad swipe reaches the days'],
          },
          {
            name: 'Always scroll the days sideways',
            pros: ['Simple'],
            cons: ['Traps the page: the wheel no longer scrolls it while over the chart'],
          },
          {
            name: 'Sideways only when nothing around can scroll vertically',
            pros: ['The page keeps its own wheel first', 'Days can also be grabbed and dragged'],
            cons: ['On a long page the wheel scrolls the page before the days'],
          },
        ],
        chosen: 'Sideways only when nothing around can scroll vertically',
        why: 'The commit: a zoomed timeline had only Shift + wheel or a trackpad swipe; now a plain wheel scrolls the days sideways once nothing around can scroll up or down, the page keeps its own wheel first, and empty days can be grabbed with the mouse.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '62a25c4' },
          {
            kind: 'file',
            ref: 'modules/planner/src/widgets/timeline-lanes/lib/scroll.ts',
            note: 'comment on `wheelSideways`',
          },
        ],
      },
    ],
    steps: [
      {
        title: 'Lanes as data',
        detail:
          "Keep geometry out of the domain and state facts. `calendarLanes` gives every shown calendar with something ahead its first and last day, its deadline, each session's state (done, open or missed) and where its open sessions start; it takes `now` as `number | null` so the server render, before the clock is known, misses nothing. `lanesRange` gives the days to draw: from the Monday a week before today (or of a past deadline still on a lane) to two weeks after the last session or deadline, at least four weeks.",
        files: [
          {
            path: 'packages/plan-domain/src/lanes.ts',
            lines: [7, 28],
            note: '`LaneSession` and `CalendarLane`: what one lane holds.',
          },
          {
            path: 'packages/plan-domain/src/lanes.ts',
            lines: [34, 69],
            note: '`calendarLanes`: a lane only for a calendar with an open session or a deadline ahead.',
          },
          {
            path: 'packages/plan-domain/src/lanes.ts',
            lines: [71, 89],
            note: '`lanesRange`: two weeks of room after the end, reaching back to a past deadline (`2e301f7`).',
          },
        ],
        commands: ['pnpm --filter @lc/plan-domain exec vitest run src/lanes.test.ts'],
        commit: 'e34fdc5',
      },
      {
        title: 'A scale from days to percent',
        detail:
          '`scaleOf` maps a moment to a percent of the track, so every mark is placed with `left: x%` and the chart resizes without measuring. `ticksOf` lists the first day of each month and each Monday for the axis. A drag converts pixels back to days with `days / trackWidth`, read from the `[data-track]` element at press time.',
        files: [
          {
            path: 'modules/planner/src/widgets/timeline-lanes/lib/scale.ts',
            lines: [3, 39],
            note: '`Scale`, `scaleOf`, `clampPct` and the month and Monday ticks.',
          },
        ],
        commit: '5daf7e2',
      },
      {
        title: 'Move a course, its end or its deadline: drag, long press, keys',
        detail:
          '`useNudge` is one hook for every movable thing. A mouse captures the pointer at once and drags after 4 px; a finger arms after a 350 ms long press, with a non-passive `touchmove` holding the page still. The offset snaps to days or to whole weeks (so each session keeps its weekday) and is only shown until it is committed on drop or with Enter; Escape puts it back, caught in the capture phase so a handler on the way down cannot keep a drag alive. A drop commits in a `setTimeout`, after the click it leaves behind. The handles are `role="slider"` elements wired to the same hook.',
        files: [
          {
            path: 'modules/planner/src/widgets/timeline-lanes/model/use-nudge.ts',
            lines: [48, 127],
            note: 'Press state, Escape in the capture phase, pointer capture for a mouse, the long press for a finger.',
          },
          {
            path: 'modules/planner/src/widgets/timeline-lanes/model/use-nudge.ts',
            lines: [143, 180],
            note: 'Commit after the gesture, and the keys: arrows, Page Up and Down, Home, End, Enter, Escape.',
          },
          {
            path: 'modules/planner/src/widgets/timeline-lanes/ui/LaneHandles.tsx',
            lines: [125, 166],
            note: '`FinishHandle`: a focusable slider with bounds, `aria-valuetext` and the pointer and key handlers.',
          },
          {
            path: 'modules/planner/src/widgets/timeline-lanes/model/editing.ts',
            lines: [1, 11],
            note: 'What the lanes ask of the host; without it they only show.',
          },
        ],
        commit: 'ec1c80c',
      },
      {
        title: 'Compare lanes before and after an update',
        detail:
          'Transparency starts in the domain. `movedSessions` reads which sessions an update gives another time from the `PlanDiff` that `previewUpdate` returns. `compareLanes` pairs each lane with its old self and keeps only those whose sessions, span or deadline differ, with day deltas for the start and the end. The page computes both sets of lanes from the plan and from `preview.after`.',
        files: [
          {
            path: 'packages/plan-domain/src/lanes.ts',
            lines: [112, 156],
            note: '`movedSessions`, `LaneChange` and `compareLanes`.',
          },
          {
            path: 'modules/planner/src/pages/timeline/ui/TimelinePage.tsx',
            lines: [78, 84],
            note: 'Lanes before and after the draft, moved sessions, the changes and one range for both.',
          },
        ],
        commit: '0fb5bfd',
      },
      {
        title: 'Research how schedulers show a change, then design the page',
        detail:
          'Before rebuilding, read how Gantt and scheduling products make a change visible: keep "now" on screen while showing "after", say the result in words next to the pointer, commit direct moves at once but stage what a solver computes. The page spec then fixes the route, the layout, the draft and the drag texts, and records the calls made without the owner.',
        files: [
          {
            path: 'docs/timeline-preview-research.md',
            lines: [10, 12],
            note: "The question, with the owner's complaint quoted.",
          },
          {
            path: 'docs/timeline-preview-research.md',
            lines: [21, 43],
            note: 'The recommended pattern, ranked, with the products that do each part.',
          },
          {
            path: 'docs/superpowers/specs/2026-11-23-timeline-page-design.md',
            lines: [9, 45],
            note: 'What went wrong with the strip, the intent, goals, anti-goals and the three approaches.',
          },
          {
            path: 'docs/calendar-timeline-research.md',
            lines: [302, 315],
            note: 'Roles, pointer, keyboard and non-drag alternative for each part of a lane.',
          },
        ],
        commit: 'c9be3c4',
      },
      {
        title: 'A zoomable chart that draws the change over the plan',
        detail:
          'The lanes become a chart with a sticky names column, an axis of months and Mondays, a legend, and three zooms: the whole plan, a month at 14 px a day, a week at 40 px a day, remembered per browser in `localStorage` with a guarded read. A changed lane draws the old span as a dashed line under the new bar, the old deadline faded, every moved session ringed, and a delta at its end. While a lane is dragged it fades to 40 % and a ghost shows where it would go.',
        files: [
          {
            path: 'modules/planner/src/widgets/timeline-lanes/model/use-zoom.ts',
            lines: [1, 33],
            note: 'Zoom levels, pixels a day, and a stored choice that survives blocked storage.',
          },
          {
            path: 'modules/planner/src/widgets/timeline-lanes/ui/LaneRow.tsx',
            lines: [57, 66],
            note: '`deltaOf`: the day count shown at the end, start or deadline a change moved.',
          },
          {
            path: 'modules/planner/src/widgets/timeline-lanes/ui/LaneRow.tsx',
            lines: [134, 175],
            note: 'The old span and deadline under the new bar, the fade while dragging, rings on moved sessions.',
          },
        ],
        commit: '5487601',
      },
      {
        title: 'The draft: work each course out on the plan before it',
        detail:
          "`useTimelineDraft` keeps one entry per course in the order courses were first touched; a move and a finish-by day exclude each other, as Reschedule's two modes do. `changesOf` turns an entry into changes: a deadline step, then `events.shift` by weeks, or a re-balance through the injected `rebalance` turned into a change by `rebalanceChange`, refused with a reason while a session finds no room. Each course is worked out on `previewUpdate(current, own).after`, and `ready` is true only when the shown result belongs to this plan and this draft, nothing failed and the preview has no problem. Apply passes all changes to `onChangeAll` in one go.",
        files: [
          {
            path: 'modules/planner/src/pages/timeline/model/use-timeline-draft.ts',
            lines: [52, 73],
            note: '`changesOf`: deadline step, shift or re-balance, and the refusal while sessions are unplaced.',
          },
          {
            path: 'modules/planner/src/pages/timeline/model/use-timeline-draft.ts',
            lines: [80, 139],
            note: 'Courses worked out in order on the plan the earlier ones leave, stale answers dropped, `ready`.',
          },
          {
            path: 'modules/planner/src/pages/timeline/ui/TimelinePage.tsx',
            lines: [139, 152],
            note: 'Apply: only when ready, all changes stored at once, then the draft is discarded.',
          },
        ],
        commit: 'c68d4a4',
      },
      {
        title: 'A route of its own, and asking before a draft is lost',
        detail:
          "The route loads the plan state, stores Apply with `savePlanChanges` (each change a step of the history), undoes with `travelPlanHistory`, and passes `rebalancePlan` as a module-level function so the draft is not worked out again on every render. The page adds a `beforeunload` listener while it has a draft and reports `dirty` to the host; the route's `useBlocker` holds a move to another route and shows `LeaveDraftDialog`. `laneMoveBounds` keeps drags and the panel's week buttons out of the past and within the 52 weeks one shift may take.",
        files: [
          {
            path: 'modules/planner/src/pages/timeline/ui/TimelinePage.tsx',
            lines: [98, 104],
            note: '`beforeunload` while a draft exists, and the dirty flag sent to the host.',
          },
          {
            path: 'apps/web/src/routes/timeline.tsx',
            lines: [19, 53],
            note: 'The stable `rebalance` callback and `useBlocker` that holds only a move to another route.',
          },
          {
            path: 'modules/planner/src/pages/timeline/ui/LeaveDraftDialog.tsx',
            lines: [10, 24],
            note: 'Stay or drop the draft and go; closing the dialog means stay.',
          },
          {
            path: 'packages/plan-domain/src/lanes.ts',
            lines: [98, 110],
            note: '`laneMoveBounds`: back no further than today, forward at most 364 days, in whole weeks.',
          },
        ],
        commit: '929286d',
      },
      {
        title: 'Scroll the way a mouse expects, and keep the names over the days',
        detail:
          '`wheelSideways` scrolls the days with a plain wheel only when they overflow and no box around the pointer can scroll vertically, converting line and page deltas to pixels; it is added natively with `passive: false`. `usePan` lets a mouse grab empty days and drag them, with pointer capture, as on a map. A new zoom keeps the day that was in the middle of the view, set in `useLayoutEffect` so the old offset is never painted. The grid takes the width of the days (`w-max`) so the sticky names stay for the whole scroll, and `isolate` keeps them under the page header.',
        files: [
          {
            path: 'modules/planner/src/widgets/timeline-lanes/lib/scroll.ts',
            lines: [1, 37],
            note: '`canScrollY`, `wheelSideways` and `daysInView`.',
          },
          {
            path: 'modules/planner/src/widgets/timeline-lanes/model/use-pan.ts',
            lines: [6, 40],
            note: 'Grab-to-pan for a mouse only, with pointer capture and no text selection.',
          },
          {
            path: 'modules/planner/src/widgets/timeline-lanes/ui/TimelineChart.tsx',
            lines: [89, 118],
            note: 'The native non-passive wheel listener and the zoom that keeps the middle day before paint.',
          },
          {
            path: 'modules/planner/src/widgets/timeline-lanes/ui/TimelineChart.tsx',
            lines: [145, 189],
            note: 'The `isolate` section, the focusable scroller and the grid as wide as the days.',
          },
        ],
        commit: '62a25c4',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm --filter @lc/plan-domain exec vitest run src/lanes.test.ts',
        'pnpm run stand:test',
        'pnpm run dev',
      ],
      expect: [
        'All lane tests pass: the range runs two weeks past the last session, unchanged lanes are left out of `compareLanes`, and `laneMoveBounds` stops at today and at 52 weeks.',
        'The `TimelineChart` and `TimelinePage` stories pass their interactions and the axe check, in the light and the dark theme.',
        "On `http://localhost:3000/timeline`, Tab to a course's end handle, press the right arrow three times and Enter: the tip names the finish day while it moves, the draft bar appears, and nothing is stored until Apply.",
      ],
      quiz: [
        {
          question: 'Why does `useNudge` call `onCommit` inside `setTimeout` after `pointerup`?',
          options: [
            'To debounce repeated drops',
            'So the click the browser sends after the drop arrives before a dialog the drop opens, instead of closing it by light dismiss',
            'Because React does not allow state updates in pointer handlers',
            'To wait for the server to confirm the move',
          ],
          answer: 1,
          explanation:
            "`065947b`: a drop opened Reschedule while the browser was still delivering the drag's click, which landed outside the new dialog and closed it. Acting after the gesture fixes that.",
        },
        {
          question: 'When does `wheelSideways` scroll the days sideways on a plain mouse wheel?',
          options: [
            'Always: the chart owns the wheel',
            'Only with Shift held',
            'When the days overflow and no box around the pointer, the page included, can still scroll vertically that way',
            'Only for trackpads',
          ],
          answer: 2,
          explanation:
            'It returns early for Ctrl or Shift, for a mostly horizontal delta, for days that fit, and when `canScrollY` finds a vertical scroller with room left: the page keeps its own wheel first.',
        },
        {
          question:
            'The draft holds two courses: A moved by two weeks, then B to be re-balanced to finish by a day. On which plan is B worked out?',
          options: [
            'The stored plan, ignoring A',
            "The plan A's shift leaves, `previewUpdate(current, own).after`",
            'The plan after Apply',
            'Each course separately, merged at Apply',
          ],
          answer: 1,
          explanation:
            'Courses are worked out in the order they were first touched, each on the plan the ones before it leave, so the preview equals what Apply will store. `929286d` added a story that proves it.',
        },
      ],
    },
    pitfalls: [
      'Acting on a drop in the same task as `pointerup`: the click that follows landed outside the dialog the drop had just opened and light dismiss closed it (`065947b`).',
      "Key handling on a handle that is being dragged: Escape was eaten by the handle's own handler, Enter committed a second time on the drop, and a second finger left a `touchmove` listener that blocked scrolling (`124b308`).",
      'A sticky column inside a grid only as wide as the view: at Month or Week the names slid away once the days scrolled past it. The grid now takes the width of the days (`fa9943a`).',
      'Sticky names painting over the sticky page header: the chart became its own stacking context with `isolate` (`7deddef`).',
      'Changing zoom while keeping the old pixel offset: the view landed on other dates. A zoom now keeps the middle day, and from the whole plan opens at today (`62a25c4`).',
      "A re-balance in the draft that left sessions without room dropped out unseen, and week buttons could move sessions into the past or past one shift's 52 weeks. The course now fails with the reason and Apply stays shut; `laneMoveBounds` holds both limits (`929286d`).",
    ],
    tradeoffs: [
      'Draft and Apply cost one step more than a direct edit; the spec accepts it because the owner asked to see what will change before it does.',
      'Every finish-by edit calls the server solver; slow or stale answers are dropped and Apply stays closed while one is pending.',
      'The draft lives only in the page: a reload or leaving drops it after the browser or the dialog asks. Saving drafts across reloads is a non-goal.',
      'The wheel turns sideways only when nothing can scroll vertically, so on a long page the first turns scroll the page, not the days.',
    ],
    links: [
      { label: 'MDN: Pointer events', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events' },
      {
        label: 'MDN: Element.setPointerCapture()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture',
      },
      { label: 'MDN: wheel event', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event' },
      {
        label: 'MDN: beforeunload event',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event',
      },
      { label: 'WAI-ARIA APG: slider pattern', href: 'https://www.w3.org/WAI/ARIA/apg/patterns/slider/' },
      {
        label: 'WCAG 2.2: Understanding 2.5.7 Dragging Movements',
        href: 'https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html',
      },
      {
        label: 'TanStack Router: useBlocker',
        href: 'https://tanstack.com/router/latest/docs/api/router/useBlockerHook',
      },
      {
        label: 'MDN: position (sticky)',
        href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position',
      },
    ],
    next: 'Chapter 21 turns to polish that is accessibility: motion, focus, input methods, tooltips and an icons-only mode across every page.',
  },
  {
    id: 'polish-accessibility',
    summary:
      'You make the app calmer and easier to operate. Motion respects `prefers-reduced-motion` without killing colour feedback, a focused control never hides under a sticky header, Enter belongs to an input method while it composes, help marks and one quick tooltip are built on the Popover API, Expand and Full screen are shared buttons with page keys, and an icons-only mode keeps every word as an accessible name. Axe checks every story in both themes.',
    whereWeAre:
      'By chapter 20 the planner, the focus page, the dashboard and the timeline exist, each under a sticky `PageHeader` (`ff68f93`) with keyboard shortcuts. The component stand of chapter 13 runs every story as a test with axe. What is left is behaviour, not features.',
    problem:
      "Several defaults hurt real people. A global reduced-motion rule switched off every transition, colour changes on hover included. A control reached with Tab while scrolled could sit under the sticky header; on a phone the focus page's start button stayed under a 104 px bar. Picking a Japanese or Chinese candidate with Enter saved a half-typed plan title. The browser's `title` tooltip takes a second and never shows for the keyboard, and toolbars full of words do not fit a phone.",
    outcomes: [
      'Opt each movement into `prefers-reduced-motion: no-preference` instead of switching off all transitions, and fade top-layer elements with `@starting-style` and `transition-behavior: allow-discrete`.',
      'Keep the focused control visible under sticky bars by publishing their height to `scroll-padding-top`.',
      "Ignore keys that belong to an IME composition, Safari's key code 229 included.",
      'Hold small browser-side preferences in `useSyncExternalStore` stores that survive blocked storage and follow other tabs.',
      'Build one tooltip for the page on the Popover API that shows on hover after a delay and at once on keyboard focus, and stays out of the accessibility tree.',
      'Apply a stored UI mode before the first paint with a head script, and run axe on every story in two themes.',
    ],
    concepts: [
      {
        term: '`prefers-reduced-motion`',
        explanation:
          "A media feature that reports the system setting to reduce motion. `reduce` asks to remove or replace motion, not every visual change. The rule since `af02738`: each movement is opted in where it is declared (`motion-safe:` in Tailwind, `@media (prefers-reduced-motion: no-preference)` in CSS), colour and shadow transitions stay, and an animation's final state is its static one.",
        link: {
          label: 'MDN: prefers-reduced-motion',
          href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion',
        },
      },
      {
        term: 'Transitions in and out of the top layer',
        explanation:
          'Dialogs and popovers live in the top layer, and their `display` flips to `none` the moment they close, so nothing can fade out. `transition-behavior: allow-discrete` with `display` and `overlay` in `transition-property` keeps them rendered until the fade ends, and `@starting-style` gives the values they fade in from. Browsers without these fade in and close at once.',
        link: {
          label: 'MDN: @starting-style',
          href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style',
        },
      },
      {
        term: 'Focus not obscured',
        explanation:
          'WCAG 2.2 SC 2.4.11 asks that a focused control is not entirely hidden by author content such as a sticky header. Browsers scroll a focused element into view, and `scroll-padding-top` on the scrolling element tells them to leave room at the top. `stickyTop` measures each sticky bar with a `ResizeObserver`, counts 0 for a bar that does not stick at this width, and publishes the largest as `--lc-sticky-top`.',
        link: {
          label: 'WCAG 2.2: Understanding 2.4.11 Focus Not Obscured',
          href: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html',
        },
      },
      {
        term: 'IME composition',
        explanation:
          'Chinese, Japanese and Korean input methods build text in steps, and Enter picks a candidate. While that happens `KeyboardEvent.isComposing` is true, and a handler must not submit or close anything. Safari can clear `isComposing` before that Enter arrives; its key code is then 229, so `composing()` checks both.',
        link: {
          label: 'MDN: KeyboardEvent.isComposing',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing',
        },
      },
      {
        term: '`useSyncExternalStore`',
        explanation:
          "React's hook for state that lives outside React: `subscribe(listener)`, `getSnapshot()` and `getServerSnapshot()`. The help mode reads `localStorage`, listens to the `storage` event for other tabs and keeps a module variable when storage is blocked; its server snapshot is `false`, so the server render and the first client render agree. `useFullscreen` uses the same hook over `fullscreenchange`.",
        link: {
          label: 'React: useSyncExternalStore',
          href: 'https://react.dev/reference/react/useSyncExternalStore',
        },
      },
      {
        term: 'The Popover API',
        explanation:
          '`popover="auto"` makes an element a top-layer popup with light dismiss (a click outside or Escape closes it), opened by a button\'s `popovertarget` without script. `popover="manual"` opens and closes only through `showPopover()` and `hidePopover()`. Help notes use `auto` with CSS anchor positioning; the one tooltip uses `manual` and is placed by script.',
        link: { label: 'MDN: Popover API', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Popover_API' },
      },
      {
        term: 'The Fullscreen API',
        explanation:
          "`element.requestFullscreen()` returns a promise and can be refused, for example when the browser does not count the press as the person's own or a frame is not allowed full screen. `document.fullscreenEnabled` says whether it can work at all, and `fullscreenchange` reports every change, including Escape pressed by the person.",
        link: { label: 'MDN: Fullscreen API', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API' },
      },
      {
        term: '`aria-pressed`, accessible names and an `aria-hidden` tooltip',
        explanation:
          'A toggle button states its state with `aria-pressed`, which the kit also styles through `aria-pressed:` variants. Its accessible name is its word, kept in the DOM as a visually hidden `.lc-label` in icons-only mode. The tooltip only repeats a name or a description the control already has, so it is `aria-hidden="true"`: a screen reader would read it twice otherwise.',
        link: {
          label: 'MDN: aria-pressed',
          href: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed',
        },
      },
    ],
    decisions: [
      {
        question: 'What should "reduce motion" switch off?',
        options: [
          {
            name: 'Every transition and animation on the page',
            pros: ['One rule, nothing to forget'],
            cons: ['Hover and press colour feedback disappears too', 'Fades that carry meaning vanish'],
          },
          {
            name: 'Each movement, opted in where it is declared',
            pros: ['Colour and shadow transitions stay', 'Every movement has a known static end state'],
            cons: ['Every new animation must remember `motion-safe:` or the media query'],
          },
          {
            name: 'An in-app motion setting',
            pros: ['Independent of the system'],
            cons: ['Ignores the preference the person already set in the system'],
          },
        ],
        chosen: 'Each movement, opted in where it is declared',
        why: 'The commit: a reduced-motion preference used to switch off every transition and animation, colour changes on hover included; now each movement is opted in where it is declared, colour and shadow transitions stay, and the dots that pulsed forever beat a few times and rest.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: 'af02738' },
          {
            kind: 'doc',
            ref: 'https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html',
            note: 'SC 2.3.3, cited in the timeline research',
          },
        ],
      },
      {
        question: 'How should tooltips work?',
        options: [
          {
            name: 'The native `title` attribute',
            pros: ['No code'],
            cons: ['About a second before it shows', 'Never shows for keyboard focus', 'Cannot be styled'],
          },
          {
            name: 'A tooltip component around each element',
            pros: ['Positioning per instance'],
            cons: ['A wrapper and listeners per control', 'Has to be lifted above dialogs one by one'],
          },
          {
            name: 'One top-layer popover for every `data-tip`',
            pros: [
              'One element and one set of document listeners',
              'Shows over dialogs',
              'Hover delay, instant on keyboard focus',
            ],
            cons: ['Placed by script on show; hidden on any scroll or resize'],
          },
        ],
        chosen: 'One top-layer popover for every `data-tip`',
        why: "The commit: the browser's tooltip takes a second and never shows for the keyboard; one tooltip in the top layer now serves every `data-tip`, 300 ms after the pointer rests, at once along a toolbar and on keyboard focus, and over dialogs.",
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '7d6990b' },
          { kind: 'file', ref: 'packages/ui/src/tooltip.ts', note: 'comment on `Tooltips`' },
        ],
      },
      {
        question: 'How does a stored icons-only mode apply without a flash of words?',
        options: [
          {
            name: 'Read the setting in an effect after hydration',
            pros: ['Pure React'],
            cons: ['Every page first paints with words, then jumps'],
          },
          {
            name: 'A head script that marks `<html>` before paint',
            pros: ['CSS hides the words from the first frame', 'Same pattern as the theme boot script'],
            cons: ['An inline script', '`<html>` needs `suppressHydrationWarning`'],
          },
          {
            name: 'A cookie read on the server',
            pros: ['Correct HTML from the server'],
            cons: ['A server round trip for a per-browser preference', 'Does not reach a static host'],
          },
        ],
        chosen: 'A head script that marks `<html>` before paint',
        why: 'The commit: the mode is kept in `localStorage` and set on `<html>` by a head script, so a page opens in the mode without a flash; the comment on `ICONS_ONLY_BOOT` says the marked `<html>` then needs `suppressHydrationWarning`.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '7351e1e' },
          { kind: 'file', ref: 'packages/ui/src/icons-only.tsx', note: 'comment on `ICONS_ONLY_BOOT`' },
        ],
      },
      {
        question: 'How do focused controls stay visible under sticky bars?',
        options: [
          {
            name: 'A fixed `scroll-padding-top` in CSS',
            pros: ['One line'],
            cons: ['Wrong when the bar changes height or stops sticking at a breakpoint'],
          },
          {
            name: 'Scroll each focused control into view in a focus handler',
            pros: ['Exact'],
            cons: ["A listener on every focus, fighting the browser's own scrolling"],
          },
          {
            name: 'Measure the sticky bars and publish their height to `scroll-padding-top`',
            pros: ['The browser does the scrolling', 'Follows breakpoints through `ResizeObserver`'],
            cons: ['A ref on every sticky bar'],
          },
        ],
        chosen: 'Measure the sticky bars and publish their height to `scroll-padding-top`',
        why: 'The commit: the bars now report their height while they stick, and the page pads its scrolling by it, so the browser scrolls the focused control into view below them. The comment in `sticky-top.ts` adds that a bar changes height, and whether it sticks, at breakpoints.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '98de33a' },
          { kind: 'file', ref: 'packages/ui/src/sticky-top.ts' },
        ],
      },
    ],
    steps: [
      {
        title: 'Check every story with axe, in both themes',
        detail:
          'Make the safety net first. `pnpm run stand:test` runs every story in headless Chromium with the Storybook Vitest addon and fails on an axe violation; `6495a57` runs the whole suite a second time with `VITE_STAND_THEME=dark`, because contrast differs by theme. The findings it cleared show the kind of fix to expect: done events and hidden chips toned down through their colours instead of `opacity`, so their text keeps its contrast, and correct heading levels.',
        files: [
          {
            path: 'apps/stand/package.json',
            lines: [11, 11],
            note: 'The test script: every story, then every story again in the dark theme.',
          },
          {
            path: 'apps/stand/.storybook/preview.tsx',
            lines: [58, 59],
            note: 'The initial theme read from `VITE_STAND_THEME`.',
          },
          {
            path: 'docs/component-stand.md',
            lines: [65, 72],
            note: 'What the run checks, and why no story is exempt from axe.',
          },
        ],
        commands: ['pnpm run stand:test'],
        commit: '6495a57',
      },
      {
        title: 'Help marks that explain the main features',
        detail:
          'A switch in every page header shows a "?" next to the main features; a mark opens a short note beside itself. The state lives outside React in a tiny store read with `useSyncExternalStore`: `localStorage` when available, a module variable when storage is blocked, the `storage` event for other tabs, and `false` on the server. The note is a `popover="auto"` element opened by `popoverTarget`, placed beside its mark with CSS anchor positioning inside an `@supports` check, so a browser without anchors keeps the popover in the middle of the window.',
        files: [
          {
            path: 'packages/ui/src/hint.tsx',
            lines: [4, 43],
            note: 'The store: read, subscribe, toggle, and `useHelpMode` over `useSyncExternalStore`.',
          },
          {
            path: 'packages/ui/src/hint.tsx',
            lines: [79, 119],
            note: '`Hint`: nothing until help mode is on, then a mark with `popoverTarget` and an anchored `role="note"` popover.',
          },
          {
            path: 'packages/ui/src/theme.css',
            lines: [251, 263],
            note: 'Anchor positioning with fallbacks, only where `position-area` is supported.',
          },
        ],
        commit: 'dd4d697',
      },
      {
        title: 'Let an input method finish the text',
        detail:
          'The plan title saved on Enter even while an input method was composing, so picking a candidate saved a half-typed name. The palette, the time zone finder and the source search checked `isComposing`, which Safari can clear before that Enter. All of them now share `composing(e)`, which also takes key code 229, and return before acting on Enter or Escape. The page shortcuts already skip composing keys.',
        files: [
          {
            path: 'modules/planner/src/shared/lib/composing.ts',
            lines: [1, 10],
            note: '`composing`: `isComposing` or key code 229, with the reason the deprecated code is used.',
          },
          {
            path: 'modules/planner/src/features/rename-plan/ui/PlanTitle.tsx',
            lines: [43, 49],
            note: 'The title field: page shortcuts stopped, composing keys ignored, then Enter saves and Escape cancels.',
          },
          {
            path: 'packages/ui/src/shortcuts.ts',
            lines: [19, 20],
            note: 'Page shortcuts ignore composing keys and Alt combinations.',
          },
        ],
        commit: '569ce61',
      },
      {
        title: 'Motion only where it is welcome',
        detail:
          'Delete the global rule that set `transition: none !important` and `animation: none !important` on every element under `reduce`. Opt each movement in where it is declared: `motion-safe:active:scale-[0.98]` on buttons, `motion-safe:hover:scale-110` on help marks, keyframes inside `@media (prefers-reduced-motion: no-preference)`. Write animations so their end state is the static style: the done check sits at `scale: 1` and the glow at `opacity: 0` without motion. `useJustDone` animates only events that turned done since the last render, not ones that arrive already done.',
        files: [
          {
            path: 'packages/ui/src/theme.css',
            lines: [129, 134],
            at: '569ce61',
            note: 'The global switch that `af02738` removed: it froze colour transitions too.',
          },
          {
            path: 'packages/ui/src/button.tsx',
            lines: [16, 31],
            note: 'Colour transitions always, the press scale only with `motion-safe:`.',
          },
          {
            path: 'packages/ui/src/theme.css',
            lines: [122, 176],
            note: 'The done check and glow: static end states, animations only without a reduce preference.',
          },
          {
            path: 'modules/planner/src/shared/lib/use-just-done.ts',
            lines: [6, 33],
            note: 'Only the change animates: keys that turned done since the previous render.',
          },
        ],
        commit: 'af02738',
      },
      {
        title: 'Fade dialogs, menus and notes in and out',
        detail:
          'One class, `lc-layer`, fades anything in the top layer over 150 ms and, unless less motion is asked for, grows it from 97 %; with reduced motion the fade is 100 ms and nothing scales. `@starting-style` gives the opening values, and `display` and `overlay` in a discrete transition keep the element rendered while it fades out. The backdrop fades with it.',
        files: [
          {
            path: 'packages/ui/src/theme.css',
            lines: [178, 217],
            note: '`.lc-layer`: opacity and scale, `allow-discrete`, `@starting-style` for open dialogs and popovers.',
          },
        ],
        commit: 'ad5f9e9',
      },
      {
        title: 'Keep a focused control out from under the sticky header',
        detail:
          '`PageHeader` sticks to the top on wide screens, and only its bar of sections sticks on narrow ones. Each sticky element gets `ref={stickyTop}`: a ref callback that observes the bar, stores its height (0 while it does not stick at this width), publishes the largest as `--lc-sticky-top` on `<html>`, and cleans up when the bar unmounts. The theme sets `scroll-padding-top` from that variable plus the safe-area inset, so Tab scrolls a control into view below the bar.',
        files: [
          {
            path: 'packages/ui/src/sticky-top.ts',
            lines: [1, 28],
            note: 'Heights of sticky bars, measured with `ResizeObserver` and published as a CSS variable.',
          },
          {
            path: 'packages/ui/src/page-header.tsx',
            lines: [16, 44],
            note: 'Both sticky parts of the header carry the `stickyTop` ref.',
          },
          {
            path: 'packages/ui/src/theme.css',
            lines: [61, 64],
            note: '`scroll-padding-top` from `--lc-sticky-top` and `env(safe-area-inset-top)`.',
          },
        ],
        commit: '98de33a',
      },
      {
        title: 'Expand, Full screen and page keys, shared by every page',
        detail:
          '`useFullscreen` reads `document.fullscreenElement` and `fullscreenEnabled` through `useSyncExternalStore` over `fullscreenchange`, and swallows a refused request. `ScreenButtons` renders Expand and Full screen as `aria-pressed` toggles and takes its labels as props, because the kit knows no language. `useShortcuts` binds E and Shift F; plain letters are ignored while the person types or a dialog is open. Stories cannot take the screen, so `fakeFullscreen` in `@lc/ui/testing` stands in for the API.',
        files: [
          {
            path: 'packages/ui/src/fullscreen.ts',
            lines: [1, 30],
            note: '`useFullscreen`: state from the browser, a toggle that tolerates refusal.',
          },
          {
            path: 'packages/ui/src/screen-buttons.tsx',
            lines: [28, 55],
            note: 'Two `aria-pressed` buttons; Expand hides while the screen is full.',
          },
          {
            path: 'packages/ui/src/shortcuts.ts',
            lines: [3, 36],
            note: 'Key names with `mod+` and `shift+`, and the rules that keep a letter from firing by surprise.',
          },
          {
            path: 'packages/ui/src/testing.ts',
            lines: [1, 40],
            note: '`fakeFullscreen`: a stand-in that counts calls and announces changes like the browser.',
          },
        ],
        commit: '8081744',
      },
      {
        title: 'One quick tooltip for the whole page',
        detail:
          '`Tooltips` is mounted once in the root document and installs one `popover="manual"` element with `aria-hidden="true"`. Document listeners find the nearest `[data-tip]` (or `[data-label]` in icons-only mode): pointer hover shows it after 300 ms, at once within 500 ms of the last one so a toolbar reads quickly, and touch never shows it. Keyboard focus shows it only for `:focus-visible`, in a zero timeout because a popover cannot open while a dialog moves focus. Escape, a press, a scroll or a resize hide it. It is shown anew each time so it lands above a dialog that opened since.',
        files: [
          {
            path: 'packages/ui/src/tooltip.ts',
            lines: [14, 20],
            note: 'One manual popover, `aria-hidden` because it repeats what the control already says.',
          },
          {
            path: 'packages/ui/src/tooltip.ts',
            lines: [48, 110],
            note: 'Show anew over dialogs, the hover delay and warm period, keyboard focus, Escape.',
          },
          {
            path: 'packages/ui/src/tooltip.ts',
            lines: [134, 143],
            note: '`Tooltips`: render once at the root.',
          },
          {
            path: 'apps/web/src/routes/__root.tsx',
            lines: [45, 60],
            note: 'The root document mounts `<Tooltips />` beside the app.',
          },
        ],
        commit: '7d6990b',
      },
      {
        title: 'Icons only, without a flash and without losing names',
        detail:
          "`Button` takes `icon` and `label`; the word goes in a `.lc-label` span, and with both the button marks itself `data-label`. Under `:root[data-icons='only']` the theme hides that word visually, the way a screen-reader-only class does, so it stays the accessible name, and the tooltip shows it above the hint. `ICONS_ONLY_BOOT` runs in the head and sets the attribute from `localStorage` before paint; `useIconsOnly` is a `useSyncExternalStore` store that also follows other tabs and fixes a host without the head script, such as the stand.",
        files: [
          {
            path: 'packages/ui/src/icons-only.tsx',
            lines: [5, 65],
            note: 'The boot script, the store over the `<html>` attribute, and the toggle.',
          },
          {
            path: 'packages/ui/src/button.tsx',
            lines: [16, 31],
            note: '`data-label` when the button has both an icon and a word.',
          },
          {
            path: 'packages/ui/src/theme.css',
            lines: [285, 303],
            note: 'The word hidden visually but kept for assistive technology; shortcut hints hidden with it.',
          },
          {
            path: 'apps/web/src/routes/__root.tsx',
            lines: [30, 48],
            note: 'Both boot scripts in the head, and `suppressHydrationWarning` on the `<html>` they mark.',
          },
        ],
        commit: '7351e1e',
      },
    ],
    checkpoint: {
      commands: ['pnpm run stand:test', 'git show af02738 -- packages/ui/src/theme.css', 'pnpm run dev'],
      expect: [
        'Every story passes twice, in the light theme and with `VITE_STAND_THEME=dark`; an axe violation fails the run.',
        'The diff removes the `@media (prefers-reduced-motion: reduce)` block that set `transition: none !important` and `animation: none !important` on every element.',
        'With reduced motion on in the system, marking a session done shows the check in place with no spring or glow while hover colours still change; Tab through a scrolled page and each focused control lands below the sticky header.',
      ],
      quiz: [
        {
          question: 'Why is the shared tooltip element `aria-hidden="true"`?',
          options: [
            'Screen readers cannot read popovers',
            'It repeats the accessible name or a description the control already has, so a screen reader would read it twice',
            'To keep axe from checking its contrast',
            'Because it is created outside React',
          ],
          answer: 1,
          explanation:
            'The comment in `tooltip.ts` says so. The name stays on the control (`aria-label`, or the hidden `.lc-label` word); the tooltip is a visual aid for sighted pointer and keyboard users.',
        },
        {
          question: 'Why does `composing()` also check key code 229?',
          options: [
            'Chrome sends 229 for every Enter',
            'Safari can clear `isComposing` before the Enter that picks a candidate, and that Enter has key code 229',
            'Key code 229 is Escape on Japanese keyboards',
            'React sets `isComposing` to false on synthetic events',
          ],
          answer: 1,
          explanation:
            '`569ce61`: the other inputs already checked `isComposing`, which Safari can clear first; 229 is the only sign left, so the deprecated `keyCode` is read on purpose.',
        },
        {
          question: 'Why does a head script set `data-icons="only"` on `<html>` instead of a React effect?',
          options: [
            'Effects cannot read `localStorage`',
            'So the stylesheet hides the words from the first paint; React then needs `suppressHydrationWarning` on `<html>`',
            'So the mode works without JavaScript',
            'Because Paraglide renders the labels on the server',
          ],
          answer: 1,
          explanation:
            'An effect runs after the first paint, so every page would flash its words. The head script runs before the body is drawn; the server HTML lacks the attribute, which is why `<html>` suppresses the hydration warning.',
        },
      ],
    },
    pitfalls: [
      'A global reduced-motion switch (`* { transition: none !important; animation: none !important }`) also removed hover and press colour feedback; `af02738` replaced it with motion opted in per declaration.',
      'Trusting `isComposing` alone: Safari can clear it before the Enter that picks a candidate, and a half-typed title was saved (`569ce61`).',
      "Sticky headers that hide focus: on a phone the focus page's start button stayed 10 px from the top, under a 104 px bar, until the bars published their height to `scroll-padding-top` (`98de33a`).",
      'Toning down elements with `opacity`: the text inside lost contrast and axe flagged it; done events and hidden chips now use colours (`6495a57`).',
      '`showPopover()` throws while another popover is being shown or hidden, for example while a dialog moves focus as it opens. The tooltip shows on focus in a zero timeout and catches the refusal (`tooltip.ts`).',
      'A head script that changes `<html>` before React hydrates makes the server and client attributes differ; the root document sets `suppressHydrationWarning` on `<html>` (`7351e1e`).',
    ],
    tradeoffs: [
      'One document-level tooltip means one element that shows over dialogs, but it is placed by script when shown and hides on any scroll, rather than following its control.',
      'Help mode is off by default: the interface stays clean for the owner, and a newcomer has to find the "?" switch first.',
      'Icons-only mode fits toolbars on a phone, but its words move into tooltips, which never show for touch.',
      'Fading out relies on `overlay` and `display` transitions: supporting browsers fade out, others close at once, and no JavaScript animation library is added.',
    ],
    links: [
      {
        label: 'MDN: prefers-reduced-motion',
        href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion',
      },
      {
        label: 'MDN: @starting-style',
        href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style',
      },
      {
        label: 'WCAG 2.2: Understanding 2.4.11 Focus Not Obscured',
        href: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html',
      },
      {
        label: 'MDN: KeyboardEvent.isComposing',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing',
      },
      { label: 'React: useSyncExternalStore', href: 'https://react.dev/reference/react/useSyncExternalStore' },
      { label: 'MDN: Popover API', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Popover_API' },
      { label: 'MDN: Fullscreen API', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API' },
      {
        label: 'Storybook: accessibility tests',
        href: 'https://storybook.js.org/docs/writing-tests/accessibility-testing',
      },
    ],
    next: 'Chapter 22 takes the planner off `localhost`: where it can run, what a read-only host leaves out, and how the server-only parts ship.',
  },
] satisfies readonly Syllabus[]
