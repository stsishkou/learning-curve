# Calendar integration research: Google, Microsoft, Apple and the rest

Fetched 2026-11-22, 21:55–22:30 UTC (2026-11-23 in Europe/Minsk). Only first-party pages were used: provider
documentation and help centres, RFCs, IANA and W3C, vendors' own pricing pages, and the cal.com source. Every
claim is followed by the page it was read from.

Legend: **(d)** = documented on the linked first-party page; **(f)** = de facto: it works in practice and
third parties rely on it, but no first-party page describing it was found; **(k)** = my general knowledge,
not re-verified here. Treat every (f) and (k) as a lead to test, not a fact. Section 10 lists them all.

## 1. Short answer

- **Should the app integrate with the big providers?** Yes, but through the open standard first, not through
  their APIs. One iCalendar feed per calendar, reachable by URL, is accepted by Google Calendar, Outlook and
  Apple Calendar alike, needs no account linking, and already exists here as `/api/ics/:calendarId`.
- **Is being logged in required?** No, not for one-way delivery. A login (OAuth) is needed only when the app
  must _write into_ the user's calendar through an API or _read_ their events. The three no-login mechanisms
  are: a subscription URL (updates propagate, read-only), an `.ics` file (snapshot), and a pre-filled "add
  event" link (one event).
- **Can the user just pick a provider when pressing "Export to calendar"?** Yes, and that is the right first
  step. The provider choice changes only the _hand-off_ (which link is opened, which instructions are shown),
  not the data. A sketch is in section 9.
- **What is the industry-standard logged-in route?** OAuth 2.0 authorization-code flow with PKCE against the
  Google Calendar API and Microsoft Graph, plus CalDAV with an app-specific password for iCloud. There is no
  single API for all three; products either write one adapter per provider (cal.com) or rent a unified API
  (Nylas, Cronofy). For a single-user study plan neither pays off yet.
- **What to build, in order:** (1) a provider step in the export dialog plus iCalendar hygiene fixes; (2) a
  tokenized subscription feed with one-click subscribe links and a QR code once the app is deployed;
  (3) a read-only "busy" overlay fed by the user's own secret iCal address, still without OAuth;
  (4) OAuth one-way push into an app-created calendar only if hours-long refresh lag becomes a real problem.
  Two-way sync is not recommended.

One thing to settle before any public deployment: the app has no login, so today's `/api/ics/*` and
`/api/plan` would be readable by anyone who finds the URL, and any stored OAuth token would be usable by any
visitor. A tokenized feed URL fixes the first; the second means **OAuth sync on a public URL requires an app
login first**.

## 2. What the app has today, and what the research found in it

| Piece                                             | State                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/plan-domain/src/ics.ts`                 | RFC 5545 writer: stable `UID`, `VTIMEZONE` for Europe/Minsk, `RRULE`/`EXDATE`, `TRANSP`, `X-WR-CALNAME` |
| `modules/calendar-export` dialog                  | Downloads a zip, one `.ics` per calendar, or one combined `.ics`; shows Google and Outlook import steps |
| `GET /api/ics/:calendarId`, `/api/ics/all`        | `text/calendar`, `Cache-Control: no-store`, no token; subscribable once public                          |
| `GET /api/ics-zip`                                | All calendars in a zip                                                                                 |

Findings against the specs:

1. **`METHOD:PUBLISH` without `ORGANIZER`.** iTIP says of a published event: 'The "Organizer" MUST be present
   in a published iCalendar component. "Attendees" MUST NOT be present.' ([RFC 5546 §3.2.1][rfc5546]). The
   writer emits `METHOD:PUBLISH` and no `ORGANIZER`. RFC 5545 allows leaving `METHOD` out, in which case the
   object "is merely being used to transport a snapshot of some calendar information" ([RFC 5545
   §3.7.2][rfc5545]). Either drop `METHOD` or add an `ORGANIZER`; test both in Google and Outlook before
   changing, because how each importer reacts is not documented (section 10).
2. **No `SEQUENCE` and no `LAST-MODIFIED`.** `SEQUENCE` is "monotonically incremented by the 'Organizer's' CUA
   each time the 'Organizer' makes a significant revision" ([RFC 5545 §3.8.7.4][rfc5545]). Events are moved
   in the app, so a per-event revision counter (or at least `LAST-MODIFIED`) is the standard signal that a
   re-import or refresh carries a newer version.
3. **`UID` uniqueness.** "The 'UID' itself MUST be a globally unique identifier" ([RFC 5545
   §3.8.4.7][rfc5545]). The UIDs are stable and carry an `@learning-curve` suffix (`schedule.ts`), which is
   what updates need. No change required.
4. **Done state is not exported.** Every event is `STATUS:CONFIRMED`. See section 6 for the options.
5. **No calendar metadata beyond `X-WR-CALNAME`.** RFC 7986 standardises `NAME`, `COLOR`, `REFRESH-INTERVAL`
   and `SOURCE` (section 3.4).
6. **The README's "Google refreshes them every few hours"** is not documented by Google on the page that
   describes adding a calendar by URL (section 3.2).

## 3. Without a login

### 3.1 "Add to calendar" links (one pre-filled event)

| Provider             | Link                                                                                         | Status | Parameters and limits                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Calendar      | `https://calendar.google.com/calendar/r/eventedit?action=TEMPLATE&dates=…&stz=…&etz=…&text=…` | (d)    | `dates` start/end in ISO 8601 basic format, `stz`/`etz` IANA zone names, `details`, `location`, `text`, all URL-encoded. One event per link. No recurrence parameter is documented |
| Google, older form   | `https://calendar.google.com/calendar/render?action=TEMPLATE…` with `ctz`, `recur`, `add`    | (f)    | Not on Google's page; described only by third parties                                                                                                                              |
| Outlook.com          | `https://outlook.live.com/calendar/0/deeplink/compose?rru=addevent&startdt=…&enddt=…&subject=…` | (f)    | No Microsoft documentation found; forum threads report the path changing (`deeplink` → `action`) and `+` offsets being mangled                                                     |
| Microsoft 365        | Same on `outlook.office.com`                                                                 | (f)    | Same                                                                                                                                                                               |
| Yahoo Calendar       | `https://calendar.yahoo.com/?v=60&title=…&st=…&et=…`                                         | (f)    | No first-party page located                                                                                                                                                        |
| Apple Calendar       | none                                                                                         | n/a    | Apple has no web compose link; the equivalent is opening an `.ics` file or a `webcal://` URL                                                                                       |

Google is the only one that documents its link, and frames it exactly as a one-off: "you can provide a link
with a pre-filled event for the user to add themselves. This method creates a distinct event on the user's
calendar, which you can't update unless you have access to the user's calendar" ([Google, inviting
attendees][g-invite]). The search for a Microsoft reference returned only community threads
([example][ms-deeplink-thread]).

**Verdict for this app:** useless for exporting a plan of dozens of sessions (one link, one event, no
updates), useful as a small "add this one session" action on a single event. Use the documented Google form;
treat the Outlook and Yahoo links as best-effort.

### 3.2 Subscribing by URL (the feed)

| Client                  | How the user subscribes                                                                      | Refresh the provider documents                                                                                              | Notes                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Google Calendar         | Other calendars → **From URL** → paste the address (d)                                       | **Not stated** on the page                                                                                                  | Computer browser only: "You can't subscribe to a calendar in the Google Calendar app for Android, iPhone, or iPad" (d)        |
| Outlook.com             | Add calendar → **Subscribe from web** (d)                                                    | "updates should happen approximately every 3 hours", "can take more than 24 hours" (d)                                      | The Outlook-on-the-web variant of the same article says about 6 hours (read through a summarising fetch, not re-checked)      |
| Apple Calendar, Mac     | File → **New Calendar Subscription**, or just click a calendar link (d)                      | User-chosen: "Click the Auto-refresh pop-up menu, then choose how often to update the calendar" (d)                         | Choosing iCloud as the location makes the subscription appear on all the user's devices (d)                                   |
| Apple Calendar, iPhone  | Add Calendar → **Add Subscription Calendar** → URL of the `.ics` (d)                         | Not stated                                                                                                                  | "Subscribe to an external, read-only calendar" (d)                                                                            |

Sources: [Google, add a calendar by URL][g-url], [Outlook import or subscribe][ms-subscribe], [Apple Calendar
on Mac, subscribe][a-sub], [Apple, refresh calendars][a-refresh], [iPhone, set up calendars][a-iphone].

- **Read-only everywhere.** Apple: "You can't edit calendars you are subscribed to" ([Apple][a-sub]); Outlook:
  "HTML and ICS calendars are read-only" ([Outlook, share your calendar][ms-publish]); Google describes giving
  an application a calendar address as "read-only access, meaning you can't edit or create events"
  ([Google, sync with other applications][g-secret]).
- **`webcal://`** is a provisionally registered URI scheme whose semantics are "Subscribing to calendars in
  iCalendar format", with "HTTP as a transport protocol is assumed" ([IANA registration][iana-webcal]). It is
  a hint to the operating system to open the calendar app in subscribe mode; the bytes are fetched over
  HTTP(S). On a Mac, "To subscribe to a calendar from a link on the internet … click the link" ([Apple][a-sub]).
- **One-click subscribe links** for web clients are de facto: `https://calendar.google.com/calendar/r?cid=<url>`
  for Google and `https://outlook.live.com/calendar/0/addfromweb?url=<url>&name=<name>` for Outlook (f, k). No
  first-party page describing either was found. Always show the plain URL with a copy button next to them.
- **A public URL is required** for Google and Outlook: their servers fetch the feed, so `localhost` cannot
  work. Apple Calendar on the same Mac fetches the URL itself, so a local address works there (k).
- **Privacy of an unguessable URL is the industry precedent.** Google gives every calendar a "Secret address
  in iCal format": "Only you should know the secret address for your calendar. Do not share the secret address
  with others. If you accidentally share your calendar's secret address, click Reset to create a new address"
  ([Google][g-secret]). Outlook publishes a calendar as an ICS link that anyone holding it can subscribe to,
  with an "Unpublish" control ([Outlook][ms-publish]). The same model fits here: a long random token in the
  path, a "reset link" action, HTTPS only.

**Verdict:** this is the main integration. It is the only no-login mechanism where moves and deletions made
in the app reach the user's calendar, and it covers all three providers with one endpoint.

### 3.3 File import

| Provider        | What the vendor documents                                                                                                                                        | Re-import (same `UID`)                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Google Calendar | Settings → Import & export, on a computer; "By default, events are imported into your primary calendar"; "Imported events don't stay in sync" ([Google][g-import]) | Not documented                        |
| Outlook.com     | Add calendar → Upload from file; "you get a snapshot of the events in the calendar at the time of import"; the calendar "doesn't refresh the imported events" ([Outlook][ms-subscribe]) | Not documented                        |
| Apple Calendar  | Opening an `.ics` file offers to add its events (k)                                                                                                              | Not documented in the pages read      |

How each importer treats `UID`, `SEQUENCE` and `METHOD` on a second import (update, skip or duplicate) is
**not documented by any of the three**. The README's advice to delete old events first is the safe reading.
The standard's answer is that a subscription, not a repeated import, is the update channel: RFC 5546 lets the
publisher "subsequently update (with another 'PUBLISH' method)" the same component ([RFC 5546 §3.2.1][rfc5546]),
and RFC 7986 adds the properties for polling (below).

### 3.4 iCalendar properties worth emitting

| Property                      | Defined in                                              | What it does                                                                                             | Honoured by providers? |
| ----------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| `NAME`                        | [RFC 7986 §5.1][rfc7986]                                | "specifies the name of the calendar"                                                                     | Not documented         |
| `X-WR-CALNAME`                | no specification found (f)                              | Older, widely used calendar name; already emitted                                                        | Not documented         |
| `COLOR`                       | [RFC 7986 §5.9][rfc7986]                                | "a color used for displaying the calendar, event, todo, or journal data"; a CSS3 colour name             | Not documented         |
| `REFRESH-INTERVAL`            | [RFC 7986 §5.7][rfc7986]                                | "a suggested minimum interval for polling for changes", e.g. `REFRESH-INTERVAL;VALUE=DURATION:PT1H`      | Not documented         |
| `X-PUBLISHED-TTL`             | [MS-OXCICAL §2.1.3.1.1.15][ms-oxcical-ttl]              | Microsoft's interval property for an automatically republished calendar                                  | Not documented         |
| `SOURCE`                      | [RFC 7986 §5.8][rfc7986]                                | "a URI where calendar data can be refreshed from": lets an imported file point back at the feed          | Not documented         |
| `SEQUENCE`, `LAST-MODIFIED`   | [RFC 5545 §3.8.7.4, §3.8.7.3][rfc5545]                  | Revision number and change time of each event                                                            | Not documented         |
| `URL`, `CATEGORIES`           | [RFC 5545][rfc5545], [RFC 7986 §5.5–5.6][rfc7986]       | Link to the module; course name as a category                                                            | Not documented         |

All of these are cheap and harmless (unknown properties are ignored by conformant parsers), but none of the
three vendors states that it reads `REFRESH-INTERVAL` or `X-PUBLISHED-TTL`, and the refresh intervals in 3.2
are stated without reference to them. Emit them, do not rely on them.

### 3.5 Web Share and phones

- `navigator.share({ files })` exists in the [Web Share specification][w3c-share] and needs a user gesture
  ("transient activation").
- Whether an `.ics` file can be shared is implementation-defined. MDN's list of "usually shareable file types"
  contains no `text/calendar` or `.ics` entry and says "you should always test with `navigator.canShare()`"
  ([MDN][mdn-share]). So a "Send to my phone's calendar" button must be feature-detected and can never be the
  only path.
- The dependable phone path is a plain link to the feed or file served as `text/calendar`, which the route
  already does: the operating system hands it to the calendar app (f). On iPhone the documented path is
  subscribing by URL ([Apple][a-iphone]), which is also why a QR code of the feed URL is worth having.

## 4. With a login

### 4.1 Google Calendar API

| Topic                 | What Google documents                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Narrowest write scope | `calendar.app.created`: "Make secondary Google calendars, and see, create, change, and delete events on them" ([scopes][g-auth]). It is accepted by `calendars.insert` ([ref][g-cal-insert]) and `events.import` ([ref][g-import-api]). The app never sees the user's other events                                |
| Other scopes          | `calendar.events` ("View and edit events on all your calendars"), `calendar.events.owned`, `calendar.freebusy` ("View your availability in your calendars"), `calendar.calendarlist.readonly`, full `calendar` ([scopes][g-auth])                                                                               |
| Sensitive/restricted  | The scope list does not label Calendar scopes. Google says sensitive scopes "have a sensitive indicator on the Google Cloud Console's OAuth consent screen configuration page" ([all scopes][g-scopes]). Restricted scopes additionally need an "annual security assessment" ([Google][g-verif-req]). **Per-scope class not verified** |
| Verification          | Not needed for personal use ("If you are the only user of your app"), for fewer than 100 users, for development/testing, or for internal Workspace apps ([Google][g-verif-exempt])                                                                                                                             |
| Testing mode          | "limited to up to 100 test users"; "Authorizations by a test user will expire seven days from the time of consent" ([Google][g-audience]). Refresh tokens of an external app in "Testing" expire after 7 days ([Google][g-oauth])                                                                              |
| Refresh tokens        | Also die when unused for six months, when revoked, or beyond "100 refresh tokens per Google Account per OAuth 2.0 client ID" ([Google][g-oauth])                                                                                                                                                               |
| Incremental sync      | Full `events.list`, store `nextSyncToken`, then pass `syncToken`; deleted entries are always included; on `410` "a full wipe of the client's store and a new full sync" ([sync guide][g-sync])                                                                                                                 |
| Push                  | `watch` channels on Acl, CalendarList, Events, Settings; HTTPS endpoint with a valid certificate; no body, only `X-Goog-*` headers; channels expire and are not renewed automatically; "Notifications are not 100% reliable" ([push guide][g-push])                                                             |
| Quotas                | 10,000 requests per minute per project and 600 per minute per user; use exponential backoff and randomise sync times; the page announces charges above quota later in 2026 ([quota guide][g-quota])                                                                                                            |
| Identity of an event  | `events.import` "is used to add a private copy of an existing event to a calendar" and requires `iCalUID` ([ref][g-import-api]); alternatively `events.insert` accepts a client-chosen `id` of 5–1024 base32hex characters (`a`–`v`, `0`–`9`) ([event resource][g-events])                                       |
| Mapping data          | Private extended properties: key up to 44 characters, value up to 1024, queryable with `privateExtendedProperty=name=value` ([guide][g-extprops])                                                                                                                                                              |
| Free/busy             | `freebusy.query` returns only busy ranges per calendar and accepts `calendar.freebusy` or `calendar.events.freebusy` ([ref][g-freebusy])                                                                                                                                                                       |

What `events.import` does when the `iCalUID` already exists is not stated on its reference page. Google's
own guidance for keeping copies in step is to "Use the same event ID (`iCalUID`)" for every copy
([Google][g-invite]).

### 4.2 Microsoft Graph

| Topic              | What Microsoft documents                                                                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission         | Delegated `Calendars.ReadWrite`: "create, read, update, and delete events in user calendars"; no admin consent; available to personal Microsoft accounts. `Calendars.ReadBasic` reads events without body, attachments and extensions ([permissions][ms-perm])               |
| Account types      | App registration `signInAudience`: `AzureADMyOrg`, `AzureADMultipleOrgs`, `AzureADandPersonalMicrosoftAccount`, `PersonalMicrosoftAccount` ([Microsoft][ms-audience]). Work tenants may block user consent to third-party apps (k)                                            |
| Incremental sync   | `GET /me/calendarView/delta?startDateTime=…&endDateTime=…`, follow `@odata.nextLink`, keep `@odata.deltaLink`; deletions arrive as `"@removed": {"reason": "deleted"}`. Delta without a date range is beta-only ([delta guide][ms-delta])                                     |
| Push               | Subscriptions on `event` last at most 10,080 minutes (under seven days) and must be renewed ([subscription][ms-sub]); the endpoint must be "publicly accessible, HTTPS-secured" and answer a validation-token handshake ([webhooks][ms-webhook])                              |
| Identity           | `iCalUId` is **read-only** on Graph events, so the app's UID cannot be imposed. `transactionId` is a client identifier "to avoid redundant POST operations in case of client retries" ([event][ms-event], [create event][ms-post-event])                                       |
| Mapping data       | `singleValueExtendedProperties` and open extensions on events, with `Calendars.ReadWrite` for work and personal accounts ([event][ms-event], [extended properties][ms-extprop])                                                                                               |
| Time zones         | `start`/`end` are `dateTimeTimeZone`, so Minsk wall-clock times can be sent as such ([create event][ms-post-event])                                                                                                                                                           |
| Free/busy          | `getSchedule` and `findMeetingTimes` are both "Not supported" for personal Microsoft accounts ([getSchedule][ms-getschedule], [findMeetingTimes][ms-fmt]); with a personal account, read `calendarView` instead                                                               |
| Auth flow          | Authorization code with PKCE "recommended for all application types … and required … for single page apps"; SPA refresh tokens last 24 hours; server-side web apps hold a client secret ([auth code flow][ms-authcode])                                                       |

### 4.3 Apple

- **No OAuth and no web API for iCloud Calendar were found in Apple's developer documentation.** What Apple
  documents is the app-specific password: it lets you "sign in to your Apple Account in apps made by developers
  other than Apple", requires two-factor authentication, is limited to 25 active passwords, and all of them are
  revoked when the main password changes ([Apple][a-asp]). The same page mentions that some supported apps can
  be authorised through the Apple Account instead; no developer-facing description of that was found.
- **CalDAV is the protocol those passwords are used with**, against `https://caldav.icloud.com` (f). Apple does
  not publish that endpoint in the pages read; cal.com's Apple Calendar connector hard-codes it and stores the
  username and app-specific password encrypted ([source][cal-apple-svc], [source][cal-apple-add]).
- **EventKit** "provides access to calendar and reminders data" for apps on Apple platforms
  ([Apple][a-eventkit]). It is a native framework; a web app cannot call it.

So for Apple the realistic choices are a subscription (section 3.2, fully documented) or CalDAV with a
password the user generates by hand.

### 4.4 CalDAV as the provider-neutral protocol

CalDAV "defines extensions to … WebDAV … to specify a standard way of accessing, managing, and sharing
calendaring and scheduling information based on the iCalendar format" ([RFC 4791][rfc4791]); RFC 6578 adds
"efficient synchronization of the contents of a WebDAV collection" ([RFC 6578][rfc6578]).

| Provider           | CalDAV                                                                                                                                                                                                             | Auth                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Google             | Yes: `https://apidata.googleusercontent.com/caldav/v2/{calendarId}/events`. Implements RFC 4791 and RFC 6578 (clients must switch to sync-collection after the first sync). No `MKCALENDAR`, no `VTODO` ([Google][g-caldav]) | OAuth 2.0 only; Basic auth gets `401`  |
| iCloud             | Yes (f)                                                                                                                                                                                                            | App-specific password                  |
| Fastmail           | "two-way sync of your calendar via the standard CalDAV protocol"; not on Basic plans ([Fastmail][fm])                                                                                                              | App password                           |
| Nextcloud          | Yes, under `/remote.php/dav/` ([Nextcloud][nc])                                                                                                                                                                    | App login and password                 |
| Microsoft 365      | No CalDAV endpoint appears in Microsoft's documentation; Graph is the API (k). Absence cannot be proven from a page                                                                                                | n/a                                    |

CalDAV gives one code path for Apple, Fastmail, Nextcloud and (with OAuth) Google, but not Microsoft, and
Google's variant cannot create calendars. It is a complement to Graph, not a replacement for both big APIs.

### 4.5 OAuth for a local, single-user app

- **Flow.** Authorization code with PKCE. "Public clients MUST use PKCE"; for confidential clients it is
  recommended; the implicit grant is singled out as vulnerable to token leakage ([RFC 9700 §2.1][rfc9700]).
- **This app is a confidential client.** It has a server (Nitro), so the client secret and refresh token can
  stay on the server and the browser never sees a token. Google's server-side guide: store tokens "in a secure,
  long-lived location" ([Google][g-webserver]). Here that means an untracked file beside `data/history.json`
  with owner-only permissions, or the OS keychain; never `localStorage`, never the repository.
- **Redirect URI on localhost.** Google: "Redirect URIs must use the HTTPS scheme, not plain HTTP", localhost
  excepted ([Google][g-webserver]). Microsoft: `http://localhost` is allowed, the port is ignored when matching,
  `127.0.0.1` is preferred, and query parameters are not allowed for personal-account apps ([Microsoft][ms-redirect]).
  Both follow [RFC 8252 §7.3 and §8.3][rfc8252]: loopback redirects use `http` because "the HTTP request never
  leaves the device".
- **Staying out of verification.** A Google project used only by its owner needs no verification
  ([Google][g-verif-exempt]). Leave it in "Testing" and the refresh token expires every 7 days
  ([Google][g-oauth]); publish it unverified and the 7-day rule no longer applies, at the cost of the
  unverified-app screen and the 100-user cap ([Google][g-verif-exempt]).
- **Browser-only alternative.** Google Identity Services' token model is "based upon the OAuth 2.0 implicit
  grant flow", needs "no … per-user refresh tokens on your backend server", and gets a new short-lived token
  only from "a user gesture" ([Google][g-gis]). No secret to store, but no background sync either.

## 5. The "common integration" route

### 5.1 Unified calendar APIs

| Vendor  | What it offers                                                                                       | Price on its own page (read 2026-11-22)                                                                 | Notes                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Nylas   | One API over Google, Microsoft, iCloud, IMAP, Exchange (EWS), Yahoo ([providers][nylas-prov])        | Free: $0 with 5 connected accounts; Essentials $15/month; Pro $49/month ([pricing][nylas-price])        | Its guides still include "Creating a Google auth app" and verification   |
| Cronofy | Two-way calendar sync, availability API                                                              | "Emerging" plan $819 per month billed annually, up to 500 synced accounts; "Try for free" ([pricing][cronofy]) | Provider list not verified (docs page returned 404)                      |
| Unipile | Google Calendar and Outlook Calendar among messaging channels                                        | €49/month for up to 10 linked accounts; 7-day trial ([pricing][unipile])                                | No Apple calendar listed on the pricing page                             |
| Aurinko | Unified calendar/email API                                                                           | "starting at $1 / account / month" ([pricing][aurinko])                                                 | Free-tier size and provider list not stated on the page                  |
| Merge   | HRIS, ATS, CRM, Accounting, Ticketing, File Storage, Knowledge Base, Chat ([docs][merge])            | n/a                                                                                                     | **No calendar category**                                                 |

Lock-in: the user's grants and tokens live at the vendor, the plan's events pass through a third party, and
the app's sync logic is written against the vendor's object model. The saving is real for a product
connecting thousands of mixed accounts. For one user and a schedule that already exports as standard
iCalendar, a unified API adds a dependency and a bill without removing the OAuth app registration.

### 5.2 Open-source precedent: cal.com

- One package per provider under `packages/app-store`: `googlecalendar`, `office365calendar`, `applecalendar`,
  `caldavcalendar`, `exchangecalendar`, `ics-feedcalendar` and others, with shared `_utils` ([tree][cal-tree]).
- Google: authorization-code flow with `access_type: "offline"` and `prompt: "consent"` ([source][cal-google-add]);
  the self-hosting guide asks for the `calendar.events` and `calendar.readonly` scopes and a redirect to
  `/api/integrations/googlecalendar/callback` ([guide][cal-google-doc]).
- Microsoft: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` with scopes `User.Read`,
  `Calendars.Read`, `Calendars.ReadWrite`, `offline_access` ([source][cal-o365-add]).
- Apple: a username and app-specific password, encrypted at rest, used against `https://caldav.icloud.com`
  ([source][cal-apple-add], [source][cal-apple-svc]).
- It also has a connector that only _reads_ an ICS feed URL (`ics-feedcalendar`), which is the precedent for
  idea 7.1 below.

The pattern to copy if stage 4 is ever built: a small `CalendarProvider` interface (list calendars, upsert
event, delete event, read busy times), one adapter per provider, one credentials store.

## 6. One-way or two-way

| Question            | One-way, app → calendar                                                                             | Two-way                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth     | The app: `content.ts` + `schedule.ts` + `edits.json`                                                | Ambiguous: generated schedule, manual edits and provider edits all compete                                                              |
| Conflicts           | None                                                                                                | Needs version checks: Google event `sequence`/etag, Graph `changeKey` ("allows Exchange to apply changes to the correct version", [event][ms-event]) |
| Deletions           | Feed: the event is simply absent on the next refresh. API: delete by stored provider id             | Must tell "deleted in the calendar" from "not yet created"; Google reports deletions in incremental sync ([sync][g-sync]), Graph as `@removed` ([delta][ms-delta]) |
| Missed changes      | Not possible                                                                                        | Push is advisory: Google "Notifications are not 100% reliable" ([push][g-push]); Graph subscriptions expire within seven days ([sub][ms-sub]). A periodic delta sync is still required |
| Fits this app       | Yes                                                                                                 | Poorly: an edit made in Google would have to become a `PlanChange` and a `PlanHistory` step, and would fight `pnpm run plan`             |

What the provider documentation recommends, taken together: do one full sync, then incremental syncs with the
stored token, treat `410` as "wipe and resync" ([Google][g-sync]); use push only to shorten the delay, never
as the only signal ([Google][g-push]); renew subscriptions before they expire ([Microsoft][ms-sub]); back off
exponentially and spread sync times ([Google][g-quota]).

**Recommendation: one-way, the app is the source of truth.** The feature research already found that the
planner incumbents avoid rewriting event times precisely because two-way sync makes it risky
(`docs/feature-research.md` §1.1), and that the plan reacting to reality is this app's own strength.

**Done state.** A `VEVENT` has no "completed" status: its `STATUS` is tentative, confirmed or cancelled
([RFC 5545 §3.8.1.11][rfc5545]); Google events likewise have only `confirmed`, `tentative`, `cancelled`
([event resource][g-events]). Options, cheapest first:

1. Prefix the title of a done session in the feed (for example `✓ `) and mark it `TRANSP:TRANSPARENT` so it
   no longer blocks time. Works in every client, one-way, no login.
2. Mirror sessions as tasks: Google Tasks has `status` `needsAction` or `completed` ([Tasks API][g-tasks]);
   Microsoft To Do has `notStarted`, `inProgress`, `completed`, … and works with personal accounts
   ([todoTask][ms-todo], [create task][ms-todo-post]). Needs OAuth, and a Google task's `due` "represents the
   day that the task should be done", not a time slot ([Tasks API][g-tasks]).
3. `VTODO` over CalDAV. Not portable: Google's CalDAV does not support `VTODO` ([Google][g-caldav]).

## 7. Out-of-the-box ideas for a study plan

| #   | Idea                                                                                       | Login?                 | Verdict                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | **Reverse subscription:** the user pastes their own Google "Secret address in iCal format" or Outlook published ICS link; the server reads it and shows real meetings as a grey "busy" layer, so sessions can be placed around them | No                     | **Best idea per unit of effort.** Uses the mechanism both vendors document for exactly this ("you give the application read-only access", [Google][g-secret]; [Outlook][ms-publish]). No OAuth app, no verification. The URL is a secret: store it server-side only |
| 7.2 | Tokenized feed plus a QR code of the `webcal://` URL                                       | No                     | **Do it** with stage 2. The phone camera opens the calendar app's subscribe sheet (f)                                                                                                                                                                     |
| 7.3 | Free/busy through the API: Google `freebusy.query` with `calendar.freebusy`                | Yes                    | Cleaner than 7.1 (no event details at all) but needs OAuth. On Microsoft, `getSchedule` and `findMeetingTimes` do not work for personal accounts ([ref][ms-getschedule]), so a personal Outlook.com user needs `calendarView` with `Calendars.ReadBasic`     |
| 7.4 | Push into an **app-created** Google calendar with only `calendar.app.created`              | Yes                    | The right shape for stage 4: the consent screen asks for nothing about the user's existing events ([scopes][g-auth])                                                                                                                                       |
| 7.5 | Browser-only push with the Google Identity Services token model                            | Yes, per click         | No backend secret, works on a static deployment, but each sync needs a click and nothing runs in the background ([Google][g-gis]). A fair "Sync now" button, not a sync engine                                                                             |
| 7.6 | Done checkbox through Google Tasks / Microsoft To Do                                       | Yes                    | Later, if at all. Option 1 in section 6 gets most of the value with no login                                                                                                                                                                              |
| 7.7 | An AI assistant with a calendar connector reads `/api/plan` and books the sessions (MCP is "an open-source standard for connecting AI applications to external systems", [MCP][mcp]) | In the assistant        | Zero app code, but not repeatable or auditable; a personal convenience, not a feature. Which providers ship first-party MCP calendar servers was not verified                                                                                              |
| 7.8 | "Add this session" on a single event: the documented Google template link plus a one-event `.ics` | No                     | Small and cheap; good for the event popover                                                                                                                                                                                                               |
| 7.9 | Email the session as an invitation (iMIP), so updates arrive as new invitations             | No, but needs SMTP     | Rejected: Google itself warns that invitations from unknown senders are held back ([Google][g-invite]), and it adds a mail dependency                                                                                                                      |

## 8. Ranked options for this app

Effort: S = a day or two, M = about a week, L = several weeks. "Updates propagate" means a move or delete made
in the app reaches the user's calendar without the user doing anything.

| Rank | Option                                                        | Login?                         | Public URL?                         | Direction        | Updates propagate?          | Effort | Providers                                             |
| ---- | ------------------------------------------------------------- | ------------------------------ | ----------------------------------- | ---------------- | --------------------------- | ------ | ----------------------------------------------------- |
| 1    | Provider step in the export dialog + iCalendar hygiene        | No                             | No                                  | App → calendar   | No (file snapshot)          | S      | All                                                   |
| 2    | Tokenized subscription feed, subscribe links, QR              | No                             | Yes (not for Apple on the same Mac) | App → calendar   | Yes, after the client's refresh (hours) | S–M    | Google, Outlook, Apple, anything that reads iCalendar |
| 3    | Busy overlay from the user's secret ICS address (7.1)         | No                             | No                                  | Calendar → app, read-only | Yes, on each fetch | M      | Google, Outlook, iCloud public calendars              |
| 4    | "Add this session" link and single-event `.ics` (7.8)         | No                             | No                                  | App → calendar   | No                          | S      | Google (d); Outlook, Yahoo (f); Apple by file         |
| 5    | OAuth one-way push to an app-created calendar (7.4)           | Yes                            | No for Google/Graph calls; yes for webhooks | App → calendar | Yes, within seconds         | L      | Google first, then Microsoft Graph                    |
| 6    | CalDAV push with an app-specific password                     | Password, not OAuth            | No                                  | App → calendar   | Yes                         | M–L    | iCloud, Fastmail, Nextcloud; Google with OAuth        |
| 7    | Free/busy through the provider API (7.3)                      | Yes                            | No                                  | Calendar → app   | Yes                         | M (after 5) | Google; Microsoft work accounts                  |
| 8    | Tasks for the done checkbox (7.6)                             | Yes                            | No                                  | App → tasks      | Yes                         | M (after 5) | Google Tasks, Microsoft To Do                    |
| 9    | Unified API (Nylas and similar)                               | Yes, at the vendor             | Yes for webhooks                    | Either           | Yes                         | M + monthly cost | Google, Microsoft, iCloud (vendor-dependent) |
| 10   | Two-way sync                                                  | Yes                            | Yes for webhooks                    | Both             | Yes                         | L+     | Each provider separately                              |

## 9. Staged plan

### Stage 1 — now, no login, no deployment needed (S)

1. Add a **"Where to?" step** to the existing export dialog (sketch below). It replaces the two generic how-to
   lines with instructions for the chosen provider.
2. iCalendar hygiene in `ics.ts`: resolve `METHOD:PUBLISH` versus `ORGANIZER` (section 2), add `SEQUENCE` and
   `LAST-MODIFIED` per event, `NAME`, `COLOR`, `REFRESH-INTERVAL`, `X-PUBLISHED-TTL` and `SOURCE` per calendar.
3. Done sessions: title prefix and `TRANSP:TRANSPARENT` (section 6, option 1), behind a checkbox in the dialog.
4. Optional: "Add this session" in the event popover (7.8), and a feature-detected share button on phones.

### Stage 2 — when the app gets a public URL (S–M)

1. A **tokenized feed**: `/api/ics/<token>/<calendarId>.ics`, token generated once and stored by
   `plan-data`, with a "reset link" action; the un-tokenized routes stop answering on a public host.
2. In the dialog, "Subscribe" becomes the default tab: `webcal://` link, the Google and Outlook one-click
   links (f), a copy-URL button and a QR code.
3. Replace `Cache-Control: no-store` with an `ETag` so polling clients get `304` when nothing changed.
4. State the lag honestly in the UI: Outlook about every 3 hours and sometimes more than 24
   ([Outlook][ms-subscribe]); Google unspecified; Apple as chosen by the user ([Apple][a-sub]).

### Stage 3 — still no OAuth (M)

The busy overlay (7.1): a settings field for one or more secret ICS addresses, a server function that fetches
and parses them, and a read-only layer in the week view. The existing `occurrences.ts` already expands
recurring events for a date range. This is the piece that makes the catch-up scenarios aware of real meetings.

### Stage 4 — OAuth, only if one of these becomes true (L)

- A change made in the app must show in the calendar within minutes, not hours.
- The plan must appear in the Google Calendar phone app without ever opening a desktop browser.
- More than one person uses the app, each with their own calendar.

Then: Google first, scope `calendar.app.created`, server-side authorization code with PKCE, one calendar
created per plan calendar, events upserted with an `id` or `iCalUID` derived from the app's UID and a private
extended property holding the revision, deletions pushed by id, a full re-push as the recovery path. Microsoft
Graph second, with `transactionId` for idempotent creates and the Graph event id stored against the UID
(because `iCalUId` is read-only). An **app login is a prerequisite** if the deployment is public.

### Not planned

Two-way sync, a unified API, and CalDAV for Apple (the subscription covers Apple with zero credentials).

### The dialog, sketched

```
Export to calendar
──────────────────────────────────────────────────────────────
1. What        [x] Gemini Certs   [x] HF LLM   [ ] Personal …        (as today)
               ( ) Separate calendars   ( ) One calendar             (as today)
               [ ] Mark finished sessions with ✓

2. Where to    ( Google Calendar ) ( Outlook ) ( Apple Calendar ) ( Other / file )

3. How         ( Subscribe — stays up to date )   ( Download file — one-time copy )
──────────────────────────────────────────────────────────────
Google + Subscribe      [Open in Google Calendar]  [Copy link]  [QR]
                        "Read-only. Google checks for changes on its own schedule."
                        "Subscribing needs a computer browser; it then shows in the phone app."
Google + File           [Download .ics / .zip]
                        "Settings → Import & export → Import. Pick the calendar with the same name."
                        "A second import may duplicate: clear the calendar first."
Outlook + Subscribe     [Open in Outlook]  [Copy link]  [QR]
                        "Updates about every 3 hours, sometimes longer."
Outlook + File          [Download .ics / .zip]   "Add calendar → Upload from file."
Apple + Subscribe       [Subscribe (webcal://)]  [Copy link]  [QR for iPhone]
                        "Choose iCloud as the location to see it on all devices."
Apple + File            [Download .ics]   "Open the file; Calendar asks which calendar to add to."
Other / file            [Download .zip]  [Download one .ics]  [Download plan.json]  [Copy feed URL]
──────────────────────────────────────────────────────────────
Without a public URL, "Subscribe" is disabled for Google and Outlook with the reason shown;
Apple Calendar on this Mac can still subscribe to the local address.
(later) [Connect Google Calendar…]   appears here in stage 4, as a third "How".
```

Remember the last provider choice per browser so the second export is one click. All new strings go to the
three message files.

## 10. Not verified, or de facto

| Claim                                                                                              | Status                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| How often Google Calendar refreshes a calendar added "From URL"                                    | Not on Google's page ([Google][g-url]). The README's "every few hours" is community knowledge                                  |
| Outlook on the web refreshes about every 6 hours                                                   | Read once through a summarising fetch of [Microsoft's article][ms-subscribe]; the 3-hour and 24-hour figures were quoted       |
| `calendar.google.com/calendar/r?cid=<url>` and `outlook.live.com/calendar/0/addfromweb?url=…`      | De facto; no first-party page found                                                                                            |
| `calendar/render?action=TEMPLATE` with `ctz`, `recur`, `add`                                       | De facto; Google documents only `r/eventedit` with `dates`, `stz`, `etz`, `details`, `location`, `text`                        |
| Outlook and Yahoo compose deeplinks                                                                | De facto; Microsoft search returned only forum threads; Yahoo was not searched exhaustively                                    |
| What Google, Outlook and Apple do with the same `UID` on a second file import                      | Not documented by any of them                                                                                                  |
| Whether any provider honours `REFRESH-INTERVAL`, `X-PUBLISHED-TTL`, `COLOR`, `NAME`                | Not documented                                                                                                                 |
| `X-WR-CALNAME`                                                                                     | No specification found                                                                                                         |
| Sharing an `.ics` through `navigator.share`                                                        | Not in MDN's list of usually shareable types; must be tested per browser                                                       |
| Phones opening a `text/calendar` response or a `webcal://` QR code in the calendar app             | De facto                                                                                                                       |
| Which Google Calendar scopes are "sensitive" and whether any is "restricted"                       | Shown only in the Cloud Console; not on the public pages read                                                                  |
| `events.import` behaviour when the `iCalUID` already exists                                        | Not stated on the reference page                                                                                               |
| Google push channel default and maximum lifetime; whether the webhook domain must be verified      | Not stated on the push guide as read                                                                                           |
| Google quota figures and the planned charges                                                       | Read through a summarising fetch of the [quota guide][g-quota]; re-check before relying on them                                |
| `https://caldav.icloud.com` and any OAuth-style authorisation for iCloud Calendar                  | Endpoint is de facto (cal.com source); Apple's developer-facing description was not found                                      |
| Microsoft has no CalDAV                                                                            | No page says so; no CalDAV endpoint appears in Microsoft's documentation                                                       |
| Work tenants blocking user consent                                                                 | General knowledge                                                                                                              |
| Cronofy's provider list and free tier; Aurinko's free tier; Nylas's exact Google-app requirements  | Not stated on the pages read, or the page returned 404                                                                         |
| First-party MCP calendar servers                                                                   | Not investigated                                                                                                               |
| Apple Calendar on the same Mac subscribing to a `localhost` URL                                    | General knowledge; test                                                                                                        |

Pages that could not be read directly: Apple's EventKit page is script-rendered (its JSON data file was read
instead); `support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac` returned only the table of
contents (the versioned en-AU URL was read); Cronofy's supported-calendars docs page returned 404; cal.com's
self-hosting docs now redirect to `cal.diy`.

[rfc5545]: https://www.rfc-editor.org/rfc/rfc5545
[rfc5546]: https://www.rfc-editor.org/rfc/rfc5546
[rfc7986]: https://www.rfc-editor.org/rfc/rfc7986
[rfc4791]: https://www.rfc-editor.org/rfc/rfc4791
[rfc6578]: https://www.rfc-editor.org/rfc/rfc6578
[rfc8252]: https://www.rfc-editor.org/rfc/rfc8252
[rfc9700]: https://www.rfc-editor.org/rfc/rfc9700
[iana-webcal]: https://www.iana.org/assignments/uri-schemes/prov/webcal
[w3c-share]: https://w3c.github.io/web-share/
[mdn-share]: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
[ms-oxcical-ttl]: https://msdn.microsoft.com/en-us/library/1fc7b244-ecd1-4d28-ac0c-2bb4df855a1f
[g-invite]: https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events
[g-url]: https://support.google.com/calendar/answer/37100
[g-secret]: https://support.google.com/calendar/answer/37648
[g-import]: https://support.google.com/calendar/answer/37118
[g-auth]: https://developers.google.com/workspace/calendar/api/auth
[g-scopes]: https://developers.google.com/identity/protocols/oauth2/scopes
[g-verif-req]: https://support.google.com/cloud/answer/13464321
[g-verif-exempt]: https://support.google.com/cloud/answer/13464323
[g-audience]: https://support.google.com/cloud/answer/15549945
[g-oauth]: https://developers.google.com/identity/protocols/oauth2
[g-webserver]: https://developers.google.com/identity/protocols/oauth2/web-server
[g-gis]: https://developers.google.com/identity/oauth2/web/guides/use-token-model
[g-sync]: https://developers.google.com/workspace/calendar/api/guides/sync
[g-push]: https://developers.google.com/workspace/calendar/api/guides/push
[g-quota]: https://developers.google.com/workspace/calendar/api/guides/quota
[g-import-api]: https://developers.google.com/workspace/calendar/api/v3/reference/events/import
[g-cal-insert]: https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert
[g-events]: https://developers.google.com/workspace/calendar/api/v3/reference/events
[g-extprops]: https://developers.google.com/workspace/calendar/api/guides/extended-properties
[g-freebusy]: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
[g-caldav]: https://developers.google.com/workspace/calendar/caldav/v2/guide
[g-tasks]: https://developers.google.com/workspace/tasks/reference/rest/v1/tasks
[ms-subscribe]: https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c
[ms-publish]: https://support.microsoft.com/en-us/office/share-your-calendar-in-outlook-com-0fc1cb48-569d-4d1e-ac20-5a9b3f5e6ff2
[ms-deeplink-thread]: https://learn.microsoft.com/en-nz/answers/questions/2148634/deeplinking-to-outlook-calendar-compose-subscribe
[ms-perm]: https://learn.microsoft.com/en-us/graph/permissions-reference
[ms-audience]: https://learn.microsoft.com/en-us/entra/identity-platform/supported-accounts-validation
[ms-delta]: https://learn.microsoft.com/en-us/graph/delta-query-events
[ms-sub]: https://learn.microsoft.com/en-us/graph/api/resources/subscription
[ms-webhook]: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
[ms-event]: https://learn.microsoft.com/en-us/graph/api/resources/event
[ms-post-event]: https://learn.microsoft.com/en-us/graph/api/user-post-events
[ms-extprop]: https://learn.microsoft.com/en-us/graph/api/singlevaluelegacyextendedproperty-post-singlevalueextendedproperties
[ms-getschedule]: https://learn.microsoft.com/en-us/graph/api/calendar-getschedule
[ms-fmt]: https://learn.microsoft.com/en-us/graph/api/user-findmeetingtimes
[ms-authcode]: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
[ms-redirect]: https://learn.microsoft.com/en-us/entra/identity-platform/reply-url
[ms-todo]: https://learn.microsoft.com/en-us/graph/api/resources/todotask
[ms-todo-post]: https://learn.microsoft.com/en-us/graph/api/todotasklist-post-tasks
[a-sub]: https://support.apple.com/en-au/guide/calendar/icl1022/16.0/mac/26
[a-refresh]: https://support.apple.com/guide/calendar/icl1024/mac
[a-iphone]: https://support.apple.com/guide/iphone/set-up-multiple-calendars-iph3d1110d4/ios
[a-asp]: https://support.apple.com/en-us/102654
[a-eventkit]: https://developer.apple.com/documentation/eventkit
[fm]: https://www.fastmail.help/hc/en-us/articles/1500000278342-Server-names-and-ports
[nc]: https://docs.nextcloud.com/server/latest/user_manual/en/groupware/sync_ios.html
[nylas-price]: https://www.nylas.com/pricing/
[nylas-prov]: https://developer.nylas.com/docs/provider-guides/
[cronofy]: https://www.cronofy.com/pricing
[unipile]: https://www.unipile.com/pricing-api/
[aurinko]: https://www.aurinko.io/pricing/
[merge]: https://docs.merge.dev/
[cal-tree]: https://github.com/calcom/cal.com/tree/main/packages/app-store
[cal-google-add]: https://github.com/calcom/cal.com/blob/main/packages/app-store/googlecalendar/api/add.ts
[cal-google-doc]: https://cal.diy/apps/google
[cal-o365-add]: https://github.com/calcom/cal.com/blob/main/packages/app-store/office365calendar/api/add.ts
[cal-apple-add]: https://github.com/calcom/cal.com/blob/main/packages/app-store/applecalendar/api/add.ts
[cal-apple-svc]: https://github.com/calcom/cal.com/blob/main/packages/app-store/applecalendar/lib/CalendarService.ts
[mcp]: https://modelcontextprotocol.io/docs/getting-started/intro
