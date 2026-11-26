# Wide layout: show Next and Insights on demand

Status: design, 2026-11-26. First of two steps; the second is a Compact layout.

## Why

On the Plan page the blocks above the calendar take most of the screen: at 1440×900 the week grid starts at 507px
and gets 344px, and the Insights card shows 80px of its 514px. Expand (code: `expanded`, "wide" on Dashboard and
Focus) solves the height by hiding the header, the runway and the whole side column. That takes away Next and
Insights too, which are still wanted while working in the full-width calendar.

The page is heading for three layouts on one control, each giving the calendar more room: Regular (today),
Compact (every block kept, condensed to one line), Wide (today's Expand). This step only changes Wide.

## Goals

- In Wide, Next and Insights can each be shown or hidden, independently.
- Shown panels sit in the same 280px right column as in Regular; the calendar takes the rest of the width.
- With only Insights shown it fills the column to the bottom of the window (about 650px at 1440×900).

## Non-goals

- The header and the runway stay hidden in Wide.
- Regular is unchanged: it always shows both panels.
- Dashboard and Focus keep their Expand as it is.
- The Regular | Compact | Wide control: it comes with Compact. Until then the Expand button stays.

## Anti-goals

- Wide looking different from today for someone who never touches the new switch.
- A second, competing way to hide panels, or a switch that does nothing on the screen it is offered on.

## Approaches

- **A. One panel button with a menu of two switches** (chosen). A button with a side-panel icon in the toolbar's
  view group, next to Collapse and Fullscreen, opens a menu: `✓ Next`, `✓ Insights`. The `⋮` menu already supports
  switches that keep the menu open; its trigger only needs to accept another icon. Adds one control to a toolbar
  that Compact will have to shrink next.
- B. Two pressed-state buttons, like Work week and 24h: one click and the state is visible, but the second toolbar
  row grows to eight controls and wraps at 1280px.
- C. A close button on each panel plus one "Side panel" button: no extra toolbar room, but bringing back one panel
  while keeping the other closed is awkward.

## Design

- **Default**: both hidden, so Wide is today's Wide until a panel is turned on.
- **Remembered** in this browser (localStorage), not in the URL: "in Wide I want Insights" is a preference, like
  Icons only or the second time zone. Read after mount, as those are; a reload in Wide may show the column appear a
  moment later.
- **Fullscreen** uses the Wide layout, so it shows the same panels.
- **Where the switches are**: the panel button in the toolbar (shown only in Wide, from `md` up, like the other view
  buttons), and the same two switches in the `⋮` menu and the command search, listed only in Wide. No shortcut keys.
- **Below `lg`** the side column follows the Regular one-column rules (Next above the calendar, Insights after it).
- The week budget line stays in the pinned toolbar even when Insights is shown: Insights may be on another tab.

## Left to the builder

- The hook's name and place (page model of the planner), the storage key, the icon (`PanelRight` from Lucide).
- The `icon` prop on `Menu` in `@lc/ui`, defaulting to the current `⋮`.
- Messages in ru, en, es: the button's name and the two switch labels.
- A story for Wide with panels shown, and tests in the style of the existing page stories.
