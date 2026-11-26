# Expanding the event popup: from a card beside the event to a large, focused view

Fetched 2026-11-26, 19:54–20:10 UTC (22:54–23:10 Europe/Minsk). Only first-party pages were used: vendors' help
centres, release notes, changelogs and marketing pages about their own features, design-system docs and their
published package source, the WHATWG HTML standard, W3C (WAI-ARIA APG, WCAG 2.2 Understanding), MDN and its
browser-compat-data repository, Apple and Android developer docs. Linear's docs were read from the Markdown copies
listed in its `llms.txt` (`/docs/<page>.md`); Apple's HIG pages through their JSON copies
(`/tutorials/data/design/human-interface-guidelines/<page>.json`); Atlassian's modal sizes and icon rules from the
published `@atlaskit/modal-dialog@17.3.3` and `@atlaskit/icon@38.2.0` packages on jsDelivr; Material Symbols tags
from Google Fonts' icon metadata; Lucide tags from the Lucide repository. The Material Design 3 site renders in the
browser only: its claims are marked (s), and Google's own `material-components-android` docs and the Android
Developers dialog guide were read instead. Every claim is followed by the page it was read from.

The question: the owner wants an expand button on the event popup. Pressing it shows the same event large and
centred on screen, with the page behind it out of the way, "to see the event on screen and be focused". How do
calendar, planning and task products move from a small popup or peek to a larger focused view, and how is that
built accessibly with the native `<dialog>` that the planner's `Modal` already is?

The Focus page (`/focus`, the stopwatch for one session) is a different thing and is covered in
`docs/focus-hourglass-research.md`; this note is about the event dialog only.

Legend: **(d)** = documented on the linked first-party page, read here; **(s)** = the page could not be read, the
claim comes from a search engine's copy of it; **(k)** = my general knowledge, not re-verified. Treat (s) and (k)
as leads. Section 6 lists what could not be verified.

## 1. Recommended pattern, ranked

1. **Grow the same dialog in place; do not open a second layer or a new page.** Notion's "Center peek" is "a
   focused, center modal" and is the default for its own Calendar and Gallery layouts ([Notion
   views][notion-views]); Jira lets each person choose between a right sidebar and "a centered dialog" ([Jira
   board][jira-board]). Apple: "Some popovers provide both condensed and expanded views of the same information. If
   you adjust the size of a popover, animate the change to avoid giving the impression that a new popover replaced
   the old one" ([HIG popovers][hig-popovers]); "Let people dismiss a modal view before presenting another one"
   ([HIG modality][hig-modality]); Things: "When you open a to-do, it smoothly transforms into a clear white piece
   of paper" ([Things][things-features]) (all d). Here: `EventDialog` passes no `anchor` and a bigger `size` while
   expanded; `Modal` then already centres it and switches to the darker, blurred backdrop (section 7).
2. **"Large" means a reading layout, with the page dimmed, not just a wider box.** Apple: "Consider using a
   full-screen modal style for in-depth content … A modal experience that fills a window or the device display
   minimizes distractions" ([HIG modality][hig-modality]); Primer's centred dialog has "a visible backdrop that
   dims the rest of the window for focus" ([Primer guidelines][primer-guide]) (d). Keep the content the same and
   re-lay it: a detached macOS popover should "Make minimal appearance changes … A panel that looks similar to the
   original popover helps people maintain context" ([HIG popovers][hig-popovers]) (d). A larger title, the
   description at reading size with a limited line length, header and button row fixed and only the body scrolling:
   Atlassian's full-screen modal "only support[s] body scrolling, so that the header and close button will always
   stay visible" ([ADS source][ads-fullscreen-src]) (d).
3. **The button sits in the header beside ✕ and uses the diagonal-arrows icon.** Notion: "Click `⤡` at the top left
   to view in full page mode" ([Notion databases][notion-db]); Jira: "select the Full screen icon in the top right
   of the panel" ([Jira preview][jira-preview]); Linear Insights: "selecting the expand button"
   ([Linear][linear-insights]) (d). Atlassian reserves `grow-diagonal` "for increasing the size of an element when
   height and width are changed concurrently" and `shrink-diagonal` "for shrinking the height and width of modals,
   panels, media, or objects", and keeps `fullscreen-enter` for "full screen videos or objects" and `link-external`
   for "links that open up a new tab" ([ADS icons][ads-icons]) (d). The planner already uses
   `Maximize2`/`Minimize2` (diagonal arrows) for Expand and `Maximize`/`Minimize` (corners) for full screen: keep
   that split (section 3.6).
4. **One meaning for the button: a toggle with a fixed name and `aria-pressed`, and focus stays on it.** APG: "it
   is critical the label on a toggle does not change when its state changes"; its example reads "Mute toggle button
   pressed"; for an action that does not dismiss the context "focus usually stays on the button" ([APG
   button][apg-button]) (d). The icon may swap, it is `aria-hidden`. `ScreenButtons` today swaps the label *and*
   sets `aria-pressed`, which the APG rule forbids; fix both buttons the same way (section 4.2).
5. **Esc closes the dialog from either size; collapsing is the button's job.** APG: "Escape: Closes the dialog"
   ([APG dialog][apg-dialog]); Google Calendar's Esc returns "to the calendar grid from an event details page"
   ([shortcuts][gcal-keys]); Apple Calendar: "Close the event editor — Return or Escape" ([Apple
   keys][apple-keys]); Outlook: "to close the event Details window, press Esc" ([Outlook SR][ol-sr]) (all d). None
   of them documents an intermediate "Esc shrinks first" step, and the platform makes one unreliable: a platform
   close request is cancelable "only when allowed by user activation", and "a subsequent close request without
   intervening user activation may fire a non-cancelable `cancel` event and close the dialog" ([MDN
   cancel][mdn-cancel]) (d).
6. **Remember the choice per browser; keep the URL as it is (`?event=<uid>`).** Products keep "how items open" as a
   standing preference: Notion per view, for "everyone who uses the database view" ([Notion peek][notion-peek]);
   Jira "view settings are applied per user" ([Jira board][jira-board]); Apple Calendar's "Open events in separate
   windows" setting ([Apple windows][apple-windows]); Atlassian's side panel: "your preferred width will be
   remembered next time" ([side panel][atl-sidepanel]) (all d). The size is the viewer's reading preference, not
   part of what a link names: Primer warns that opening dialogs from URL parameters "can disorient users" ([Primer
   guidelines][primer-guide]) (d), and the planner's `expanded` search key already means the calendar's Expand.
7. **Animate the size change only where motion is welcome.** Apple asks for the animation (1); WCAG counts "an
   element which moves into place or changes size" as motion animation, which must be possible to turn off, and
   names C39, `prefers-reduced-motion` ([WCAG 2.3.3][wcag-anim]) (d). Under `reduce`, switch at once or cross-fade:
   changes of "color … or opacity" are not motion animation (d, same page; blurring no longer excluded, per its
   erratum).
8. **On narrow windows there is nothing to expand.** Below 768 px `Modal` is already centred and nearly as wide as
   the window. Android shows the same fragment "as a dialog" on a large layout and "fullscreen" on a smaller one
   ([Android dialogs][android-dialogs]); Primer: "Full-screen Dialogs may be used to present content that needs all
   the available space on narrow viewports" ([Primer guidelines][primer-guide]); Apple: "for compact views, use all
   available screen space by presenting information in a full-screen modal view like a sheet" ([HIG
   popovers][hig-popovers]) (d). Hide the toggle there, or let it fill the screen; either way the content has to
   reflow at 320 CSS px ([WCAG 1.4.10][wcag-reflow]) (d).
9. **Backdrop clicks.** Keep `closedby="any"` for the read view; when the edit form is open, Primer's rule is that
   "the backdrop won't dismiss the Dialog" where a form may have unsaved changes ([Primer
   guidelines][primer-guide]) (d). Atlassian turns overlay clicks off for full-screen modals ([ADS
   source][ads-fullscreen-src]) (d).
10. **A shortcut is optional.** Google opens details with `e` ([shortcuts][gcal-keys]), Apple with Option-Command-I
    ([Apple keys][apple-keys]), Linear peeks with Space ([Linear views][linear-views]) (d). If one is added, it
    goes in the shortcuts dialog and must not fire inside the edit form's fields.

## 2. Product patterns

### 2.1 Summary

| Product | Small view | Way to the larger view | Larger view | What it adds | Remembered | URL | Way back |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Google Calendar (web) | "event dialog": RSVP, Join, Delete, organizer (d) | "Edit event" button (d); `e` = "Open event details" (d) | "event details page" (d) | Full editing; ⌘/Ctrl+S saves "from the event details page" (d) | Not documented | Own URL (k) | Esc: "Return to the calendar grid" (d) |
| Outlook on the web, new Outlook | Selection announces title, time, place, organizer (d); no card documented | Enter: "The event Details window opens" (d); My Day: "View full event in new window" (d) | "Details window" (d) | Editing (d) | Not documented | Not documented | Esc closes it; "focus moves to Calendar" (d) |
| Apple Calendar (Mac) | "Double-click or force click the event to open it" (d) | ⌥⌘I: "Edit the selected event in the inspector window" (d); setting "Open events in separate windows" (d) | A movable window (d) | Same fields: location, travel time, video call, notes, URL, attachments (d) | Yes, the setting (d) | — (native) | "Return or Escape" closes the editor (d) |
| Notion Calendar | None: details show "in the right context panel" (d) | No expand documented; "Open in Notion" for database items (d) | — | — | — | — | — |
| Notion databases | Side peek or center peek (d) | "Click `⤡` at the top left to view in full page mode" (d) | Full page (d) | The whole page (k) | Per view, for everyone (d) | `?p=…&pm=s/c` for peeks (k) | ⌘/Ctrl+[ "go back a page" (d) |
| Linear | Peek: Space toggles, holding Space shows it while held (d) | "open the issue to see all properties" (d) | Issue view (k: a page) | Peek shows "more detail", the issue "all properties" (d) | Peek stays on until Space again (d) | Issues have a "unique URL" (d); peek none (k) | Esc (k) |
| Todoist | List row | "click a task to open the task view" (d); desktop: "Open in new window" (d) | Task view; presentation not stated (d) | Description, sub-tasks, comments, files, reminders, fields in a right-hand sidebar; activity via menu (d) | Not documented | "Copy link to task" (d) | Not documented; focus returns after closing from Search (d) |
| Things 3 (Mac) | List row | Return: "Open selected item" (d) | The to-do "transforms into a clear white piece of paper" (d) | Tags, checklist, dates "tucked away in the corner until you need them" (d) | — | Not read | Esc "collapses open to-dos and saves changes"; ⌘Return saves and closes (d) |
| Jira | Board card; search/list preview panel on the right (d) | Board setting: sidebar or "centered dialog" (d); preview: "Full screen icon in the top right" (d) | Not described | "see more information" (d) | "applied per user" (d) | `selectedIssue=` (k) | Not documented |
| Trello | Card back | Not documented | — | Comments and activity section can be expanded or collapsed (d) | — | — | — |

Sources: [Google shortcuts][gcal-keys], [Google create/edit][gcal-create], [Google screen reader][gcal-sr],
[Outlook screen reader][ol-sr], [My Day][ol-myday], [Apple windows][apple-windows], [Apple events][apple-events],
[Apple keys][apple-keys], [Notion Calendar events][ncal-events], [Notion Calendar + Notion][ncal-notion], [Notion
views][notion-views], [Notion peek release][notion-peek], [Notion databases][notion-db], [Notion
keys][notion-keys], [Linear views][linear-views], [Linear board][linear-board], [Linear issues][linear-issues],
[Todoist task view][todoist-view], [Todoist changelog][todoist-cl], [Things keys][things-keys], [Things Quick
Entry][things-qe], [Things features][things-features], [Jira board][jira-board], [Jira preview][jira-preview],
[Trello card back][trello-back].

### 2.2 Notes per product

- **Google Calendar.** Two levels, both documented in the screen-reader guide: "Press Enter to open the event
  dialog" and "To open the event details, press the e key"; "When done with event review, press Escape" ([screen
  reader][gcal-sr]) (d). With the pointer: "On your calendar grid, open an event", then "Edit event" at the top
  right, then "Save" at the top right ([create/edit][gcal-create]) (d). The large view is where editing happens,
  and Esc leaves it for the grid, not for the small dialog ([shortcuts][gcal-keys]) (d). The details page has its
  own URL (`/r/eventedit/…`) (k). Fields can be read without moving focus with Alt/Option + number (1 title, 2 date
  and time, 5 description …) (d, [screen reader][gcal-sr]).
- **Outlook.** Microsoft documents only the keyboard path for new Outlook and Outlook on the web: Enter opens "the
  event Details window", Esc closes it if nothing changed, and "the focus moves to Calendar" ([screen
  reader][ol-sr]) (d). My Day: "Select an event for more details", "Select Back to return to the Calendar tab",
  "You can also select View full event in new window to display or change all of the event's details" ([My
  Day][ol-myday]) (d). "Calendar peek" is a different thing, the hover preview of the navigation bar's calendar
  icon in classic Outlook, "not available in new Outlook for Windows" ([peek][ol-peek]) (d). The pop-out icon "in
  the upper corner of the item" ([Outlook Web App][owa-start]) is documented for the old Outlook Web App (Exchange
  2013/2010) only (d).
- **Apple Calendar (Mac).** "Double-click the event you want to open in a separate window", then drag it by its top
  edge; or turn on "Open events in separate windows" in Settings → Advanced ([windows][apple-windows]) (d).
  Shortcuts: ⌘E "Edit the selected event", ⌥⌘I "Edit the selected event in the inspector window", ⌘I "Show
  information for a calendar or event", "Return or Escape (while an event is open)" closes the editor
  ([keys][apple-keys]) (d). The default is a popover beside the event (k).
- **Notion Calendar.** Selecting an event puts its details "in the right context panel", where location, status,
  privacy, participants and calendar are edited; descriptions take "headers, hyperlinks, numbered and bulleted
  lists, and more" ([events][ncal-events]) (d). No expand control is documented; database items have "Open in
  Notion" ([getting started][ncal-start]) (d). Its shortcut list lives in the app (`?`) ([keys][ncal-keys]) (d).
- **Notion databases.** Three modes per view: "Side peek: Open pages on the right side of the database. The rest of
  the database view continues to be interactive on the left"; "Center peek: Open pages in a focused, center modal";
  "Full page: Open pages as full pages directly". Defaults: "Table, Board, List & Timeline layouts will open pages
  in side peek", "Gallery & Calendar layouts will open pages in center peek" ([views][notion-views]) (d). The
  setting "affects everyone who uses the database view" ([release][notion-peek]) (d). From a peek, "Click `⤡` at
  the top left to view in full page mode" ([databases][notion-db]) (d). In peek view, Ctrl+Shift+K / Ctrl+K and
  Ctrl+J step to the previous and next database page ([keys][notion-keys]) (d).
- **Linear.** "you can launch it by pressing the `Space` bar and turn it off by pressing the `Space` bar again. To
  temporarily turn it on, hold the `Space` bar down" ([views][linear-views]) (d); peek is "a quick way to glance
  over the focused issue in issue lists similar to Quicklook in macOS" ([2019 changelog][linear-peek-cl]) (d). On
  boards: "Use `Space` while hovering your cursor over a card to peek for more detail, or open the issue to see all
  properties" ([board][linear-board]) (d). Moving an issue gives it
  "a new issue ID and unique URL", old URLs redirect ([issues][linear-issues]) (d). Insights: "opened in Full
  Screen view by selecting the expand button … This gives you more room to explore" ([Insights][linear-insights])
  (d).
- **Todoist.** "In Todoist, click a task to open the task view"; chevrons or K/J move to the previous and next
  task; desktop apps add "Open in new window" in the task menu ([task view][todoist-view]) (d). The task view has
  "a new content area and a new sidebar on the right-hand side": name, description, sub-tasks and comments on the
  left, project, assignee, due date, priority, labels and reminders on the right; a "Mini view" serves narrow
  windows ([new task view][todoist-new]) (d). Changelog, 20 August 2026: "closing a task you opened from Search
  sends focus back to where you were" ([changelog][todoist-cl]) (d).
- **Things 3.** Return "Open selected item", ⌘Return "Save and close item" ([Mac keys][things-keys]); "In the main
  app, the Esc key collapses open to-dos and saves changes" ([Quick Entry][things-qe]) (d). The open to-do is the
  list row grown in place (k; the features page says it "transforms", [features][things-features]).
- **Jira.** "Open work items in sidebar: When turned on, work items you select open as a sidebar on the right. When
  turned off, work items open as a centered dialog"; board full screen is "Enter full screen" / "Exit full screen"
  at the top right; "view settings are applied per user" ([board][jira-board]) (d). In search and the list view,
  "The preview panel opens on the right side of the screen" and the "Full screen icon in the top right of the
  panel" shows more ([preview][jira-preview]) (d). The cross-product side panel offers to "open the full page in a
  new tab" and remembers its width ([side panel][atl-sidepanel]) (d).
- **Trello.** The new card back lets you "expand/collapse the card's comments and activity section through the
  navigation menu at the bottom of the card back" ([card back][trello-back]) (d). Nothing about enlarging the card.

What the products agree on: the larger view shows *the same item with more of it* (Linear's "more detail" → "all
properties", Todoist's description, sub-tasks and comments, Apple's notes, URL and attachments). Where the larger
view is a page (Google, Linear, Notion full page) it has its own URL and history; where it is a mode of a dialog or
panel (Notion peeks, Jira's dialog/sidebar choice, Apple's window setting) it is a remembered preference.

## 3. Design-system guidance

### 3.1 Apple Human Interface Guidelines

- **Popovers.** "Use a popover to expose a small amount of information or functionality"; "Avoid making a popover
  too big"; "Provide a smooth transition when changing the size of a popover. Some popovers provide both condensed
  and expanded views of the same information. If you adjust the size of a popover, animate the change to avoid
  giving the impression that a new popover replaced the old one"; "Never show a cascade or hierarchy of popovers";
  on iPhone and iPad "Avoid displaying popovers in compact views … use all available screen space by presenting
  information in a full-screen modal view like a sheet instead"; on macOS "Consider letting people detach a
  popover" into a panel, and "Make minimal appearance changes to a detached popover" ([popovers][hig-popovers])
  (d).
- **Sheets.** iOS detents: "large is the height of a fully expanded sheet and medium is about half"; "consider
  supporting the medium detent to allow progressive disclosure"; a grabber shows a sheet can be resized and "tap it
  to cycle through the detents". macOS: "People don't generally expect to resize sheets … In some cases, however,
  people appreciate a resizable sheet — such as when they need to expand the contents for a clearer view — so it's
  a good idea to support resizing"; the parent window "is dimmed while the sheet is onscreen". visionOS: "prefer
  centering it in their field of view" and "Present a sheet in a default size that helps people retain their
  context" ([sheets][hig-sheets]) (d).
- **Modality.** "Present content modally only when there's a clear benefit … use modality only when it helps people
  focus"; "Consider using a full-screen modal style for in-depth content or a complex task … minimizes
  distractions"; "Always give people an obvious way to dismiss a modal view"; "Let people dismiss a modal view
  before presenting another one" ([modality][hig-modality]) (d).

### 3.2 Material Design 3 and Android

- Material's dialogs come in two variants, basic and full-screen. "Full-screen dialogs fill the entire screen,
  containing actions that require a series of tasks to complete. One example is creating a calendar entry with the
  event title, date, location, and time"; they "are the only dialogs over which other dialogs can appear"
  ([material-components-android][mdc-dialog]) (d).
- Android shows one `DialogFragment` "as a dialog" when "the device is using a large layout" and "fullscreen" when
  it "is smaller", picked by a `large_layout` resource per screen size ([Android dialogs][android-dialogs]) (d).
- The M3 guidelines page limits full-screen dialogs to compact windows (under 600 dp) and lets a full-screen dialog
  turn into a basic one at larger breakpoints (s, [M3 dialogs][m3-dialogs]).

### 3.3 Atlassian Design System

- Widths are named: `small`, `medium`, `large`, `x-large` ([examples][ads-modal-ex]) (d), which the package
  resolves to 400, 600, 800 and 968 px ([source][ads-modal-src]) (d). "The content determines the height"; an unset
  height grows "to fill the viewport and then start overflowing" ([code][ads-modal-code]) (d).
- "Full screen: A modal that fills the entire viewport. Always include a modal header with a close button"
  ([examples][ads-modal-ex]) (d). Its source: "Full screen modals only support body scrolling, so that the header
  and close button will always stay visible", overlay click is "a noop for fullscreen modals", and the blanket
  stays ([source][ads-fullscreen-src]) (d). The docs do not describe switching an open modal between sizes.
- Dismissal: "Pressing `Esc`" and "Selecting anywhere outside the modal (in the blanket)"; "When the modal is
  closed, focus should return to the element that triggered the modal"; "Avoid horizontal scrolling and minimize
  vertical scrolling whenever possible" ([usage][ads-modal]) (d).

### 3.4 Primer (GitHub)

- Positions: centred with a dimming backdrop; right side sheets "can also be considered for quick previews in
  full-width pages"; "Don't use side sheets to present create/edit forms"; "Centered Dialogs are surrounded by a
  safe area of `16px`" ([guidelines][primer-guide]) (d) (the planner's `Modal` uses the same 16 px).
- Narrow viewports: a centred dialog "may adapt to appear as a bottom sheet on small screens"; "Full-screen Dialogs
  may be used to present content that needs all the available space on narrow viewports"
  ([guidelines][primer-guide]) (d).
- Size: "Before using an extra large Dialog, consider whether or not the content would be more appropriate for a
  new page" ([Dialog][primer-dialog]) (d).
- Deep linking: "It's crucial to consider if the Dialog should be accessible via a link. While we can rely on
  parameters in the URL to open Dialogs on page load, this approach can disorient users because they might not
  understand to what context this Dialog belongs to … it is often more advisable to avoid using a Dialog
  altogether" ([guidelines][primer-guide]) (d).
- Dismissal: backdrop click dismisses by default but not over a form with possible unsaved changes; "The close
  button is required"; with two stacked dialogs "pressing `Esc` should only close the top-level Dialog"
  ([guidelines][primer-guide]) (d).

### 3.5 Fluent 2 and GOV.UK

- Fluent 2: "A modal dialog disables the page content behind it and usually obscures or dims it"; it is dismissed
  "by selecting an area outside of the container, using the Esc key"; "When a dialog is opened, keyboard focus
  should go to the first interactive element"; "When the dialog is closed, set keyboard focus back to the component
  that triggered the dialog" ([Fluent dialog][fluent-dialog]) (d). Sizes and full-screen dialogs are not covered
  there.
- GOV.UK's component list (37 components) has no modal, dialog or lightbox ([GOV.UK][govuk]) (d): nothing to use.

### 3.6 Icons and wording

| Set | Grow / shrink an element | Full screen | Open elsewhere |
| --- | --- | --- | --- |
| Lucide (used here) | `maximize-2` / `minimize-2`, diagonal arrows, tagged "arrows" (d) | `maximize` / `minimize`, corners, tagged "fullscreen" / "exit fullscreen" (d) | `external-link` (k) |
| Material Symbols | `open_in_full` / `close_fullscreen`, "diagonal arrows", "expand", "collapse" (d) | `fullscreen` / `fullscreen_exit` (d) | `open_in_new`, "new window", "tab" (d) |
| Atlassian | `grow-diagonal` / `shrink-diagonal`, reserved for resizing "modals, panels, media, or objects" (d) | `fullscreen-enter` / `fullscreen-exit`, "full screen videos or objects" (d) | `link-external`, "links that open up a new tab" (d) |

Sources: [Lucide maximize-2][lucide-max2], [Lucide maximize][lucide-max], [Material Symbols][gfonts-icons], [ADS
icons][ads-icons].

Wording in products: Notion shows only the `⤡` glyph ([databases][notion-db]); Jira says "Full screen icon" and
"Enter full screen" / "Exit full screen" ([preview][jira-preview], [board][jira-board]); Linear "the expand button"
and "Full Screen view" ([Insights][linear-insights]); Outlook "View full event in new window" ([My Day][ol-myday]);
Todoist "Open in new window" ([task view][todoist-view]) (all d). The planner already has `expand` / `collapse`
("Развернуть" / "Свернуть") and a hint per view ("Calendar across the whole window: …"). "Full screen" is taken by
the browser's full screen, so the event button should say Expand, with a hint that says what it does.

## 4. Accessibility and platform behaviour of a `<dialog>` that changes size

### 4.1 What the platform does, and what it does not

- `showModal()` blocks the document "by the modal dialog", which makes the rest inert, adds the dialog to the top
  layer, stores the "previously focused element" and runs the dialog focusing steps: the `autofocus` element, else
  the first focusable descendant, else the dialog. `close()` runs "the focusing steps for" the previously focused
  element "without scrolling" ([HTML dialog][whatwg-dialog]) (d). The spec advises: "authors should use the
  `autofocus` attribute on the descendant element of the dialog that the user is expected to immediately interact
  with"; MDN adds "it is recommended to add `autofocus` to the close button … or the dialog itself" when nothing
  else is more immediate ([HTML dialog][whatwg-dialog], [MDN dialog][mdn-dialog]) (d).
- Those steps run on show and close only. Changing classes, width or position of an open dialog fires no event and
  moves no focus (d, reading of the algorithms on [HTML dialog][whatwg-dialog]): growing the dialog keeps focus
  where it was, which is what APG wants for the toggle (4.3).
- The spec on scrolling: "in general, scrollable dialogs are not expected by users. Adding large text nodes
  directly to dialog elements is particularly bad as this is likely to cause the dialog element itself to
  overflow"; its example puts the long text in an inner `overflow: auto` element ([HTML dialog][whatwg-dialog])
  (d).

### 4.2 Toggle button or action button

- APG: a toggle is "A two-state button that can be either off (not pressed) or on (pressed)", marked with
  `aria-pressed`; "it is critical the label on a toggle does not change when its state changes" ([APG
  button][apg-button]) (d). So either a fixed name ("Expand") with `aria-pressed`, or a name that swaps ("Expand" /
  "Collapse") without `aria-pressed`, not both.
- WCAG 4.1.2 asks that states "can be programmatically set; and notification of changes to these items is available
  to user agents, including assistive technologies", and names toggle buttons among its examples ([WCAG
  4.1.2][wcag-nrv]) (d). `aria-pressed` is that state; a swapped name is a property change that screen readers
  announce unevenly on a focused button (k).
- `aria-expanded` is for a control that shows or hides another element (k); here nothing is shown or hidden, so it
  does not fit.

### 4.3 Where focus goes after the toggle

APG: for an action that does not dismiss the context, "focus usually stays on the button"; for a dialog that opens,
"the focus moves inside the dialog"; for one that closes, it returns to the opener ([APG button][apg-button]) (d).
The expand toggle is the first case: focus stays on it. That holds only if the button is the same DOM node in both
states; a re-mounted button drops focus to the document (k).

### 4.4 What a screen reader hears

On the toggle: its name, "toggle button", and the new state, "pressed" / "not pressed" (d, the Mute example in [APG
button][apg-button]). The dialog's name and role do not change, and nothing announces the new size (k); no live
region is needed for a change the person just made with the focused control (k).

### 4.5 Esc

- A close request on desktop is the Esc keydown. "If the web developer cancels the event by calling
  `preventDefault()`, then nothing further happens. But if the event fires without being canceled, then the user
  agent proceeds to process close watchers" ([close requests][whatwg-close]) (d).
- The dialog's close watcher fires `cancel`, cancelable only when the window has history-action activation; a
  canceled request consumes it, so "requesting to close a close watcher twice without any intervening user
  activation will result in canPreventClose being false the second time" ([close requests][whatwg-close]) (d). Esc
  itself never grants activation: keydown counts "provided the key is neither the Esc key nor a shortcut key
  reserved by the user agent" ([activation][whatwg-activation]) (d). MDN says the same in plain words ([MDN
  cancel][mdn-cancel]) (d).
- So "Esc shrinks first, then closes" can be built only by taking Esc from the platform on `keydown`; through
  `cancel` it would work or not depending on what the person last clicked (d, from the two points above). With two
  open modal dialogs, Esc closes "only the last shown dialog" ([MDN dialog][mdn-dialog]) (d); an expanded dialog is
  still one layer, so one Esc closes it. APG: "Escape: Closes the dialog" ([APG dialog][apg-dialog]) (d).

### 4.6 `closedby` and the backdrop

- `closedby="any"`: "Close requests or clicks outside close the dialog"; `closerequest`: close requests only;
  `none`: no user action. Missing or invalid means Auto: Close Request for `showModal()`, otherwise None ([HTML
  dialog][whatwg-dialog]) (d). The state is read when a request or click happens (the close watcher's "get enabled
  state" and light dismiss both read the computed state), so changing the attribute on an open dialog takes effect
  (d, reading of the algorithms on [HTML dialog][whatwg-dialog]).
- Support ([browser-compat-data][bcd-dialog]) (d): `closedby` Chrome 134, Firefox 141, Safari 27.3 (beta today;
  27.2 is current). Chrome before 154 and Firefox: "touch events on the backdrop with `closedby="any"` propagate to
  elements behind the dialog instead of being cancelled". `requestClose()` Chrome 134, Firefox 139, Safari 18.4
  ([HTMLDialogElement][bcd-hde]) (d). `Modal`'s hand-made backdrop click for Safari is still needed.
- `::backdrop` styles the layer behind a modal dialog, "to blur, darken, or otherwise obfuscate the inert content"
  ([MDN dialog][mdn-dialog]) (d).

### 4.7 Scroll position

No first-party page covers the scroll position of a dialog that changes width. A wider box re-wraps the text, so
the same `scrollTop` shows other lines (k). Keeping the header and button row out of the scrolling area
(Atlassian's full-screen rule, 3.3) keeps the toggle and ✕ visible whatever the body's scroll is, and resetting the
body to the top on toggle is the predictable choice (k).

### 4.8 Motion

- The size change is motion animation by WCAG's definition ("changes size while appearing"), so it must be possible
  to turn off ([WCAG 2.3.3][wcag-anim]) (d). Opacity and colour are excluded from the definition; blurring was
  excluded and no longer is (erratum) (d, same page).
- MDN's open/close recipe (`@starting-style`, `display` and `overlay` with `transition-behavior: allow-discrete`)
  covers appearing and disappearing, not a size change of an open dialog ([MDN dialog][mdn-dialog]) (d). Width
  between two lengths transitions as usual (k); a height from `auto` needs `interpolate-size`, which Chrome has
  since 129, Firefox does not, Safari only in preview ([browser-compat-data][bcd-interp]) (d).
  `document.startViewTransition()` is in Chrome 111, Firefox 144, Safari 18 ([browser-compat-data][bcd-doc]) (d);
  whether a dialog in the top layer animates cleanly from its anchored spot to the centre through a view transition
  is not verified (k).

### 4.9 Reflow and obscured focus

- WCAG 1.4.10: content must work "without requiring scrolling in two dimensions" at "a width equivalent to 320 CSS
  pixels"; sticky content: "It is strongly suggested that at smaller viewport sizes that such components are
  modified to have static positioning" ([WCAG 1.4.10][wcag-reflow]) (d).
- WCAG 2.4.11: "A properly constructed modal dialog will always pass this SC", but "sticky footers, sticky headers"
  are named as content that can cover a focused item ([WCAG 2.4.11][wcag-fno]) (d). The dialog's sticky button row
  must not hide a focused link in the description; scroll padding is one of the listed fixes (d, same page).

## 5. URL state

- **Products.** Pages have URLs; dialog modes mostly do not. Google's details page (k) and Linear's issue view
  ("unique URL", d, [issues][linear-issues]) are routes; Linear's peek has no URL (k); Notion encodes the peek mode
  in `pm=` (k); Jira's board opens items with `selectedIssue=` (k); Todoist and Notion offer "Copy link to task"
  and an item "anchor link" without saying in which mode the link opens (d, [task view][todoist-view],
  [databases][notion-db]).
- **Guidance.** Primer: think hard before making a dialog linkable, as above (d, [guidelines][primer-guide]).
  TanStack Router, the router used here, puts state in the URL so people can open a link in a new tab "and reliably
  see the state they expected", bookmark and share it, and refresh or go back and forward without losing it
  ([search params][tanstack-search]) (d). The event already has all of that through `?event=`; the size adds
  nothing another reader needs.
- **Here.** `onSearchChange` in `apps/web/src/routes/index.tsx` navigates without `replace`, so every change of the
  search adds a history step (Back closes an open event today). A size key in the URL would make each toggle a Back
  step too, and the name `expanded` is taken by the calendar's Expand (`PlannerSearch.expanded`).

## 6. What could not be verified

- Google Calendar: what the click-opened event card shows beyond the screen-reader guide's list, and the details
  page's URL (k).
- Outlook on the web and new Outlook: the pointer path from a selected event to the full event (card, button names,
  whether it opens in place or in a window); only the keyboard path and My Day are documented. The pop-out icon
  page is for the old Outlook Web App.
- Apple Calendar: what the default popover and the inspector look like, and the iPhone and iPad flow.
- Notion: the `p=` / `pm=` URL parameters (k); how a peek closes; whether Notion Calendar has any expand control
  (none documented).
- Linear: how the full issue opens from a list (Enter) and returns (Esc) (k); whether a peek changes the URL (k).
- Todoist: whether the web task view is a modal or a panel, and the "full screen" a quoted user mentions on its
  marketing page; Esc behaviour.
- Things 3: whether an open to-do grows inside the list or over it (k); its URL scheme was not read.
- Jira: whether the board's dialog or sidebar has an "open as full page" control; `selectedIssue` (k).
- Trello: any way to enlarge the card back.
- Material Design 3: the dialog guidelines page did not render; its compact-only rule is (s).
- Screen readers' announcement of a focused button whose name changes (k); a view transition of a top-layer dialog
  between an anchored and a centred position (k).

## 7. Fit with this codebase

- **`Modal` (`packages/ui/src/modal.tsx`) needs little.** Its `size` and `anchor` props are read on every render:
  `useLayoutEffect` calls `placeBeside` after each render, and `placeBeside(dlg, null)` clears the inline `margin`,
  `left` and `top`, so the `m-auto` centring takes over; the backdrop class switches to the darker, blurred one
  when `anchor` is absent. Passing `anchor={expanded ? undefined : anchor}` and a bigger `size` from `EventDialog`
  is enough to get "large, centred, page dimmed". What `Modal` may gain:
  - a scrolling body inside the dialog instead of `overflow-y-auto` on `<dialog>` itself, at least for the big
    size, so the header and `FOOT` stay put (HTML spec advice, Atlassian's full-screen rule; 4.1, 3.3);
  - a transition for the size and backdrop change under `prefers-reduced-motion: no-preference` only, next to the
    existing `.lc-layer` rules in `theme.css`; under `reduce` an instant switch or an opacity cross-fade (4.8). The
    jump from the anchored spot to the centre cannot be a CSS transition (`left`/`top` in px to `margin: auto`); a
    view transition or a measured (FLIP) animation would be needed (k);
  - perhaps a size between `wide` (760 px) and `full` (1120 px × full height) for reading: `full` fits "the page
    out of the way", but a short description in a full-height box is mostly empty. The owner's call; Atlassian's
    named sizes stop at 968 px (3.3).
- **`EventDialog` (`modules/planner/src/features/edit-event/ui/EventDialog.tsx`) owns the toggle.** One icon button
  in the title row, before ✕, rendered in both states as the same element: `Maximize2` / `Minimize2`,
  `aria-pressed`, a fixed accessible name (`m.expand()`), a hint in `data-tip` (the tooltip is `aria-hidden`, so it
  does not repeat the name). In the expanded state: larger `TITLE`, the description `pre` at a larger size with a
  capped line length, the course and module links easier to hit; same buttons, same order. `EventForm` (editing)
  should work in both sizes. A new hint string goes into all three `packages/i18n/messages/*.json` files; `pnpm run
  check:i18n`.
- **`ScreenButtons` (`packages/ui/src/screen-buttons.tsx`)** swaps the label between Expand and Collapse while also
  setting `aria-pressed`, which APG rules out (4.2). Fixing it and the new button the same way keeps one meaning
  for "Expand" across the app; the existing pressed styling (`aria-pressed:bg-ink`) already shows the state to
  sighted people.
- **Remembered per browser, like the wide layout's panels.** A small hook next to `EventDialog` on the pattern of
  `use-wide-panels.ts` (`learning-curve:wide-panels`, read after mount, guarded `try`): e.g.
  `learning-curve:event-expanded`. One catch: an event opened from a link (`?event=` on load) would open small and
  then grow when the stored value arrives; apply the stored value before `showModal()` runs, or skip the animation
  on that first open.
- **Not in the URL.** `?event=<uid>` stays the only event state in `PlannerSearch`; "Copy link" keeps copying it.
  If a link that opens straight into the large view is ever wanted, the one-shot `open` key ("A dialog to open on
  arrival", `PlannerSearch.open`) is the precedent, not a new persistent key, and `expanded` is already the
  calendar's.
- **Esc unchanged.** The native close request closes the dialog in either size and `onClose` already resets
  editing, errors and offers; the remembered size is left as it is. Do not intercept `cancel` (4.5).
- **Backdrop.** Keep `closedby="any"` in the read view; consider `closerequest` while `EventForm` is open, in both
  sizes (Primer, 3.4). Changing the attribute on the open dialog works (4.6); `backdropClick`'s Safari fallback
  would need the same condition.
- **Narrow windows.** Below `ANCHOR_FROM` (768 px) the dialog is already centred and `min(560px, 100vw − 32px)`
  wide: hide the toggle there, or make the big size fill the screen. Check 320 CSS px: the description already
  wraps (`whitespace-pre-wrap`, `wrap-anywhere`) and the footer wraps (`flex-wrap`); the sticky footer is the thing
  to watch (1.4.10, 2.4.11).
- **Focus page.** The expanded dialog is for reading the event; timing it stays on `/focus`, reached by the
  existing Timer button in the footer.
- **Stories and checks.** `EventDialog.stories.tsx` and `modal.stories.tsx` would get an expanded case (focus stays
  on the toggle after Enter; Esc closes from the big size); then `pnpm run check`.

## 8. Sources

Google: [Calendar shortcuts][gcal-keys] · [create and edit an event][gcal-create] · [screen reader][gcal-sr].
Microsoft: [Outlook calendar with a screen reader][ol-sr] · [My Day][ol-myday] · [Calendar peek][ol-peek] ·
[Outlook Web App][owa-start] · [Fluent 2 dialog][fluent-dialog]. Apple: [events in separate windows][apple-windows]
· [add, modify, delete events][apple-events] · [Calendar shortcuts][apple-keys] · [HIG popovers][hig-popovers] ·
[HIG sheets][hig-sheets] · [HIG modality][hig-modality]. Notion: [Calendar events][ncal-events] · [Calendar with
Notion][ncal-notion] · [Calendar shortcuts][ncal-keys] · [Calendar getting started][ncal-start] ·
[views][notion-views] · [peek release][notion-peek] · [databases][notion-db] · [shortcuts][notion-keys]. Linear:
[custom views][linear-views] · [board layout][linear-board] · [issues][linear-issues] · [Insights][linear-insights]
· [improved peek][linear-peek-cl] · [llms.txt][linear-llms]. Todoist: [task view][todoist-view] · [new task
view][todoist-new] · [2026 changelog][todoist-cl]. Cultured Code: [Mac shortcuts][things-keys] · [Quick
Entry][things-qe] · [features][things-features]. Atlassian: [Jira board view][jira-board] · [Jira
preview][jira-preview] · [side panel][atl-sidepanel] · [Trello card back][trello-back] · [modal usage][ads-modal] ·
[modal examples][ads-modal-ex] · [modal code][ads-modal-code] · [modal widths source][ads-modal-src] · [full-screen
modal source][ads-fullscreen-src] · [icon metadata][ads-icons]. Material and Android: [M3 dialogs (s)][m3-dialogs]
· [material-components-android dialogs][mdc-dialog] · [Android dialogs][android-dialogs] · [Material Symbols
metadata][gfonts-icons]. GitHub Primer: [Dialog][primer-dialog] · [Dialog guidelines][primer-guide]. GOV.UK:
[components][govuk]. Lucide: [maximize-2][lucide-max2] · [maximize][lucide-max]. Standards: [HTML
dialog][whatwg-dialog] · [close requests and close watchers][whatwg-close] · [activation-triggering input
events][whatwg-activation] · [MDN dialog][mdn-dialog] · [MDN cancel event][mdn-cancel] · [BCD dialog][bcd-dialog] ·
[BCD HTMLDialogElement][bcd-hde] · [BCD interpolate-size][bcd-interp] · [BCD Document][bcd-doc] · [APG dialog
(modal)][apg-dialog] · [APG button][apg-button] · [WCAG 1.4.10][wcag-reflow] · [WCAG 2.3.3][wcag-anim] · [WCAG
2.4.11][wcag-fno] · [WCAG 4.1.2][wcag-nrv]. Router: [TanStack Router search params][tanstack-search].

[gcal-keys]: https://support.google.com/calendar/answer/37034?hl=en
[gcal-create]: https://support.google.com/calendar/answer/72143?hl=en&co=GENIE.Platform%3DDesktop
[gcal-sr]: https://support.google.com/calendar/answer/6101541?hl=en&co=GENIE.Platform%3DDesktop
[ol-sr]: https://support.microsoft.com/en-us/office/basic-tasks-using-a-screen-reader-with-the-calendar-in-outlook-857e6fd5-72b0-409d-973d-c8dc6b77a817
[ol-myday]: https://support.microsoft.com/en-us/office/use-my-day-with-to-do-in-outlook-6de6ee52-751b-4405-b389-850572b15306
[ol-peek]: https://support.microsoft.com/en-us/outlook/keep-upcoming-appointments-and-meetings-always-in-view
[owa-start]: https://support.microsoft.com/en-us/outlook/getting-started-in-outlook-web-app
[fluent-dialog]: https://fluent2.microsoft.design/components/web/react/core/dialog/usage
[apple-windows]: https://support.apple.com/guide/calendar/view-events-in-separate-windows-icl28064/mac
[apple-events]: https://support.apple.com/guide/calendar/add-modify-or-delete-events-icalwr13-events/mac
[apple-keys]: https://support.apple.com/guide/calendar/keyboard-shortcuts-ical002/mac
[hig-popovers]: https://developer.apple.com/design/human-interface-guidelines/popovers
[hig-sheets]: https://developer.apple.com/design/human-interface-guidelines/sheets
[hig-modality]: https://developer.apple.com/design/human-interface-guidelines/modality
[ncal-events]: https://www.notion.com/help/manage-your-calendars-and-events
[ncal-notion]: https://www.notion.com/help/use-notion-calendar-with-notion
[ncal-keys]: https://www.notion.com/help/notion-calendar-keyboard-shortcuts
[ncal-start]: https://www.notion.com/help/guides/getting-started-with-notion-calendar
[notion-views]: https://www.notion.com/help/views-filters-and-sorts
[notion-peek]: https://www.notion.com/releases/2022-07-20
[notion-db]: https://www.notion.com/help/intro-to-databases
[notion-keys]: https://www.notion.com/help/keyboard-shortcuts
[linear-views]: https://linear.app/docs/custom-views
[linear-board]: https://linear.app/docs/board-layout
[linear-issues]: https://linear.app/docs/creating-issues
[linear-insights]: https://linear.app/docs/insights
[linear-peek-cl]: https://linear.app/changelog/2019-09-23-improved-peek
[linear-llms]: https://linear.app/llms.txt
[todoist-view]: https://www.todoist.com/help/todoist/features/use-the-task-view-to-manage-tasks-in-todoist-eDeRDO0C
[todoist-new]: https://www.todoist.com/inspiration/todoist-new-task-view
[todoist-cl]: https://www.todoist.com/help/todoist/product-updates/2026-changelog-HD3jJAtLd
[things-keys]: https://culturedcode.com/things/support/articles/2785159/
[things-qe]: https://culturedcode.com/things/support/articles/2249437/
[things-features]: https://culturedcode.com/things/features/
[jira-board]: https://support.atlassian.com/jira-software-cloud/docs/customize-your-view-of-the-board-and-backlog/
[jira-preview]: https://support.atlassian.com/jira-software-cloud/docs/preview-work-items-in-jira-search-and-the-list-view/
[atl-sidepanel]: https://support.atlassian.com/jira-software-cloud/docs/view-content-in-a-side-panel/
[trello-back]: https://support.atlassian.com/trello/docs/new-card-back/
[ads-modal]: https://atlassian.design/components/modal-dialog/usage
[ads-modal-ex]: https://atlassian.design/components/modal-dialog/examples
[ads-modal-code]: https://atlassian.design/components/modal-dialog/code
[ads-modal-src]: https://cdn.jsdelivr.net/npm/@atlaskit/modal-dialog@17.3.3/dist/es2019/internal/width.js
[ads-fullscreen-src]: https://cdn.jsdelivr.net/npm/@atlaskit/modal-dialog@17.3.3/dist/es2019/full-screen.js
[ads-icons]: https://cdn.jsdelivr.net/npm/@atlaskit/icon@38.2.0/dist/es2019/metadata-core.js
[m3-dialogs]: https://m3.material.io/components/dialogs/guidelines
[mdc-dialog]: https://github.com/material-components/material-components-android/blob/master/docs/components/Dialog.md
[android-dialogs]: https://developer.android.com/guide/topics/ui/dialogs
[gfonts-icons]: https://fonts.google.com/metadata/icons?incomplete=1&key=material_symbols
[primer-dialog]: https://primer.style/product/components/dialog/
[primer-guide]: https://primer.style/product/components/dialog/guidelines/
[govuk]: https://design-system.service.gov.uk/components/
[lucide-max2]: https://github.com/lucide-icons/lucide/blob/main/icons/maximize-2.json
[lucide-max]: https://github.com/lucide-icons/lucide/blob/main/icons/maximize.json
[whatwg-dialog]: https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element
[whatwg-close]: https://html.spec.whatwg.org/multipage/interaction.html#close-requests-and-close-watchers
[whatwg-activation]: https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event
[mdn-dialog]: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
[mdn-cancel]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/cancel_event
[bcd-dialog]: https://github.com/mdn/browser-compat-data/blob/main/html/elements/dialog.json
[bcd-hde]: https://github.com/mdn/browser-compat-data/blob/main/api/HTMLDialogElement.json
[bcd-interp]: https://github.com/mdn/browser-compat-data/blob/main/css/properties/interpolate-size.json
[bcd-doc]: https://github.com/mdn/browser-compat-data/blob/main/api/Document.json
[apg-dialog]: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
[apg-button]: https://www.w3.org/WAI/ARIA/apg/patterns/button/
[wcag-reflow]: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
[wcag-anim]: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
[wcag-fno]: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
[wcag-nrv]: https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
[tanstack-search]: https://tanstack.com/router/latest/docs/framework/react/guide/search-params
