# A pixel hourglass on the Focus page: drawing, keeping time, ending, accessibility, settings

Fetched 2026-11-24, 05:19–05:42 UTC (08:19–08:42 Europe/Minsk). Only first-party sources were used: the WHATWG HTML
standard, W3C and CSSWG specs and WCAG 2.2 Understanding pages, MDN, Chrome for Developers, chromestatus, web.dev,
the WebKit blog, MDN's browser-compat-data JSON (`main` at `2f696a2`, 2026-11-23), source code on GitHub (Sandspiel at
`9936e06`, Dusty at `9af9a58`), a Hackaday.io project page, vendors' help pages and App Store listings, and Francesco
Cirillo's own paper on the Pomodoro Technique (v1.3, read from a copy hosted by the University of Maryland iSchool).
Specs too long for the fetch tool (HTML event loop, WAI-ARIA 1.2, Media Queries 5, CSS Color 5, CSS Variables 2) were
downloaded and searched locally. The sand algorithm in 8.7 was prototyped in the scratchpad, run under Node 26 and
type-checked with this repository's `tsconfig.base.json`; nothing in the repository was changed. Every claim is
followed by the page it was read from; claims about this repository cite the file.

The question, in the owner's words: "The Focus tab should have a great sand box [an hourglass] on the page besides the
timer. I would expect a pixel-like animation. The timer should be configurable. Currently we have a timer [a stopwatch
that counts up], but the sand box is a countdown." So: a pixel-art animated hourglass that counts down a configurable
duration, shown on the Focus page next to the existing count-up stopwatch. How should it be drawn, how should it keep
time, how should it end, how is it made accessible, how do people set it, and how does it live with the stopwatch and
the 25 + 5 / 50 + 10 breaks?

Legend: **(d)** = documented on the linked first-party page, read here; **(s)** = the page could not be read, the
claim comes from a search engine's copy of it or from a third party; **(k)** = my general knowledge, not
re-verified. Treat (s) and (k) as leads. Section 11 lists what could not be verified.

## 1. Recommendations, ranked

1. **Draw on a Canvas 2D at the glass's own pixel grid** (about 19 × 35 cells), scaled up by a whole number of
   device pixels with `image-rendering: pixelated`. This is MDN's technique for crisp pixel art
   ([MDN][mdn-crisp]); `pixelated` scales by nearest neighbour to the nearest whole multiple
   ([MDN][mdn-image-rendering]) and is supported in Chrome 41, Firefox 93 and Safari 10 ([BCD][bcd-image-rendering]).
   SVG with `shape-rendering: crispEdges` is the runner-up; CSS sprite sheets and a live simulation lose (2.1).
2. **Run the falling-sand rules once, ahead of time, and keep only when each cell empties or fills.** Every frame
   is then a pure function of "grains passed = ⌊grains × time run ÷ length⌋". The sand is tied to the clock, not to
   frames, so a reload, a hidden tab or a sleeping laptop needs no catching up (2.4, sketch in 8.7). Prototyped: 4 ms
   to build, about 3 µs to compute a frame (8.7).
3. **One clock.** The glass reads the stopwatch's `elapsed`, which already survives reloads and sleep because it
   keeps an epoch start, not a count (`use-stopwatch.ts`). Start, Pause, Reset and Finish then act on both, and the
   two can never disagree. Show the glass's time in whole minutes under it, so only the stopwatch ticks in seconds
   (8.4).
4. **The glass is the break rhythm made visible.** Replace the Breaks control (`None / 25 + 5 / 50 + 10`) with a
   Glass control: `Session · 25 + 5 · 50 + 10 · Custom` (work + rest minutes). The sand runs out at the moment a
   break is due. Taking the break turns the glass over for the rest, and "Back to work" turns it again. Products
   keep work and break lengths in one setting too (section 6). The choice is per browser in `localStorage`, like the
   rhythm today. This needs the owner's yes (9.1, 9.2).
5. **Persist the run, not only the stopwatch.** Today `handled` and `restUntil` in `use-breaks.ts` live only in
   React state. After a reload, a break that was skipped shows as due again, and a break in progress loses its
   countdown (3.5). The glass needs both to redraw correctly after a reload.
6. **End with a sound that can actually play.** Create (or `resume()`) one `AudioContext` in the Start click and
   reuse it. The current `chime()` makes a new context from an effect or an interval callback, never from a click.
   Safari keeps new contexts suspended "until the
   `resume()` method is called via user action" ([BCD][bcd-audiocontext]), and Chrome does so for contexts created
   before a user gesture ([Chrome][chrome-autoplay]). Schedule the end with **one** `setTimeout`: a timer that is
   not chained stays in Chrome's once-a-second tier ([Chrome][chrome-throttle]). A system notification goes out
   only if the tab is hidden and permission was already granted, and it is closed when the tab comes back (4.2).
7. **Animate only when someone can see it.** Animation frames stop for hidden documents
   ([HTML][html-rendering]), but they still run for content outside the viewport ([HTML][html-rendering]). Stop the
   loop with an `IntersectionObserver` and while paused. Draw the stream at about 12 fps, and with reduced motion
   redraw only when a grain moves (section 7).
8. **Reduced motion, a still option, a quiet screen reader.** With `prefers-reduced-motion: reduce` there is no
   falling stream and no flip ([MQ5][mq5]). A "Still glass" toggle covers 2.2.2 after a reload restarts the motion
   on its own ([WCAG 2.2.2][wcag-222]). The canvas is `aria-hidden`, since its information is the minutes text
   beside it ([WCAG 1.1.1][wcag-111]). Announce only the end and the turns, through the page's existing
   `role="status"` line ([ARIA][aria-status]).
9. **Colours from the theme tokens.** Sand is in the session's calendar colour (`--c`, as the progress bar is
   today). The glass outline is `--muted` (5.9:1 light, 6.5:1 dark on `--surface`); `--line` is too faint, at
   1.4:1 and 1.3:1. Rest sand is `--done`. Read the colours through a probe element's computed `color`, never
   through `getPropertyValue('--muted')`, which returns the unresolved `light-dark(…)` text
   ([CSS Variables][css-vars], [CSS Color 5][css-color-5]). Read them again when the theme changes.

## 2. Drawing a pixel hourglass

### 2.1 The options compared

| Approach | How it would work here | Theme and calendar colour | Crisp when scaled | Tied to time | Cost per frame | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **Canvas 2D at grid resolution**, CSS-scaled with `image-rendering: pixelated` | A `<canvas width=19 height=35>`; each frame writes palette colours into an `ImageData` and calls `putImageData` ([MDN][mdn-pixels]) | Colours must be resolved in script and re-read on theme change (8.5) | `pixelated` scales "with the 'nearest neighbor' or similar algorithm to the nearest integer multiple", then smooths the remainder (d, [MDN][mdn-image-rendering]); exact with whole device-pixel scales (2.2) | Yes, with the precomputed sand (2.4) | ~3 µs to compute 665 cells, measured in Node (8.7), plus one `putImageData` | **Recommended** |
| **SVG pixel grid** (`viewBox="0 0 19 35"`, one `<path>` of row runs per colour, `shape-rendering: crispEdges`) | Rebuild the `d` string when a grain moves or the stream steps | Free: `fill` from classes such as `fill-cal`, as `ProgressRing` does (`packages/ui/src/progress-ring.tsx`) | `crispEdges` is a hint: the UA "might turn off anti-aliasing … might adjust line positions … to align edges with device pixels" (d, [MDN][mdn-shape-rendering]) | Yes, with the same precomputed sand | Attribute change, then repaint of the SVG; one path per shade of sand | Runner-up: pick it if theme plumbing is unwanted |
| **CSS sprite sheet** with `steps()` | A strip of N hand-drawn frames; `animation-duration` = length, negative `animation-delay` = time run, `animation-play-state` for pause | Baked into the image; one colour per layer at best (a mask over a coloured background) | Yes, at whole scales | Only through the delay, and it must be re-synced after a reload or a hidden tab | Paint per step | Loses: finite fill levels (the 32 × 32 itch.io glass has 27 frames, d, [itch.io][itch-hourglass]), hand-authored art, no per-grain sand |
| **Live falling-sand simulation** every frame (Sandspiel, Dusty) | Step the cellular automaton each animation frame | As for canvas | As for canvas | **No**: the sand moves per frame, so it stops in a hidden tab and has to be fast-forwarded or it drifts | One grid pass per frame | Loses on correctness; its look is kept by precomputing (2.4) |
| **WebGL** (Sandspiel's renderer) | Upload the grid as a texture, colour it in a shader ([Making Sandspiel][making-sandspiel]) | In the shader | Yes | As the simulation | GPU | Overkill for under 1,000 cells |

`steps()` "divides the input time into a specified number of intervals that are equal in length" (d,
[MDN][mdn-steps]). WebKit has a runtime setting for "hidden page DOM timer throttling and CSS animation
suspension" (s, [WebKit bug 112308][webkit-bug-112308]), so how a sprite animation behaves in a hidden tab is a
further unknown. Ready-made pixel hourglasses exist: Davitheoles' "Inverted hourglass" is 32 × 32 px, 27 frames,
pay-what-you-want, "You can use however you want!" with credit asked (d, [itch.io][itch-hourglass]). OpenGameArt
lists an "Animated Hourglass" under CC0 (s, [OpenGameArt][oga-hourglass]; the page returned 403).

### 2.2 Crisp pixels at any size

- MDN's recipe: set the canvas `width`/`height` attributes to the small resolution, stretch it with CSS keeping the
  aspect ratio, and set `image-rendering: pixelated` (d, [MDN][mdn-crisp]).
- The catch: "When CSS pixels don't align with device pixels (if the `devicePixelRatio` is not an integer),
  certain pixels may be drawn larger than others", and page zoom changes `devicePixelRatio` in Chrome and Firefox
  (d, [MDN][mdn-crisp]). Pick the scale in **device** pixels: `n = ⌊available height × devicePixelRatio ÷ 35⌋`,
  then CSS size = `35 × n ÷ devicePixelRatio`. At 125 % Windows scaling, a 175 px target gives 6 device pixels per
  cell (168 CSS px) instead of an uneven 6.25.
- `devicePixelRatio` is "the ratio of the resolution in physical pixels to the resolution in CSS pixels"; page zoom
  changes it and pinch-zoom does not; MDN watches it with `matchMedia('(resolution: …dppx)')` and re-arms the
  query after each change (d, [MDN][mdn-dpr]).
- `ResizeObserver` can report `devicePixelContentBoxSize` "to ensure a one-to-one mapping of canvas pixels to
  physical pixels" (d, [MDN][mdn-dpcbs]), but Safari does not support it (Chrome 84, Firefox 108, Safari no; d,
  [BCD][bcd-ro]). Use `devicePixelRatio` and the `resolution` query instead.
- `pixelated` support: Chrome 41, Firefox 93, Safari 10; `crisp-edges`: Firefox 65, Safari 7, Chrome 148 (d,
  [BCD][bcd-image-rendering]). `imageSmoothingEnabled = false` is only needed when scaling with `drawImage`
  ([MDN][mdn-pixels]); it is not used here.
- MDN's canvas tips that apply: "Avoid floating-point coordinates", "Render screen differences only", "use
  `requestAnimationFrame()` instead of `setInterval()`", and use CSS for static backgrounds (d,
  [MDN][mdn-canvas-opt]). The glass outline and caps never change: draw them once into a base frame (8.7).

### 2.3 The falling-sand rules and prior art

- **Sandspiel** (MIT, 3.2k stars, Rust compiled to WebAssembly, WebGL rendering) moves sand like this: if the cell
  below is empty, move down; else if a random diagonal below (`dx = ±1`) is empty, move there; else, if the cell
  below holds a fluid, swap with it; else stay (d, [`species.rs`][sandspiel-species]). The loop alternates the x
  scan direction every generation, and each cell carries a `clock`, so a particle moved this tick is not updated
  again in the same tick (d, [`lib.rs`][sandspiel-lib]). The author says the `clock` exists to "prevent a single
  particle from being simulated multiple times in a single tick", that rendering blocks the CPU for "less than 1
  millisecond", and that the grid grew from 250 × 250 to 300 × 300 cells (d, [Making Sandspiel][making-sandspiel]).
- **Hackaday's "Digital Hourglass"** (ESP32, 128 × 64 OLED) parses the whole bit-packed buffer every 10 ms with the
  same down-then-sideways rules. It adds a "Bathtub" rule on the top half "to make sure the draining sand comes from
  the center on the top" (d, [Hackaday.io][hackaday-hourglass]). Its flow speed comes from how far the device is
  tilted (five gravity levels that skip frames), not from a set time (d, same page).
- **Dusty** (MIT, a web hourglass that flips every 60 s) counts down by decrementing `secondsRemaining` in a
  `setInterval(countdown, 1000)`. It derives the bulbs' fill as CSS heights from that counter, while its
  cellular-automaton particles are created at a fixed interval (d, [`script.js`][dusty-script]). That shows both
  pitfalls this proposal avoids: a counter rather than a deadline (3.1), and sand that is not tied to the time.

### 2.4 Tying the sand to the clock, not to frames

The prototype (8.7) runs the classic rule offline, on a seeded random generator, so the pile looks the same on every
load:

- **Top bulb.** Fill it, then remove one grain at the neck at a time and let the rest settle. Straight falls settle
  before any diagonal slide. Without that, the top drained from the walls and left a mound in the middle. With it,
  the hole climbs the middle column and the top drains into a crater, which is the Hackaday "bathtub" effect. A
  scan direction that alternated per sweep locked onto one side, so the direction is random per sweep. Once settled,
  a cell that has emptied never fills again: a grain only moves into a cell that was full before the step. The
  prototype checks this on every step. So each top cell needs one number: `emptiedAt` = the grains passed when it
  empties.
- **Bottom bulb.** Drop grains one at a time from under the neck. Each falls by the same rule and settles for good,
  so each bottom cell needs one number too: `filledAt` = the index of the grain resting there. The path of every
  grain is kept as well, for an optional landing animation.
- **A frame** after `p` grains: sand wherever `emptiedAt > p` or `filledAt < p`, plus a dashed stream from the
  neck down to the pile while `0 < p < grains`. With `p = ⌊grains × run ÷ length⌋`, the picture depends only on
  how much of the glass has run. The prototype checks that top + bottom = `grains` for every `p`.

Five frames of the prototype (19 × 35 cells, 122 grains; `#` sand, `|` glass, `=` caps), at 0, ¼, ½, ¾ and the whole
of the time:

```
===================   ===================   ===================   ===================   ===================
===================   ===================   ===================   ===================   ===================
   |           |         |           |         |           |         |           |         |           |
  |             |       |             |       |             |       |             |       |             |
 |               |     |               |     |               |     |               |     |               |
 |###############|     |##           ##|     |               |     |               |     |               |
 |###############|     |###         ###|     |#             #|     |               |     |               |
 |###############|     |####      #####|     |##           ##|     |               |     |               |
 |###############|     |#####    ######|     |###         ###|     |#             #|     |               |
  |#############|       |###### ######|       |###       ###|       |#           #|       |             |
  |#############|       |#############|       |#####    ####|       |##         ##|       |             |
   |###########|         |###########|         |#####  ####|         |##       ##|         |           |
    |#########|           |#########|           |#########|           |##     ##|           |         |
     |#######|             |#######|             |#######|             |##  ###|             |       |
      |#####|               |#####|               |#####|               |#####|               |     |
       |###|                 |###|                 |###|                 |###|                 |   |
        |#|                   |#|                   |#|                   |#|                   | |
        | |                   |#|                   |#|                   |#|                   | |
        | |                   | |                   | |                   | |                   | |
       |   |                 | # |                 | # |                 | # |                 |   |
      |     |               |  #  |               |  #  |               |  #  |               |     |
     |       |             |       |             |       |             |       |             |   #   |
    |         |           |    #    |           |    #    |           |    #    |           |   ###   |
   |           |         |     #     |         |     #     |         |     #     |         |   #####   |
  |             |       |             |       |             |       |     ###     |       |   #######   |
  |             |       |      #      |       |      #      |       |    #####    |       | ##########  |
 |               |     |       #       |     |      ###      |     |    ########   |     | ############  |
 |               |     |               |     |     #####     |     |   ##########  |     |###############|
 |               |     |       #       |     |    #######    |     |  ############ |     |###############|
 |               |     |     ####      |     |   #########   |     | ##############|     |###############|
 |               |     |    ######     |     | ############  |     |###############|     |###############|
  |             |       |  #########  |       |#############|       |#############|       |#############|
   |           |         |###########|         |###########|         |###########|         |###########|
===================   ===================   ===================   ===================   ===================
===================   ===================   ===================   ===================   ===================
```

Grain count sets the rhythm: with 122 grains, a 25-minute glass lets one through every 12.3 s, and a 5-minute
rest one every 2.5 s. A 25 × 43 grid holds 224 grains (6.7 s each at 25 min; built in 11 ms including printing).
The dashed stream, stepped at about 12 fps, makes the glass look alive between grains.

## 3. Keeping time in a browser

### 3.1 Timers in hidden tabs

| Engine | Rule for `setTimeout` / `setInterval` in a hidden tab | Source |
| --- | --- | --- |
| HTML standard | After five nested timers the delay is at least 4 ms. The UA may "wait a further implementation-defined length of time … to optimize the power usage of the device"; "This API does not guarantee that timers will run exactly on schedule" | d, [HTML][html-timers] |
| Chrome, *throttling* | Hidden page, and any of: chain count < 5, hidden < 5 min, WebRTC in use: timers are checked "once per second" | d, [Chrome][chrome-throttle] |
| Chrome, *intensive throttling* (Chrome 88) | Hidden > 5 min **and** chain count ≥ 5 **and** silent ≥ 30 s **and** no WebRTC: checked "once per minute". A nested `setTimeout` is chained, and "With `setInterval`, each iteration is part of the chain". A page that "has made noises in the past 30 seconds" gets minimal throttling | d, [Chrome][chrome-throttle], [MDN][mdn-settimeout] |
| Chrome, next | "Quick intensive timer throttling": enter intensive throttling 10 s after a loaded page is hidden. In developer trial behind a flag | d, [chromestatus][chromestatus-quick] |
| Firefox | Desktop: at least 1 s in inactive tabs, but no throttling if the tab holds an `AudioContext`. Android: "a minimum timeout of 15 minutes for inactive tabs and may unload them entirely" | d, [MDN][mdn-settimeout] |
| Firefox and Chrome, budget | Background windows have a time budget that regenerates at 10 ms per second; timer tasks run only while it is non-negative. Tabs playing audio and tabs with WebSockets or WebRTC are exempt | d, [MDN][mdn-visibility] |
| Safari / WebKit | Origin of the feature: DOM timers of hidden pages rounded to 1-second intervals (2012) | s, [WebKit bug 98474][webkit-bug-98474] |
| `requestAnimationFrame` | "paused in most browsers when running in background tabs or hidden `<iframe>`s" (d, [MDN][mdn-raf]). The HTML event loop drops documents whose "visibility state is 'hidden'" from rendering, and considers content "presentable even if it's outside the viewport" (d, [HTML][html-rendering]). A hidden navigable "might" drop "to a much slower 4 rendering opportunities per second, or even less" (d, same) | |

Conclusions for a countdown: never count ticks. Store a deadline or a start and compute the remaining time from the
clock, as `use-stopwatch.ts` already does. Schedule the end with a single, unchained `setTimeout`, which stays in
Chrome's once-a-second tier. Recompute on `visibilitychange`. The Chrome article advises moving off polling timers
and using `requestAnimationFrame`, CSS animations or the Web Animations API for animation. It allows timers for
"low-frequency animation" combined with `requestAnimationFrame`, as in its `animationInterval` helper (d,
[Chrome][chrome-throttle]).

### 3.2 Which clock

- `Date.now()` "may have been impacted by system and user clock adjustments"; `performance.now()` is relative to
  `timeOrigin` on "a monotonic clock: its current time never decreases" (d, [MDN][mdn-now]).
- Sleep: MDN says Level 2 requires `performance.now()` to "tick when the operating system sleeps", but "only
  browsers on Windows keep ticking during sleep", and it advises `Date.now()` "if you are timing a long operation"
  (d, [MDN][mdn-now]). The HR Time draft read here says the monotonic clock "never decreases" and should be used
  "for measurement, rather than user-visible times". It says nothing about sleep (d, [HR Time][hr-time]).
- HTML timers measure from "the current high resolution time" (d, [HTML][html-timers]), that is, the monotonic
  clock. So a pending `setTimeout` may fire late by the length of a sleep where that clock stops (inference from the
  two sources).
- So: keep **wall-clock epoch milliseconds** (`Date.now()`) as the stored truth, as the stopwatch does ("right after
  a reload, a sleeping laptop or a tab left in the background", `use-stopwatch.ts`). Re-check the end whenever the
  page wakes up: `visibilitychange`, plus the stopwatch's own one-second tick.

### 3.3 Visibility, freezing, discarding, reloads

- `visibilitychange` fires when "the user minimizes the window, switches to another tab, or the document is entirely
  obscured"; `document.visibilityState` is `visible` or `hidden` (d, [MDN][mdn-visibility]).
- Chrome freezes pages ("JavaScript timers and fetch callbacks don't run") and discards them under resource pressure.
  `document.wasDiscarded` tells a reloaded page it was discarded. "Treat the hidden state as the likely end to the
  user's session", and persist view state too (d, [Page Lifecycle][lifecycle]). Since Chrome 133, with Energy Saver
  on, background tabs "hidden and silent for more than five minutes" and "CPU-intensive" are frozen (d,
  [Chrome][freeze]).
- Consequence: everything the glass needs must be in `localStorage` at every change, not written on unload. That
  is already how `use-stopwatch.ts` and the breaks rhythm work.

### 3.4 Web Workers

A worker clock is not needed. With a stored deadline, a late tick costs a late redraw, not a wrong time. Chrome
proposed in 2018 to throttle dedicated workers of background pages (s, [blink-dev][blink-workers]). Chrome's 2021
article does not mention workers (d, [Chrome][chrome-throttle]). Their current behaviour was not verified.

### 3.5 What the current Focus code does

- `use-stopwatch.ts` stores `{ uid, startedAt, banked }` under `learning-curve:focus` and computes `elapsed` from
  `Date.now()`. Its one-second `setInterval` only re-renders while it runs. Reload- and sleep-safe.
- `use-breaks.ts` stores only the rhythm (`learning-curve:focus-breaks`). `handled`, `restUntil` and `rested` are
  React state. Two consequences:
  1. After a reload at 40 min with 25 + 5 on, `handled` is 0 again, so the break shows as due even if it was
     skipped, and the page tries to chime.
  2. A reload during a break loses the rest countdown.
- The break-due check runs on renders that the stopwatch's interval drives. In a tab hidden for over 5 minutes and
  silent for 30 s, Chrome checks that chained interval once a minute, so the chime can come up to about a minute
  late. The same holds for the rest-end `setInterval` in `use-breaks.ts` ([Chrome][chrome-throttle]).
- `chime()` creates a new `AudioContext` for every chime, plays 660 Hz then 880 Hz, and closes it after 600 ms. It
  never checks `state` or calls `resume()`. See 4.1 for where that stays silent.

## 4. Ending: sound, notification, title, badge

### 4.1 Sound and the autoplay rules

- Chrome allows autoplay with sound once "The user has interacted with the domain (click, tap, etc.)" (and in other
  cases: Media Engagement Index, installed PWA). An `AudioContext` created before a user gesture starts
  "suspended", and "you will need to call `resume()` after the user gesture" (d, [Chrome][chrome-autoplay]). The
  Web Audio note adds that a context resumes on its own when the user has interacted and a source node is started
  (d, [Chrome][chrome-webaudio-autoplay]).
- The Web Audio spec: a context is "allowed to start" if the UA lets it go from "suspended" to "running", which a UA
  may allow "only when" the global has sticky activation (d, [Web Audio][webaudio]). HTML defines sticky activation
  as "whether the user has ever interacted in W". The triggering events are `keydown` (not Esc), `mousedown`,
  `pointerdown` for mouse, `pointerup` otherwise, and `touchend` (d, [HTML][html-activation]). After a reload there
  is no activation until the next click or key.
- Safari: "New audio contexts are suspended until the `resume()` method is called via user action, such as the
  `click` event" (d, [BCD][bcd-audiocontext]). WebKit's 2017 post says sites "should assume any use of `<video>` or
  `<audio>` requires a user gesture click to play". It does not cover Web Audio (d, [WebKit][webkit-autoplay]).
- MDN: playing from `start()` "outside the context of handling a user input event is subject to autoplay rules".
  `navigator.getAutoplayPolicy('audiocontext')` answers in advance (d, [MDN][mdn-autoplay]), but only Firefox 112+
  has it (d, [BCD][bcd-navigator]).
- Cirillo's requirement for a timer: "It should make an audible, easily identified sound to signal that time's up"
  (d, [Cirillo][cirillo]).

So: make one `AudioContext` in the click that starts or turns the glass. That click is a user activation in every
engine. Keep it, and play the end chime on it. If its `state` is not `running` at the end, rely on the words on
the page and the notification. Whether Safari lets a context that was resumed once by a click be resumed again from
a timer after a `suspend()` was not verified, so do not suspend it between chimes (section 11).

### 4.2 Notifications

- Ask "only … in response to a user gesture (e.g., clicking a button)"; "Firefox is already doing this from version
  72 … and Safari has done it for some time" (d, [MDN][mdn-notif]; Firefox 72 also in [BCD][bcd-notification]).
  Permission is `default`, `granted` or `denied` (d, [MDN][mdn-notif]). Once a site is blocked it "can't ask for
  permission again"; never ask "as soon as the user opens your site"; ask "at a time when the benefit is obvious"
  (d, [web.dev][webdev-perm]).
- `tag` replaces an earlier notification with the same tag. MDN's example closes a stale notification on
  `visibilitychange` when the page becomes visible (d, [MDN][mdn-notif]).
- `new Notification()` "always throws a `TypeError`" on Chrome for Android, where only a service worker can notify.
  On iOS Safari the interface exists only for a home-screen web app (d, [BCD][bcd-notification]).
- This app already holds the permission flow. `features/reminders/model/use-reminders.ts` requests it from a toggle
  (a click), remembers the choice in `localStorage` and tags each notification. The glass can notify at the end
  when `document.hidden` and `Notification.permission === 'granted'`, inside a `try`. If permission is not granted,
  offer "Notify me when the sand runs out" as a toggle that asks on click.

### 4.3 Title, favicon, badge

- **Badge:** `setAppBadge()` is "for installed apps" (d, [MDN][mdn-badging]). Chrome 81+ supports it on Windows and
  macOS (ChromeOS 91), Safari 17 for installed web apps on macOS Sonoma, and iOS 16.4 for home-screen apps; Firefox
  and Chrome for Android do not (d, [BCD][bcd-navigator]). This app has no web app manifest
  (`apps/web/src/routes/__root.tsx`), so a badge does not apply.
- **Favicon:** the shell already owns a live favicon. `TodayIcon` rewrites `link[rel="icon"]` every minute with
  today's date (`apps/web/src/shell/TodayIcon.tsx`), so a sand favicon would fight it. Leave it.
- **Title:** "12 min · Focus" in the tab is the cheapest signal that works in a hidden tab. Whole minutes are enough,
  so Chrome's once-a-minute tier is fine. The route's `<title>` comes from `head()` through `HeadContent`
  (`apps/web/src/routes/focus.tsx`, `__root.tsx`), and modules "do not know … about the router"; the app passes
  callbacks in (`docs/architecture.md`). So the page would report the glass through a callback, and the route would
  set the title. Whether TanStack's head management overwrites a title set this way was not checked (section 11).

## 5. Accessibility

| Requirement | What it says | What it means for the glass |
| --- | --- | --- |
| WCAG 2.2.2 Pause, Stop, Hide (A) | Moving content that "(1) starts automatically, (2) lasts more than five seconds, and (3) is presented in parallel with other content" needs a way to pause, stop or hide it. "'starts automatically' broadly refers to animations/updates that are not the direct result of a user's intentional activation" (d, [W3C][wcag-222]) | Pressing Start is a direct activation. A **reload** that resumes a running stopwatch restarts the motion without one. Pause stops it, but also stops the time, so offer a "Still glass" toggle that stops only the motion |
| WCAG 2.3.3 Animation from Interactions (AAA) | "Motion animation triggered by interaction can be disabled, unless … essential"; motion animation excludes "changes of color … or opacity"; technique C39 is `prefers-reduced-motion` (d, [W3C][wcag-233]) | The 180° turn when the glass is turned over is motion from an interaction: skip it with reduced motion |
| WCAG 2.2.1 Timing Adjustable (A) | Applies "only to time limits that are set by the content itself" (d, [W3C][wcag-221]) | A timer the person sets and that takes nothing away at the end is not a content time limit (inference from the definitions, not stated). Pause and Turn over cover it anyway |
| `prefers-reduced-motion` | `reduce`: the user prefers an interface "that removes or replaces the types of motion-based animation that either trigger discomfort for those with vestibular motion sensitivity, or distraction for those with attention deficits" (d, [MQ5][mq5]); OS settings listed for Windows, macOS, iOS, Android, GNOME, KDE (d, [MDN][mdn-prm]) | No stream, no landing grain, no turn animation; redraw once per grain. The "attention deficits" clause fits a focus page: honour it by default |
| `role="timer"` | "A type of live region containing a numerical counter …"; "authors SHOULD update the text contents at fixed intervals, except when the timer is paused or reaches an end-point"; "implicit `aria-live` value of `off`" (d, [ARIA 1.2][aria-timer]) | Fine for the minutes caption: it is read on demand, never announced |
| `role="status"` | "implicit `aria-live` value of `polite` and an implicit `aria-atomic` value of `true`" (d, [ARIA 1.2][aria-status]) | The page already has one for breaks (`FocusPage.tsx`). Put the end and the turns there ("The sand has run out", "Rest: 5 min"), nothing per minute. MDN's countdown example announces once, by switching `timer` to `alert` at 10 s (d, [MDN][mdn-timer-role]); a separate status line avoids role switching |
| WCAG 1.1.1 Non-text Content (A) | Non-text content needs a text alternative; pure decoration must be "implemented in a way that it can be ignored by assistive technology" (d, [W3C][wcag-111]) | With "12 min left" written beside it, the canvas adds nothing for a screen reader: `aria-hidden="true"`. If it ever stands alone: `role="img"` needs `aria-label` (d, [ARIA 1.2][aria-img]) |
| WCAG 1.4.11 Non-text Contrast (AA) | 3:1 for "Parts of graphics required to understand the content"; graphics whose information text also gives are not required to meet it (d, [W3C][wcag-1411]) | Not binding with the text beside it, but use `--muted` for the outline anyway (5.89:1 / 6.47:1, computed from `theme.css`) |
| WCAG 2.1.4 Character Key Shortcuts (A) | A printable-character shortcut must be possible to turn off or remap, or work only on focus (d, [W3C][wcag-214]) | Do not add a single-letter "turn over" key. `E` and `Shift F` already exist on this page (`useShortcuts`); whether the app meets 2.1.4 is a separate question |
| Keyboard | — | Every control is a `Button` or `Segmented` from `@lc/ui`; the custom-minutes field is a native `<input type="number" min max step>` with a label (k) |

## 6. Configuration: how timer and Pomodoro products set the length

| Product | Setting the length | Presets, memory | While it runs | At the end | Count-up too? |
| --- | --- | --- | --- | --- | --- |
| Apple Clock, iPhone | "Tap Timers, then set a duration of time"; optional label; "Choose a sound to play when the timer ends" (d) | Presets "like 1, 5, or 10 minutes"; Recents with a Start button (d) | Pause / Resume; "continues even if you open another app or if iPhone goes to sleep"; several timers at once (d) | A notification; Repeat or Stop from the Lock Screen (d) | "Use the stopwatch" is a separate Clock feature (d, guide contents) |
| Windows 11 Focus sessions | "Choose an amount of time for your focus session and if you want to have breaks" (d) | — | A focus timer on screen; "end a focus session early" (d) | "a notification when your focus session ends" (d) | — |
| Forest | "Pick a focus length and a tree species" (d) | — | Pausing is Plus-only, up to 5 min a pause; leaving the app kills the tree in strict sessions (d) | — | "Focus Timer (countdown + stopwatch)" (d) |
| Be Focused (App Store) | "Set durations for work sessions, short and long breaks"; "Define number of intervals before a long break" (d) | — | "Start, pause, or skip intervals"; optional auto-start of the next (d) | "Variety of alarm sounds"; ticking with adjustable frequency (d) | — |
| Focus To-Do (App Store) | "Customizable pomodoro/breaks lengths"; short and long breaks (d) | — | "Pause and resume Pomodoro" (d) | "Notification before the end of a Pomodoro"; alarm, vibration (d) | "Counting Mode" since 6.8 (d) |
| Flocus | Settings → Timer: Pomodoro, short break, long break "after completing a full Pomodoro cycle (4 focus sessions)", and Countdown, "a single session with no built-in breaks" (d) | — | — | — | — |
| Pomofocus | 25 min focus, 5 min break; "Personalize your focus/break time, alarm sounds, background sounds" (d) | — | — | Alarm (d) | — |
| Cirillo, *The Pomodoro Technique* | 25 + 5; every four, a 15–30 min break; "The time remaining should always be visible" (d) | — | "A Pomodoro can't be interrupted"; if it is, "that Pomodoro should be considered void" (d) | "audible, easily identified sound"; "explicit gestures … it's better if these aren't automated" (d) | — |
| Google Clock | Adding a minute to a running timer with a "+1" button (s, How-To Geek; no first-party page found) | | | | |

Sources: [Apple][apple-timers], [Microsoft][ms-focus], [Forest][forest], [Be Focused][befocused],
[Focus To-Do][focustodo], [Flocus][flocus], [Pomofocus][pomofocus], [Cirillo][cirillo],
[How-To Geek (s)][htg-android]. Time Timer, a physical visual timer, shows remaining time as "a patented red disk
that disappears as time elapses", making "the abstract concept of time concrete" (d, [Time Timer][timetimer]). That
is the case for an hourglass beside the digits.

Patterns:

1. **Presets plus a free value, remembered.** Apple has presets and recents; the Pomodoro apps keep lengths in
   settings.
2. **Work and rest lengths are one setting.** Be Focused, Focus To-Do and Flocus do this, and Windows asks for the
   length and "if you want to have breaks" in one step. Here, the glass length and the break rhythm should be one
   control, not two.
3. **Count-up and countdown are modes, not neighbours.** Forest, Focus To-Do and Flocus switch between them. No
   product read here shows a running count-up and a running countdown at once. If both are on this page, they must
   be one clock with two faces (8.4).
4. **Pause is common** (Apple, Focus To-Do, Be Focused), rationed in Forest, and rejected by Cirillo. Here the
   stopwatch must pause, because it logs real study time, so the glass pauses with it.
5. **The end:** a sound and a notification, and restarting is one tap (Apple's "Repeat"). Auto-start is optional
   (Be Focused); Cirillo prefers an explicit gesture. That supports a Turn over button rather than auto-restart.
6. **Adding time to a running timer** is documented by none of the first-party pages read; it is common in
   phone clocks (s).

## 7. Battery and performance

- Budget: "the browser has 16.66 milliseconds to produce each frame" and "all of your work needs to be completed
  inside 10 milliseconds" (d, [web.dev][webdev-rendering]). Computing a frame took about 3 µs in the prototype
  (8.7). The glass is nowhere near the budget; the cost that matters is **waking up**.
- `requestAnimationFrame` callbacks "will generally match the display refresh rate" (60–144 Hz), and progress must
  come from the timestamp, or "the animation will run faster on high refresh-rate screens" (d, [MDN][mdn-raf]).
  Pixel art does not need 120 fps. Step the stream about 12 times a second: request a frame from an 83 ms timeout,
  which is the Chrome article's "low-frequency animation" pattern (d, [Chrome][chrome-throttle]).
- Stop the loop when it cannot be seen or nothing moves:
  - hidden tab: no animation frames anyway ([HTML][html-rendering]);
  - scrolled out of view: `IntersectionObserver`, made for "Deciding whether or not to perform tasks or animation
    processes based on whether or not the user will see the result" (d, [MDN][mdn-io]);
  - paused, empty or full glass;
  - reduced motion or "Still glass": no loop at all, one timeout to the next grain (`length ÷ grains`).
- Draw only what changes: the outline and caps are a precomputed base frame; a frame copies it and sets the sand
  cells (MDN: "Render screen differences only", d, [MDN][mdn-canvas-opt]).
- Do not keep audio running to dodge throttling. Firefox exempts tabs with an `AudioContext` and Chrome exempts
  pages that made sound in the last 30 s (d, [MDN][mdn-settimeout], [Chrome][chrome-throttle]), but a running
  context holds system resources: `suspend` and `close` "allow authors to release system resources, including
  threads, processes and audio streams" (d, [Web Audio][webaudio]).

## 8. Proposal for this repository

### 8.1 Rendering

A `<canvas>` with `width`/`height` equal to the grid (19 × 35 in the sketch, about 120 grains). It is styled
`image-rendering: pixelated` and sized to a whole number of device pixels per cell (2.2). That is about 4–5 CSS px
per cell in the normal page (140–175 px tall), and as large as the column allows in Expand and Full screen. A frame
is a `Uint8Array` of palette indices from `drawCells`; the painter maps it through a palette into an `ImageData`
and calls `putImageData`.

Why the others lose:

- **SVG:** `crispEdges` is a hint, and each shade of sand is another path. It wins only on theme plumbing, which
  costs about 20 lines on canvas.
- **CSS sprites:** fixed frames, colours baked in, and the timing has to be re-synced.
- **Live simulation:** the sand drifts from the clock in hidden tabs.
- **WebGL:** unneeded.

### 8.2 Timing model: one clock

- **Truth is the stopwatch.** `elapsed` from `use-stopwatch.ts` (epoch start plus banked ms, in `localStorage`).
- **The current block** starts at `blockStart` (stopwatch ms) and lasts `length` ms:
  - *Session*: `blockStart = 0`, `length = planned` (the session's planned duration, already computed in
    `FocusPage.tsx`).
  - *25 + 5, 50 + 10, Custom*: `blockStart = handled × every`, `length = every`.
  - *Resting*: the glass shows the rest. `run = rest − resting`, from `restUntil`, which is a wall-clock deadline.
- `run = clamp(elapsed − blockStart, 0, length)`, `passed = ⌊grains × run ÷ length⌋`, minutes left =
  `⌈(length − run) ÷ 60 000⌉`.
- **The end:** while running, `endsAt = Date.now() + (length − run)`. Schedule one `setTimeout(…, endsAt −
  Date.now())` from the Start/Turn handler and again on `visibilitychange`. Also check `run ≥ length` on every
  stopwatch tick, for wake from sleep (3.2). Signal once per block: chime, `role="status"` line, notification if
  hidden.
- **Reload:** the stopwatch restores `elapsed`. Persist `{ uid, handled, restUntil }` next to it (today they are
  React state, 3.5), and the glass redraws the exact frame on first paint.
- **Hidden tab:** nothing draws; the single timeout fires within about a second in Chrome (3.1). On return, the
  frame is recomputed from `passed` with no catching up.

### 8.3 Settings

- One Glass control replaces Breaks: `Session · 25 + 5 · 50 + 10 · Custom`. Custom opens two number fields, work
  1–180 min and rest 0–60 min, with presets as `Segmented` buttons like the current rhythm control. The values are
  kept per browser in `localStorage` (`learning-curve:focus-breaks` becomes a JSON value, still read leniently like
  `readRhythm`). They are not kept per session: a rhythm is a habit of the person, not a property of a course
  (pattern 1 in section 6).
- "Still glass" and "Notify me when the sand runs out" are toggles in the same place, kept per browser.
- Turn over: when the work glass empties, the existing "Take a break" and "Later" both turn it (to the rest, or to
  another work block). When the rest empties, "Back to work" turns it. In *Session* mode an empty glass stays
  empty, and the page already says "X over the plan".

### 8.4 Beside the stopwatch and the breaks

- Layout: on `lg` and wider, the glass sits left of the stopwatch digits in one row. On narrow screens it sits
  above them, smaller. In Expand and Full screen it takes the height the column allows, at a whole-pixel scale
  (`useFillHeight` already sizes the column in those modes).
- One source of time: the digits keep counting **up** the whole session (what Finish logs). The glass counts
  **down** the current block, with its time as a quiet caption in whole minutes ("12 min left"). The page then has
  one ticking number, one moving picture and one Start/Pause.
- The thin progress bar (elapsed ÷ planned) stays for the session in rhythm modes. In *Session* mode it repeats the
  glass and could go.
- Two clocks (an independent sand timer with its own Start, Pause and deadline) is the alternative. It is useful
  only if the glass must run without a session. It costs a second Start/Pause, two states that can disagree, and
  two chimes when its length and the break rhythm differ (9.1).

### 8.5 Reduced motion, screen readers, colours

- `matchMedia('(prefers-reduced-motion: reduce)')`, or the "Still glass" toggle, turns off the stream, the landing
  grain and the 180° turn. The sand then changes once per grain. CSS motion in `theme.css` already follows the same
  rule (`.lc-done-pop`, `.lc-layer`).
- Canvas `aria-hidden="true"`. The minutes caption is plain text (or `role="timer"`, which is never announced), and
  the end and turns go to the existing `role="status"` paragraph. All new strings (Glass, Session, Custom, minutes
  of work and rest, Still glass, Notify me, "The sand has run out", "{time} left in the glass", the title text) go to
  `ru`, `en` and `es` in `packages/i18n/messages/*.json` (`CLAUDE.md`).
- Palette from tokens through a probe element:
  - a hidden `<span>` per colour with `text-cal`, `text-muted`, `text-ink`, `text-done` and `text-today`;
  - read `getComputedStyle(probe).color`, which is resolved, because `light-dark()` "computes to the computed
    value of the first color, if the element color scheme is light" (d, [CSS Color 5][css-color-5]);
  - **not** `getPropertyValue('--muted')`: a custom property's computed value is the "specified value with
    variables substituted" (d, [CSS Variables][css-vars]), that is, the `light-dark(…)` text.
- Turning a colour string into bytes: draw it with `fillStyle` into a 1 × 1 canvas and read the pixel back. That
  accepts any CSS colour syntax (k).
- Read again when:
  - the theme switch rewrites `<meta name="color-scheme">` (`apps/web/src/shell/theme.ts`; a `MutationObserver` on
    its `content`);
  - the system scheme changes (`matchMedia('(prefers-color-scheme: dark)')`);
  - the session's calendar colour changes.

  A decoupled alternative is a `transition: color 1ms` on the probe and a `transitionrun` listener, which fires on
  any change of the resolved colour (k).
- Sand texture: two or three shades of the calendar colour, picked per cell by a hash, mixed toward `--surface` in
  script. Keep the canvas transparent so `--surface` shows through in both themes.

### 8.6 Where the code goes

Per `docs/architecture.md` (Feature-Sliced layers; widgets are "self-contained blocks of a page"):

- `modules/planner/src/widgets/hourglass/`: `index.ts`, `model/glass.ts` (pure: shape, `buildGlass`, `drawCells`),
  `model/use-glass-loop.ts` (animation loop, visibility, intersection, reduced motion), `ui/Hourglass.tsx` (canvas,
  palette, scaling). Props: `passed`, `grains` or `fraction`, `running`, `tone: 'work' | 'rest'`, `still`.
- `modules/planner/src/pages/focus/model/`: the timing. Extend `use-breaks.ts` into the block model of 8.2 and
  persist its state. `FocusPage.tsx` composes the widget and reports the glass to the host for the title (4.3).
- Tests: `pnpm run test` covers only `plan-domain`, `plan-data`, `docs-contract` and `docs` (root `package.json`).
  The planner module has no test target. The pure `glass.ts` deserves one, with monotonicity and grain-count
  checks like the prototype's, or it can live in a story only (9.8).

### 8.7 Sketch: the sand

This type-checks under `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). In
Node 26 on the development machine it builds in 4 ms and computes 1,000 frames in 3 ms; these are not browser or
phone figures.

```ts
/** Half-widths of the top bulb's rows, top first. The bottom bulb mirrors it; the neck is one cell wide. */
const BULB = [5, 6, 7, 7, 7, 7, 7, 6, 6, 5, 4, 3, 2, 1, 0]
const HEADROOM = 3 // empty rows above the sand of a full glass
const CAP = 2 // rows of each wooden cap

export const EMPTY = 0
export const SAND = 1
export const GLASS = 2
export const WOOD = 3

export interface Glass {
  width: number
  height: number
  /** Grains the glass holds: one passes the neck every `length / grains` ms */
  grains: number
  /** Top bulb: grains passed when the cell empties for good; -1 elsewhere */
  emptiedAt: Int16Array
  /** Bottom bulb: the grain that comes to rest in the cell; -1 elsewhere */
  filledAt: Int16Array
  /** Per grain, the cells it crosses from the neck to its place */
  paths: number[][]
  /** Glass and caps, the same in every frame */
  frame: Uint8Array
  neck: number
  center: number
}

/** mulberry32: the same pile on every load */
function random(seed: number) {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Runs the sand once and keeps when each cell empties or fills: a frame is then a function of the grains passed. */
export function buildGlass(seed = 7): Glass {
  const half = Math.max(...BULB)
  const width = 2 * half + 5
  const center = half + 2
  const top = CAP
  const neck = CAP + BULB.length
  const bottom = neck + 1
  const height = bottom + BULB.length + CAP
  const halfWidth = (y: number): number =>
    y >= top && y < neck
      ? (BULB[y - top] ?? -1)
      : y === neck
        ? 0
        : y >= bottom && y < bottom + BULB.length
          ? (BULB[BULB.length - 1 - (y - bottom)] ?? -1)
          : -1
  const inside = (x: number, y: number) => Math.abs(x - center) <= halfWidth(y)
  const at = (x: number, y: number) => y * width + x
  const rand = random(seed)

  // The classic rule: straight down, else a diagonal (random side first), else stay.
  const step = (cells: Uint8Array, x: number, y: number, last: number, diagonal: boolean): number | null => {
    const free = (nx: number, ny: number) => ny <= last && inside(nx, ny) && cells[at(nx, ny)] === EMPTY
    if (free(x, y + 1)) return at(x, y + 1)
    if (!diagonal) return null
    const side = rand() < 0.5 ? -1 : 1
    if (free(x + side, y + 1)) return at(x + side, y + 1)
    if (free(x - side, y + 1)) return at(x - side, y + 1)
    return null
  }
  // Straight falls settle before any slide, so the top drains into a crater rather than from the walls.
  const settle = (cells: Uint8Array, first: number, last: number) => {
    const sweep = (diagonal: boolean) => {
      let moved = false
      const flip = rand() < 0.5 // an alternating direction locks onto one side
      for (let y = last - 1; y >= first; y--) {
        for (let i = 0; i < width; i++) {
          const x = flip ? width - 1 - i : i
          if (cells[at(x, y)] !== SAND) continue
          const to = step(cells, x, y, last, diagonal)
          if (to === null) continue
          cells[at(x, y)] = EMPTY
          cells[to] = SAND
          moved = true
        }
      }
      return moved
    }
    while (sweep(false) || sweep(true));
  }

  const upper = new Uint8Array(width * height)
  for (let y = top + HEADROOM; y < neck; y++) for (let x = 0; x < width; x++) if (inside(x, y)) upper[at(x, y)] = SAND
  const grains = upper.reduce((sum, cell) => sum + cell, 0)

  const emptiedAt = new Int16Array(width * height).fill(-1)
  for (let passed = 1; passed <= grains; passed++) {
    const before = upper.slice()
    upper[at(center, neck - 1)] = EMPTY
    settle(upper, top, neck - 1)
    before.forEach((was, cell) => {
      if (was === SAND && upper[cell] === EMPTY) emptiedAt[cell] = passed
    })
  }

  const lower = new Uint8Array(width * height)
  const filledAt = new Int16Array(width * height).fill(-1)
  const paths: number[][] = []
  const floor = bottom + BULB.length - 1
  for (let grain = 0; grain < grains; grain++) {
    let cell = at(center, bottom)
    const path = [cell]
    for (let to = step(lower, center, bottom, floor, true); to !== null; ) {
      cell = to
      path.push(cell)
      to = step(lower, cell % width, Math.floor(cell / width), floor, true)
    }
    lower[cell] = SAND
    filledAt[cell] = grain
    paths.push(path)
  }

  const frame = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y < CAP || y >= height - CAP) frame[at(x, y)] = WOOD
      else if (!inside(x, y) && (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)))
        frame[at(x, y)] = GLASS
    }
  }
  return { width, height, grains, emptiedAt, filledAt, paths, frame, neck, center }
}

/**
 * The cells after `passed` grains (0…grains). `phase` steps the falling stream; `landing` (0…1) is how far grain
 * `passed`, the one in flight, has come down its path, or null to draw none (reduced motion, paused).
 */
export function drawCells(glass: Glass, passed: number, phase: number, landing: number | null, out: Uint8Array) {
  out.set(glass.frame)
  // A grain in flight has already left the top.
  const left = landing === null ? passed : Math.min(glass.grains, passed + 1)
  for (let cell = 0; cell < out.length; cell++) {
    const emptied = glass.emptiedAt[cell] ?? -1
    const filled = glass.filledAt[cell] ?? -1
    if (emptied > left || (filled !== -1 && filled < passed)) out[cell] = SAND
  }
  if (left === 0 || passed >= glass.grains) return
  for (let y = glass.neck; y < glass.height; y++) {
    const cell = y * glass.width + glass.center
    if (out[cell] !== EMPTY) break
    if ((y + phase) % 3 !== 0) out[cell] = SAND
  }
  const path = glass.paths[passed]
  if (landing === null || !path) return
  const cell = path[Math.min(path.length - 1, Math.floor(landing * path.length))]
  if (cell !== undefined) out[cell] = SAND
}
```

`buildGlass()` is deterministic, so it can be computed once per module (lazily, on first use) and shared.

### 8.8 Sketch: the clock and the painter

```ts
const glass = buildGlass()
const run = Math.min(length, Math.max(0, elapsed - blockStart))
const passed = Math.min(glass.grains, Math.floor((glass.grains * run) / length))
// Grain `passed` falls during its slot and crosses its path in the first 600 ms of it (or the whole slot if shorter)
const slot = length / glass.grains
const landing = still || !running ? null : Math.min(1, (run - passed * slot) / Math.min(600, slot))
const phase = Math.floor(performance.now() / 83) % 3

drawCells(glass, passed, phase, landing, cells)
// `palette` holds one 32-bit RGBA word per cell kind, packed for a little-endian device (k)
const pixels = new Uint32Array(image.data.buffer)
for (let i = 0; i < cells.length; i++) pixels[i] = palette[cells[i] ?? EMPTY] ?? 0
context.putImageData(image, 0, 0)
```

With the grain in flight counted, the top shows `grains − passed − 1` grains, the bottom `passed`, and one grain
falls; with `landing = null`, the top shows `grains − passed`. Both were checked for every `passed` in the
prototype.

## 9. Open questions only the owner can answer

1. **One clock or two?** Should the glass run only with the stopwatch, with one Start and Pause (recommended)? Or
   should it be an independent sand timer that can run without a session, for example during a break or for
   something outside the plan?
2. **Merge Breaks into the glass?** Should `None / 25 + 5 / 50 + 10` become `Session / 25 + 5 / 50 + 10 / Custom`?
   Or should Breaks stay as it is, with a separate glass length, which brings two rhythms and possibly two chimes?
3. **Default length without breaks:** the session's planned length, or a fixed 25 min?
4. **Running glass rules:** allow "+5 min"? Allow Turn over mid-run, which restarts the block? Or keep Cirillo's
   rule that a block is indivisible, so the only choices are pause (which the stopwatch needs) and finish?
5. **End signals:** the same two-note chime as breaks, or a distinct one? A system notification when the tab is
   hidden, using the Reminders permission if already granted? Minutes left in the tab title?
6. **Look:** chunky (19 × 35, about 120 grains) or finer (25 × 43, about 220)? Wooden caps or flat? Sand in the
   session's calendar colour (recommended) or one fixed sand colour? A 180° turn animation when turned over?
7. **Placement:** glass left of the digits (recommended), or the glass as the main element with the digits smaller?
   Should it be possible to hide the glass entirely?
8. **Tests:** add a test target to `@lc/planner` for the pure sand model, or keep it covered by a story only?

## 10. Sources

Specs: [HTML timers][html-timers] · [HTML event loop, rendering][html-rendering] ·
[HTML user activation][html-activation] · [HR Time][hr-time] · [Web Audio][webaudio] ·
[WAI-ARIA 1.2 timer][aria-timer] · [status][aria-status] · [img][aria-img] ·
[Media Queries 5, prefers-reduced-motion][mq5] · [CSS Color 5, light-dark()][css-color-5] ·
[CSS Variables 2][css-vars].
WCAG 2.2 Understanding: [1.1.1][wcag-111] · [1.4.11][wcag-1411] · [2.1.4][wcag-214] · [2.2.1][wcag-221] ·
[2.2.2][wcag-222] · [2.3.3][wcag-233].
MDN: [setTimeout][mdn-settimeout] · [performance.now()][mdn-now] · [Page Visibility API][mdn-visibility] ·
[requestAnimationFrame][mdn-raf] · [Autoplay guide][mdn-autoplay] · [Using the Notifications API][mdn-notif] ·
[Notification.requestPermission()][mdn-reqperm] · [Badging API][mdn-badging] · [timer role][mdn-timer-role] ·
[prefers-reduced-motion][mdn-prm] · [Crisp pixel art look][mdn-crisp] · [image-rendering][mdn-image-rendering] ·
[devicePixelRatio][mdn-dpr] · [devicePixelContentBoxSize][mdn-dpcbs] · [Optimizing canvas][mdn-canvas-opt] ·
[Pixel manipulation with canvas][mdn-pixels] · [steps()][mdn-steps] · [shape-rendering][mdn-shape-rendering] ·
[light-dark()][mdn-light-dark] · [Intersection Observer API][mdn-io].
MDN browser-compat-data: [AudioContext][bcd-audiocontext] · [Notification][bcd-notification] ·
[Navigator][bcd-navigator] · [image-rendering][bcd-image-rendering] · [ResizeObserverEntry][bcd-ro].
Chrome and web.dev: [Timer throttling in Chrome 88][chrome-throttle] ·
[chromestatus: intensive throttling][chromestatus-iwt] · [chromestatus: quick intensive throttling][chromestatus-quick] ·
[Page Lifecycle API][lifecycle] · [Freezing on Energy Saver][freeze] · [Autoplay policy][chrome-autoplay] ·
[Web Audio autoplay][chrome-webaudio-autoplay] · [Permission UX][webdev-perm] · [Rendering performance][webdev-rendering] ·
[blink-dev: throttling background workers (s)][blink-workers].
WebKit: [Auto-play policy changes for macOS][webkit-autoplay] · [bug 98474 (s)][webkit-bug-98474] ·
[bug 112308 (s)][webkit-bug-112308].
Prior art: [Sandspiel][sandspiel] · [species.rs][sandspiel-species] · [lib.rs][sandspiel-lib] ·
[Making Sandspiel][making-sandspiel] · [Dusty][dusty] · [Dusty script.js][dusty-script] ·
[Hackaday.io Digital Hourglass][hackaday-hourglass] · [itch.io Inverted hourglass][itch-hourglass] ·
[OpenGameArt Animated Hourglass (s)][oga-hourglass].
Products: [Apple, Set timers on iPhone][apple-timers] · [Microsoft, Focus in Windows 11][ms-focus] ·
[Forest][forest] · [Be Focused][befocused] · [Focus To-Do][focustodo] · [Flocus][flocus] · [Pomofocus][pomofocus] ·
[Cirillo, The Pomodoro Technique v1.3][cirillo] · [Time Timer][timetimer] · [How-To Geek (s)][htg-android] ·
[Session support][session-support] · [Flow help][flow-help].

## 11. What could not be verified

- **Safari's Web Audio rules beyond BCD's note.** Whether a context resumed once by a click can be resumed again
  from a timer after `suspend()`. WebKit's own posts found cover `<video>`/`<audio>`, not Web Audio.
- **WebKit's current background timer and CSS animation behaviour.** Only 2012–2013 Bugzilla entries were found
  (s).
- **Worker timers in Chrome today.** Only a 2018 blink-dev intent was found (s). Not needed for the proposal.
- **Sleep.** Whether `performance.now()` and HTML timers stop during sleep comes from MDN's summary ("only browsers
  on Windows keep ticking"). The HR Time draft read here does not say.
- **TanStack Start's head.** Whether `HeadContent` overwrites a `document.title` set by the page, and how the route
  should own a changing title, was not checked.
- **Product pages.** Google Clock's "+1" button comes from How-To Geek (s); no first-party Google Clock timer page
  was found (the help centre lists alarms and settings only). The Session and Flow support pages hold no timer
  settings (Session's answers are images). No first-party help for Focus To-Do, Tomatoes or Google Search's timer
  was found, so Focus To-Do and Be Focused are cited from their App Store listings. Apple's page does not describe
  an hours/minutes picker, adding time, or Live Activities. Microsoft's page gives no break lengths.
- **Assets.** OpenGameArt's "Animated Hourglass" (CC0 per search) returned 403; its licence and frame size are (s).
- **Cirillo's paper** was read from a university-hosted copy of v1.3 (2007), not from the author's site, whose
  product page returned 404.
- **Measurements.** The precompute and frame timings are from Node 26 on the development machine, not from a
  browser or a low-end phone. The `transitionrun` probe trick and reading colours through a 1 × 1 canvas are (k)
  and untested here.

[html-timers]: https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers
[html-rendering]: https://html.spec.whatwg.org/multipage/webappapis.html#rendering-opportunity
[html-activation]: https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation
[hr-time]: https://w3c.github.io/hr-time/
[webaudio]: https://webaudio.github.io/web-audio-api/
[aria-timer]: https://www.w3.org/TR/wai-aria-1.2/#timer
[aria-status]: https://www.w3.org/TR/wai-aria-1.2/#status
[aria-img]: https://www.w3.org/TR/wai-aria-1.2/#img
[mq5]: https://drafts.csswg.org/mediaqueries-5/#prefers-reduced-motion
[css-color-5]: https://drafts.csswg.org/css-color-5/#light-dark
[css-vars]: https://drafts.csswg.org/css-variables-2/#defining-variables
[wcag-111]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html
[wcag-1411]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
[wcag-214]: https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html
[wcag-221]: https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html
[wcag-222]: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
[wcag-233]: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
[mdn-settimeout]: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
[mdn-now]: https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
[mdn-visibility]: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
[mdn-raf]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
[mdn-autoplay]: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
[mdn-notif]: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
[mdn-reqperm]: https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static
[mdn-badging]: https://developer.mozilla.org/en-US/docs/Web/API/Badging_API
[mdn-timer-role]: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/timer_role
[mdn-prm]: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
[mdn-crisp]: https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look
[mdn-image-rendering]: https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering
[mdn-dpr]: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
[mdn-dpcbs]: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/devicePixelContentBoxSize
[mdn-canvas-opt]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
[mdn-pixels]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
[mdn-steps]: https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/steps
[mdn-shape-rendering]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/shape-rendering
[mdn-light-dark]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark
[mdn-io]: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
[bcd-audiocontext]: https://github.com/mdn/browser-compat-data/blob/main/api/AudioContext.json
[bcd-notification]: https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json
[bcd-navigator]: https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json
[bcd-image-rendering]: https://github.com/mdn/browser-compat-data/blob/main/css/properties/image-rendering.json
[bcd-ro]: https://github.com/mdn/browser-compat-data/blob/main/api/ResizeObserverEntry.json
[chrome-throttle]: https://developer.chrome.com/blog/timer-throttling-in-chrome-88
[chromestatus-iwt]: https://chromestatus.com/feature/4718288976216064
[chromestatus-quick]: https://chromestatus.com/feature/5580139453743104
[lifecycle]: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
[freeze]: https://developer.chrome.com/blog/freezing-on-energy-saver
[chrome-autoplay]: https://developer.chrome.com/blog/autoplay
[chrome-webaudio-autoplay]: https://developer.chrome.com/blog/web-audio-autoplay
[webdev-perm]: https://web.dev/articles/push-notifications-permissions-ux
[webdev-rendering]: https://web.dev/articles/rendering-performance
[blink-workers]: https://groups.google.com/a/chromium.org/d/topic/blink-dev/8xpEA-iNHwg
[webkit-autoplay]: https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/
[webkit-bug-98474]: https://bugs.webkit.org/show_bug.cgi?id=98474
[webkit-bug-112308]: https://bugs.webkit.org/show_bug.cgi?id=112308
[sandspiel]: https://github.com/MaxBittker/sandspiel
[sandspiel-species]: https://github.com/MaxBittker/sandspiel/blob/9936e06b07a583aedfba9589c0cead2917f405fb/crate/src/species.rs#L69-L89
[sandspiel-lib]: https://github.com/MaxBittker/sandspiel/blob/9936e06b07a583aedfba9589c0cead2917f405fb/crate/src/lib.rs#L180-L231
[making-sandspiel]: https://maxbittker.com/making-sandspiel
[dusty]: https://github.com/blaisereyes/dusty
[dusty-script]: https://github.com/blaisereyes/dusty/blob/9af9a581088ef4cbb08d3df8e107cc53ec424856/script.js#L114-L138
[hackaday-hourglass]: https://hackaday.io/project/165620-digital-hourglass
[itch-hourglass]: https://davitheoles.itch.io/inverted-hourglass
[oga-hourglass]: https://opengameart.org/content/animated-hourglass
[apple-timers]: https://support.apple.com/guide/iphone/set-timers-iph8241d6b2a/ios
[ms-focus]: https://support.microsoft.com/en-us/windows/how-to-use-focus-in-windows-11-cbcc9ddb-8164-43fa-8919-b9a2af072382
[forest]: https://www.forestapp.cc/
[befocused]: https://apps.apple.com/us/app/be-focused-focus-timer/id973134470
[focustodo]: https://apps.apple.com/us/app/focus-to-do-pomodoro-tasks/id1258530160?mt=12
[flocus]: https://help.flocus.com/en/articles/10247030-adjusting-focus-timer-lengths
[pomofocus]: https://pomofocus.io/
[cirillo]: https://internal.ischool.umd.edu/wp-content/uploads/2020/12/ThePomodoroTechnique_v1-3.pdf
[timetimer]: https://www.timetimer.com/
[htg-android]: https://www.howtogeek.com/244996/how-to-use-the-alarm-timer-and-stopwatch-on-android/
[session-support]: https://www.stayinsession.com/support
[flow-help]: https://www.flow.app/help
