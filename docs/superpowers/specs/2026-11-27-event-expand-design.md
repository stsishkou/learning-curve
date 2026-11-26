# Event popup: an Expand button for a focused view

Status: design, 2026-11-27. Research: `docs/event-expand-research.md`.

## Why

On a wide window the event popup opens beside the event it shows, over a faint backdrop, so the grid stays readable.
That suits a glance, not reading or working on one event: the owner wants a button on the popup that shows the same
event large and centred, with the page out of the way, "to see the event on screen and be focused".

## Goals

- A toggle in the popup's title row, beside ✕, that switches between the popup beside the event and a larger,
  centred view over a dimmed, blurred page.
- The larger view is a reading layout of the same content: nothing added, nothing removed, same buttons in the same
  order.
- The choice is remembered in this browser: once expanded, every event opens expanded until it is collapsed again.

## Non-goals

- New content in the expanded view (other sessions of the course, progress, notes).
- A page or route of its own for an event, or a docked side panel.
- The new-event form: it stays beside its draft block, which previews the event on the grid while it is filled in.
- Changing the calendar's Expand button (`ScreenButtons`); its label swap is a separate fix (research §4.2).
- Keeping a backdrop click from closing the edit form (research §3.4): it applies to both sizes, so it is its own
  change.

## Anti-goals

- The expanded view feeling like a different dialog: a second layer, a page change, or buttons that move around.
- Esc needing two presses to close.
- A link that opens differently for whoever receives it.

## Approaches

- **A. Grow the same dialog** (chosen). While expanded, `EventDialog` gives `Modal` no `anchor` and a bigger `size`;
  `Modal` already centres an unanchored dialog and switches to the darker, blurred backdrop. Small, and it is the
  pattern of Notion's center peek and Jira's centred issue dialog.
- B. An event page of its own, like Google Calendar's details page: a new route, a full page change away from the
  grid, more than was asked for.
- C. A docked side panel, like Notion's side peek: it would compete with Next and Insights in the wide layout.

## Design

```
small, beside the event                     expanded, centred, page dimmed and blurred
┌──────────────────────────────┐            ┌─────────────────────────────────────────────┐
│ CS50 — Week 3       ⤢  ✕     │            │ CS50 — Week 3: Algorithms            ⤡  ✕   │
│ ● CS50, Tue 10:00–11:30      │            │ ● CS50, Tue 10:00–11:30                     │
│ ┌──────────────────────────┐ │            │ ┌─────────────────────────────────────────┐ │
│ │ https://cs50…            │ │            │ │ https://cs50.harvard.edu/x/…            │ │
│ └──────────────────────────┘ │            │ │ Goal: …                                 │ │
│ 🗑 ⧉ ✂ ⏱ 🔍 🔗   Done  Edit   │            │ └─────────────────────────────────────────┘ │
└──────────────────────────────┘            │ 🗑 ⧉ ✂ ⏱ 🔍 🔗             Done  Edit       │
                                            └─────────────────────────────────────────────┘
```

- **The button**: one icon button before ✕, the same element in both states. Icon `Maximize2` when small,
  `Minimize2` when expanded, the diagonal arrows the calendar's Expand already uses (corners stay for full screen).
  `aria-pressed` carries the state and the accessible name stays `Expand` in both states (APG: a toggle's label
  does not change); the tooltip explains it. Focus stays on the button after a press.
- **Size**: `wide` (760px), height to fit the content up to the window. My call: the description is a URL or two
  and a 1–3 line goal, so `full` (1120px × full height) would be mostly empty; centring, the blurred page and the
  larger type do the focusing. One line to change if it reads too small.
- **Reading layout when expanded**: title 22px, the description at 15.5px with lines capped at about 75 characters,
  the title row sticks at the top like the button row already sticks at the bottom, so only the body scrolls.
- **Editing**: Edit keeps the current size; in the expanded view the description field starts taller.
- **Remembered** in this browser (localStorage), not in the URL, read after mount like the wide layout's panels. An
  event opened from a `?event=` link on load must not visibly open small and then grow.
- **Narrow windows** (below 768px, where the popup is already centred and nearly full width): the button is hidden
  and the popup stays as it is today, whatever is remembered.
- **Esc and the backdrop** close the dialog from either size, as today; collapsing is the button's job. Closing
  keeps the remembered choice.
- **Motion**: the dialog's existing open fade and scale stay. The jump from beside the event to the centre is not
  animated (it cannot be a CSS transition); under reduced motion nothing new moves either.

## Left to the builder

- The hook's name and place (the edit-event feature's `model` segment), the storage key
  (`learning-curve:event-expanded` fits the existing `learning-curve:wide-panels`).
- How the stored choice reaches the dialog before `showModal()` on a page opened from a link.
- Messages in ru, en, es: reuse `expand` for the name if its wording fits a dialog, plus a new hint for the tooltip.
- Story cases in `EventDialog.stories.tsx`: expanded read view, expanded edit form, focus kept on the toggle.
