# One bar across the top of every page

## Why

Switching between Plan, Timeline, Focus and Progress made the top of the page jump. Each page drew its own header,
so the header's height, the place of the section tabs and the place of the shared buttons depended on that page's
title, the text under it and its own buttons. Measured at 1440 px wide before the change:

| | Plan | Timeline | Focus | Progress |
|---|---|---|---|---|
| Header height | 119 | 146 | 112 | 68 |
| Page edges | 95–1335 | 15–1415 | 95–1335 | 95–1335 |
| Tabs start at (x, y) | 313, 17 | 690, 44 | 610, 10 | 457, 11 |
| Expand + Full screen | toolbar, y 440 | chart card, x 737 | timer card, x 661 | under the header, y 84 |

At about 1100 px the Plan header broke: the plan name was squeezed to one letter per line and the header grew to
241 px. Controls used once in a while (the language, icons only, help marks, the component stand, the guide) took a
row of every page, the theme had no visible control at all, and on the Plan page Integrations, icons only and help
were each in three places.

## Goals

- The bar looks the same and sits in the same place on every page: same height, same width, every button in the
  same spot. Nothing in it depends on the page.
- Only what every page uses is in it: the section tabs, Expand and Full screen, and one menu for the rest.
- What one page needs goes into that page.
- Less height for the top of the page, on a phone too.

Non-goals: the docs site (`apps/docs`) keeps its own header (`PageHeader`); the expanded and full-screen layouts keep
the controls they have today.

## Decisions (agreed)

- **One bar, rendered once by the app shell** above every route: `[tabs] … [Expand] [Full screen] [⚙]`, one row,
  the pages' width. In the expanded view and in full screen the bar goes away, as the page headers did, and each page
  shows Collapse and Exit full screen in its own top row, where it shows them today.
- **⚙ menu, the same on every page**: language, theme (system, light, dark), icons only, help marks, then the links
  to the component stand and to the guide ("Как это сделано").
- **Page titles go**: the highlighted tab names the page. Each page keeps a heading for screen readers.
- **Plan page**: the plan's name and summary move into the page; "Файл плана" and "Интеграции" move into the
  toolbar's `⋮` menu, and the dot that marks an integration waiting for the person moves onto `⋮`.
- **Timeline's how-to paragraph and Focus's hint line** go behind the help marks (`Hint`), which already carry the
  same text at more length.

## Calls made while building (for review)

- **The bar belongs to the app, not the pages.** Rendered once in the root route, it cannot differ between pages
  and does not remount on navigation. The modules lose their `headerAside` slot; the app reads `expanded` from the
  URL, which every route already keeps, and switches it like the pages do.
- **The plan's name is a row above the deadline card, not inside it.** The card is absent on a read-only plan
  without a deadline, and the name would go with it.
- **Every page is 1240 px wide.** Timeline was 1400 px since its first commit, with no reason recorded; Expand still
  gives it the whole window.
- **Icons only and help marks stay in the Plan page's `⋮` menu and its palette.** In the expanded calendar the bar
  is gone and `⋮` is the only way to them.
- **⚙ is a small panel, not a menu**: two segmented choices and two switches read better than ten menu rows. A press
  on a link or on a button that is not a switch closes it, as `Menu` does.
- **Full screen counts as available on the server.** The bar would otherwise grow a button after hydration and push
  Expand and ⚙ sideways on every load; a browser that cannot fill the screen drops it after hydration instead.
- **On a phone** the bar is the same row; the tabs scroll sideways and Expand and Full screen show only their icons.
- The Expand tooltips no longer mention "заголовок и навигация" separately: they say the top bar goes.
