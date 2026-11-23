import type { Syllabus } from './types'

export const PART_3 = [
  {
    id: 'component-stand',
    summary:
      'You add `apps/stand`, a Storybook 10 app that renders every UI kit component, planner widget and feature on its own, with a fixed plan, prop tables generated from JSDoc and toolbar switches for theme and language. Then every story becomes a test: Vitest opens it in headless Chromium, runs its `play` function and checks it with axe, once in the light theme and once in the dark.',
    whereWeAre:
      'The workspace has modules under `modules/*` composed by `apps/web`, four shared packages, lint that enforces the boundaries and CI that checks only what changed (chapters 9 to 12). A component is seen only inside the running app, with whatever data `packages/plan-data/data` holds that day. There is no catalog of the kit and no test that renders a component.',
    problem:
      'To look at a dialog you click through the planner until the state that opens it, and a change to `Button` can break a page nobody opens that day. Accessibility regressions, such as the faded text of a done event or a skipped heading level, stay invisible until someone notices. The workspace needs a place where each component renders in isolation with stable data, documents its own props, and fails a check when it stops rendering, when its interaction breaks or when axe finds a violation.',
    outcomes: [
      'Write a CSF3 story file next to a component: a `meta` checked with `satisfies Meta<typeof Component>`, args, argTypes and `fn()` callbacks.',
      'Declare toolbar globals (theme, language) and a decorator that applies them to every story.',
      'Script an interaction with a `play` function and assert on it with `expect` from `storybook/test`.',
      'Run every story as a Vitest browser test in headless Chromium with axe checks, in both themes, locally and in CI.',
      'Generate prop tables from JSDoc with `react-docgen`, and know which props it cannot expand.',
      'Defend the choice of Storybook over Ladle, React Cosmos and Histoire with the numbers that decided it.',
    ],
    concepts: [
      {
        term: 'Component stand (Storybook)',
        explanation:
          'A separate app that renders components outside the product. Storybook runs its own Vite dev server through `@storybook/react-vite`, finds story files by glob (`stories` in `.storybook/main.ts`) and shows each story in an iframe called the preview. Here it lives in `apps/stand`, never ships with the product, and globs `packages/ui/src/**` and `modules/*/src/**`, so stories sit next to their components and need no registration.',
        link: { label: 'Storybook: How to write stories', href: 'https://storybook.js.org/docs/writing-stories' },
      },
      {
        term: 'CSF3 (Component Story Format)',
        explanation:
          'A story file is an ES module. The default export, `meta`, names the component, its sidebar `title`, default `args` and `argTypes`; each named export is one story, an object that overrides some args or adds a `render` or a `play`. Writing `meta` as an object with `satisfies Meta<typeof Button>` keeps its literal type, so `StoryObj<typeof meta>` knows which required props the meta already supplies.',
        link: { label: 'Storybook: Component Story Format', href: 'https://storybook.js.org/docs/api/csf' },
      },
      {
        term: 'Args, argTypes and controls',
        explanation:
          'Args are the props a story passes to its component; the Controls panel edits them live. `argTypes` chooses the control or turns it off (`control: false` for a whole `plan`) and can file a prop under a category. Callbacks are `fn()` spies from `storybook/test`: each call shows in the Actions panel and can be asserted in a `play` function.',
        link: { label: 'Storybook: Args', href: 'https://storybook.js.org/docs/writing-stories/args' },
      },
      {
        term: 'Decorators, globals and the toolbar',
        explanation:
          'A decorator wraps every render of a story, like a provider around a component. Globals are values that belong to no single story, set from toolbar menus declared in `globalTypes`. `withToolbar` in `preview.tsx` reads the `theme` and `locale` globals, rewrites `<meta name="color-scheme">`, hands the locale to Paraglide with `overwriteGetLocale` and remounts the story with `key={locale}`, because message functions are plain calls, not subscriptions.',
        link: {
          label: 'Storybook: Toolbars & globals',
          href: 'https://storybook.js.org/docs/essentials/toolbars-and-globals',
        },
      },
      {
        term: 'Play functions',
        explanation:
          'A `play` function runs after the story renders and drives it like a user, with Testing Library queries (`within`, `findByRole`) and `expect`. It is a demo in the Interactions panel and an assertion in the test run at once. A dialog here opens in an effect, after the first render, so a play function waits for it with `findBy*`, not `getBy*`.',
        link: {
          label: 'Storybook: Play function',
          href: 'https://storybook.js.org/docs/writing-stories/play-function',
        },
      },
      {
        term: 'Vitest browser mode with the Storybook addon',
        explanation:
          '`@storybook/addon-vitest` turns every story into a Vitest test through the `storybookTest` plugin. Browser mode runs those tests in a real browser driven by Playwright instead of jsdom, so layout, focus and the native `<dialog>` behave as they do in Chromium. A story fails when it throws while rendering, when its `play` fails or when the accessibility check reports a violation.',
        link: {
          label: 'Storybook: Vitest addon',
          href: 'https://storybook.js.org/docs/writing-tests/integrations/vitest-addon',
        },
      },
      {
        term: 'axe accessibility checks',
        explanation:
          '`@storybook/addon-a11y` runs the axe-core engine against each rendered story: contrast, labels, roles, heading order. `parameters.a11y.test` decides what a finding does: `error` fails the test, `todo` reports it as a warning and keeps it in the panel, `off` skips it. The stand sets `error` for every story in `preview.tsx`.',
        link: {
          label: 'Storybook: Accessibility tests',
          href: 'https://storybook.js.org/docs/writing-tests/accessibility-testing',
        },
      },
      {
        term: 'react-docgen and autodocs',
        explanation:
          "With `tags: ['autodocs']` every component gets a Docs page, and its prop table comes from a docgen tool that reads the source: the description is the JSDoc above the component, each prop description the comment above it in `Props`. `react-docgen` parses one file at a time, so props that come from another type, such as `ComponentProps<'button'>`, are not listed.",
        link: { label: 'react-docgen', href: 'https://react-docgen.dev/' },
      },
    ],
    decisions: [
      {
        question: 'Which tool should the component stand be built on?',
        options: [
          {
            name: 'Storybook 10.6',
            pros: [
              '38.9 M downloads a week, about 75 times Ladle, the runner-up',
              '80 stable releases in twelve months; peer ranges already name React 19 and Vite 8',
              'Stories, generated prop tables, MDX pages, a toolbar, axe checks and scripted interactions in one tool',
            ],
            cons: [
              'The heaviest option: 96 packages added on install and a 9 MB static build',
              'Version 11, with a smaller install and prop docs through the TypeScript 7.1 native API, was still in beta',
            ],
          },
          {
            name: 'Ladle',
            pros: ['The runner-up: 0.52 M downloads a week', 'Written pages in MDX and axe checks built in'],
            cons: [
              'No release for a year',
              'Ships its own `vite ^6` and `@vitejs/plugin-react ^4`, not Vite 8',
              'No generated prop tables and no interaction tests',
            ],
          },
          {
            name: 'React Cosmos',
            pros: ['Actively maintained', 'Peer ranges fit React 19 and Vite'],
            cons: [
              'No documentation layer: the docs would be a second tool',
              'No interaction tests built in, and no axe checks in its docs',
            ],
          },
        ],
        chosen: 'Storybook 10.6',
        why: 'The comparison in `docs/component-stand.md`, with numbers fetched from the npm registry and the npm downloads API on 2026-11-22, found that the most used tool is also the most current, and the only one that covers stories, prop docs, written pages, a theme and language toolbar, axe checks and scripted interactions at once. The other candidates fell out in the same comparison: Histoire has no React plugin, React Styleguidist runs on webpack, and Docz and Preview.js have not released since 2023 and 2024. The cost of Storybook is accepted because the stand is its own app and never ships with the product.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/component-stand.md', note: 'Which tool, and why: the table and The choice' },
          { kind: 'commit', ref: '1800d6a', note: 'docs: compare component stand tools and describe the stand' },
          { kind: 'commit', ref: '983f61a', note: 'build: add the component stand app on storybook 10' },
        ],
      },
      {
        question: 'Which docgen should build the prop tables?',
        options: [
          {
            name: 'react-docgen',
            pros: [
              'Parses each component file on its own: no TypeScript compiler needed',
              'Reads the JSDoc above the component and above each prop',
            ],
            cons: ["Does not expand props declared in another type, such as `ComponentProps<'button'>`"],
          },
          {
            name: 'react-docgen-typescript',
            pros: ['Resolves inherited and imported prop types through the type checker'],
            cons: ['Calls the TypeScript compiler API, which TypeScript 7 does not have'],
          },
          {
            name: 'No docgen: argTypes written by hand',
            pros: ['Full control over every row'],
            cons: ['Descriptions drift away from the code they describe'],
          },
        ],
        chosen: 'react-docgen',
        why: 'The workspace runs TypeScript 7, which has no compiler API, so `react-docgen-typescript` cannot run; `main.ts` says so in a comment and the stand document repeats it. The gap is closed by hand where it matters: `button.stories.tsx` lists the common native `<button>` attributes in `argTypes` under their own category.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'apps/stand/.storybook/main.ts', note: 'the comment above `reactDocgen`' },
          { kind: 'file', ref: 'docs/component-stand.md', note: 'Decisions inside the setup' },
          { kind: 'file', ref: 'packages/ui/src/button.stories.tsx', note: 'the `native` helper and its comment' },
        ],
      },
      {
        question: 'What should an accessibility finding do in a test run?',
        options: [
          {
            name: 'Fail the story, with a commented todo per story as the only escape',
            pros: [
              'A regression stops CI',
              'A known finding stays visible in the panel and as a warning until it is fixed',
            ],
            cons: ['Existing findings must be fixed or marked before the run is green'],
          },
          {
            name: 'Warn only, todo for every story',
            pros: ['Never blocks a merge'],
            cons: ['Warnings are read rarely; regressions ship'],
          },
          {
            name: 'Panel only, no test',
            pros: ['No setup'],
            cons: ['Depends on someone opening the panel on the right story'],
          },
        ],
        chosen: 'Fail the story, with a commented todo per story as the only escape',
        why: 'The rule in `docs/component-stand.md` is that no story is exempt. When the tests were switched on in `8b71673`, eight story files carried known findings and were marked `todo`, each with a comment naming it. `6495a57` fixed them (done events toned down through colours instead of opacity, heading levels, a label that matches its text) and removed every `todo`.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'apps/stand/.storybook/preview.tsx', note: "`a11y: { test: 'error' }` and its comment" },
          { kind: 'commit', ref: '8b71673', note: 'eight files marked todo, each named' },
          { kind: 'commit', ref: '6495a57', note: 'no story defers its accessibility check any more' },
        ],
      },
      {
        question: 'How should the stories also run in the dark theme?',
        options: [
          {
            name: 'A second run with an environment variable read by `initialGlobals`',
            pros: ['One Vitest config and one preview', 'The variable sets the theme the same way the toolbar does'],
            cons: ['Two runs one after the other inside one Nx target', '`preview.tsx` has to read `import.meta.env`'],
          },
          {
            name: 'One Vitest project per theme with `storybookTest({ initialGlobals })`',
            pros: [
              'Documented by the addon and present in the installed 10.6.8',
              'One Vitest invocation runs both projects',
            ],
            cons: ['The plugin setup is repeated per project'],
          },
          {
            name: 'A dark copy of every story',
            pros: ['Visible in the sidebar'],
            cons: ['Doubles the stories and has to be kept in step by hand'],
          },
        ],
        chosen: 'A second run with an environment variable read by `initialGlobals`',
        why: 'The repository records what was done, not why: `6495a57` makes `stand:test` run the stories a second time in the dark theme, and `preview.tsx` reads `VITE_STAND_THEME` for the initial global. This is a reconstruction: the variable needed no second Vitest project and kept `vitest.config.ts` at 22 lines, while the `initialGlobals` plugin option would have done the same job.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '6495a57' },
          { kind: 'file', ref: 'apps/stand/package.json', note: 'the `test` script' },
          {
            kind: 'doc',
            ref: 'https://storybook.js.org/docs/writing-tests/integrations/vitest-addon',
            note: 'the `initialGlobals` option',
          },
        ],
      },
    ],
    steps: [
      {
        title: 'Create the stand app and point it at the stories',
        detail:
          '`apps/stand` is a workspace app tagged `type:app` and `scope:stand`, with Storybook and its docs, a11y and vitest addons from the pnpm catalog. `main.ts` globs the written pages in `src/docs` and every `*.stories.tsx` under `packages/ui/src` and `modules/*/src`, turns telemetry off and picks `react-docgen`. `vite.config.ts` gives the Vite builder of Storybook the Tailwind and React plugins.',
        files: [
          {
            path: 'apps/stand/.storybook/main.ts',
            lines: [1, 25],
            note: "Stories glob, addons, telemetry off, `reactDocgen: 'react-docgen'`.",
          },
          {
            path: 'apps/stand/package.json',
            lines: [6, 12],
            note: 'The dev, build and test scripts; `test` runs Vitest twice.',
          },
          { path: 'apps/stand/vite.config.ts', lines: [1, 8], note: 'The Vite config Storybook starts from.' },
        ],
        commands: ['pnpm run stand'],
        commit: '983f61a',
      },
      {
        title: 'Give the stories fixed data',
        detail:
          "Stories must not read `packages/plan-data`, or editing the plan in the app would change every picture. `fixtures.ts` builds the real schedule in memory with `buildPlan(DEFAULT_CONFIG, '2026-11-22')`, pins `fixtureNow` at Wednesday 2026-12-02 12:40, marks every session before it done and fills a trash through `applyChange`. It is a second entry of the package, `@lc/plan-domain/fixtures`, so the product never imports it.",
        files: [
          {
            path: 'packages/plan-domain/src/fixtures.ts',
            lines: [17, 44],
            note: 'The generated plan, the pinned clock, the done marks and the trash.',
          },
          {
            path: 'packages/plan-domain/package.json',
            lines: [6, 9],
            note: 'The `./fixtures` export next to the main entry.',
          },
        ],
        commit: 'b3a4fd5',
      },
      {
        title: 'Write the first CSF3 stories',
        detail:
          "A story file sits next to its component and imports it by relative path. `meta` names the sidebar place and the component, sets default args with `fn()` callbacks, and is checked with `satisfies Meta<typeof Button>`; each export is a story, and a JSDoc comment above it becomes its caption. Because docgen cannot expand `ComponentProps<'button'>`, the button story lists the native attributes in `argTypes` under a category of their own.",
        files: [
          {
            path: 'packages/ui/src/button.stories.tsx',
            lines: [1, 55],
            note: 'Meta, the `native` helper for argTypes, and four stories.',
          },
          {
            path: 'packages/ui/src/button.tsx',
            lines: [3, 15],
            note: 'The JSDoc on the component and its props that the Docs page shows.',
          },
        ],
        commit: 'b3181ff',
      },
      {
        title: 'Add the theme and language toolbar',
        detail:
          '`globalTypes` declares two toolbar menus, and `initialGlobals` starts on the light theme and Russian. The `withToolbar` decorator calls `applyGlobals`, which rewrites `<meta name="color-scheme">` (the same tag the app pins) and answers Paraglide through `overwriteGetLocale`. `Localized` subscribes with `useSyncExternalStore` and remounts the story under `key={locale}`.',
        files: [
          {
            path: 'apps/stand/.storybook/preview.tsx',
            lines: [27, 48],
            note: 'The `Localized` remount and the `withToolbar` decorator.',
          },
          {
            path: 'apps/stand/.storybook/preview.tsx',
            lines: [55, 86],
            note: '`tags`, `decorators`, `initialGlobals` and `globalTypes`.',
          },
          {
            path: 'apps/stand/src/globals.ts',
            lines: [1, 46],
            note: 'The theme and locale store that the decorator and the docs container read.',
          },
        ],
        commit: '983f61a',
      },
      {
        title: 'Frame dialog stories and let them reopen',
        detail:
          'A modal covers the whole document, so on a docs page each dialog story gets its own iframe (`docs.story.inline: false`). The toolbar does not reach those frames, so `globals.ts` passes theme and language down with `postMessage`. Esc closes a native dialog while the `open` arg stays `true`; stories that start open set `parameters.dialog`, and `Reopenable` then offers a button that mounts the story again.',
        files: [
          {
            path: 'packages/ui/src/modal.stories.tsx',
            lines: [7, 32],
            note: '`parameters: { dialog: true, docs: { story: { inline: false } } }`.',
          },
          {
            path: 'apps/stand/src/reopen.tsx',
            lines: [4, 38],
            note: 'Listens for `close` in the capture phase and remounts under a new key.',
          },
          {
            path: 'apps/stand/src/globals.ts',
            lines: [48, 82],
            note: 'The question and answer messages between the page and its frames.',
          },
        ],
        commit: '94a39a4',
      },
      {
        title: 'Script an interaction with play',
        detail:
          'The palette stories search the plan and add a quick event from a typed line. The play function queries the document body, because the dialog is rendered at the top level, waits for the combobox with `findByRole`, sets the value with `fireEvent.change`, presses Enter on the input itself and asserts the `fn()` spy was called with the expected event.',
        files: [
          {
            path: 'modules/planner/src/features/command-palette/ui/CommandPalette.stories.tsx',
            lines: [33, 65],
            note: 'Two play functions and the comments on why `userEvent.type` is not used.',
          },
        ],
        commit: '07fdacb',
      },
      {
        title: 'Run every story as a test',
        detail:
          '`vitest.config.ts` merges the Vite config with the `storybookTest` plugin and enables browser mode with the Playwright provider and one headless Chromium instance. `preview.tsx` sets `a11y.test` to `error`, so axe findings fail a story. CI installs Chromium and runs `stand:test` after the affected checks.',
        files: [
          { path: 'apps/stand/vitest.config.ts', lines: [1, 22], note: 'The whole test setup.' },
          {
            path: 'apps/stand/.storybook/preview.tsx',
            lines: [87, 92],
            note: 'Accessibility violations fail the test.',
          },
          { path: '.github/workflows/ci.yml', lines: [33, 34], note: 'Chromium install and the story tests in CI.' },
        ],
        commands: ['pnpm --filter @lc/stand exec playwright install chromium', 'pnpm run stand:test'],
        commit: '8b71673',
      },
      {
        title: 'Clear the findings and test the dark theme too',
        detail:
          'Done events were dimmed with `opacity`, which faded their text below the contrast threshold; they are now toned down with `color-mix` on the border and background and keep a readable text colour. The `test` script runs Vitest again with `VITE_STAND_THEME=dark`, which `preview.tsx` turns into the initial global. The runner serves stories without `preview-head.html`, so `globals.ts` creates the `color-scheme` meta tag when it is missing.',
        files: [
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [113, 115],
            note: '`EVENT_DONE`: colours instead of opacity.',
          },
          {
            path: 'apps/stand/.storybook/preview.tsx',
            lines: [58, 59],
            note: 'The initial theme from `VITE_STAND_THEME`.',
          },
          {
            path: 'apps/stand/src/globals.ts',
            lines: [21, 33],
            note: 'Creates the meta tag when the runner did not serve it.',
          },
        ],
        commit: '6495a57',
      },
      {
        title: 'Write the docs at the source',
        detail:
          'Descriptions moved from story files into JSDoc above components and props, where docgen reads them. `ComponentPage` replaces the default docs page to add the path of the documented file, and `Catalog` builds the Introduction list from the story files with `import.meta.glob`, so a new component appears without editing a table.',
        files: [
          {
            path: 'apps/stand/src/docs/page.tsx',
            lines: [1, 23],
            note: 'The docs page: title, source path, description, primary story, controls, stories.',
          },
          {
            path: 'apps/stand/src/docs/catalog.tsx',
            lines: [16, 46],
            note: 'Every story file read eagerly at build time.',
          },
          {
            path: 'apps/stand/src/docs/Introduction.mdx',
            lines: [1, 21],
            note: 'A written MDX page that renders the catalog.',
          },
        ],
        commands: ['pnpm run stand:build'],
        commit: '2bf664d',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm --filter @lc/stand exec playwright install chromium',
        'pnpm run stand',
        'pnpm run stand:test',
        'pnpm run stand:build',
      ],
      expect: [
        'Playwright downloads Chromium once; later runs reuse it.',
        'Storybook serves http://localhost:6006. The sidebar starts with Introduction, Design tokens and UI kit, and the toolbar has the theme and language menus.',
        'Vitest runs every story twice, light then dark, in headless Chromium, and all pass. Break an assertion in a play function or remove an `aria-label` and the run fails.',
        'A static site is written to `apps/stand/dist`.',
      ],
      quiz: [
        {
          question: 'Why does the stand use `react-docgen` instead of `react-docgen-typescript`?',
          options: [
            'It is faster on large files',
            '`react-docgen-typescript` needs the TypeScript compiler API, which TypeScript 7 does not have',
            '`react-docgen` expands props inherited from other types',
            'Storybook 10 removed support for `react-docgen-typescript`',
          ],
          answer: 1,
          explanation:
            'The comment in `main.ts` gives the reason. The price is that inherited props such as the native `<button>` attributes are not in the generated table.',
        },
        {
          question: 'In a play function here, how do you type into a controlled input?',
          options: [
            "`userEvent.type(input, 'ADK')`",
            "`fireEvent.change(input, { target: { value: 'ADK' } })`",
            'Assign `input.value` directly',
            'Change the arg with `useArgs`',
          ],
          answer: 1,
          explanation:
            'With React 19 the user-event build inside `storybook/test` writes through the value tracker React keeps on the input, so React sees no change and `onChange` never runs (`07fdacb`).',
        },
        {
          question: "What does `parameters.a11y.test: 'todo'` do for one story?",
          options: [
            'Skips the story in the test run',
            'Keeps the violation in the panel and reports it as a warning instead of failing',
            'Turns axe off for that story',
            'Fails only in the dark theme',
          ],
          answer: 1,
          explanation:
            'It is the documented escape for a known finding. The stand requires a comment naming the finding and removes the parameter with the fix.',
        },
      ],
    },
    pitfalls: [
      'Typing with `userEvent.type` from `storybook/test` never reached the palette query, so `6d378a7` dropped the scripted search. `07fdacb` found the cause: under React 19 the bundled user-event writes through the value tracker React keeps on a controlled input, so `onChange` never runs. The story now uses `fireEvent.change`.',
      "On a docs page every dialog story is its own frame and only one frame has focus, so `userEvent.keyboard` reached nothing. Send the key to the element: `fireEvent.keyDown(input, { key: 'Enter' })` (`652d510`).",
      'Esc or a backdrop click closes a native `<dialog>` while the `open` arg stays `true`, and the story stays blank until the control is toggled twice. `parameters.dialog` and `Reopenable` fix that (`94a39a4`).',
      'Building the app and the stand in parallel failed: the Paraglide plugin of the web build rewrites `packages/i18n/src/paraglide` while the stand reads it. The stand build target sets `parallelism: false` (`dcdb5fe`, explained in `326e0d1`).',
      'The test runner serves stories without `preview-head.html`, so the `color-scheme` meta tag was missing and a theme switch had nothing to rewrite; `globals.ts` now creates it (`6495a57`).',
      'Dimming with `opacity` fades the text too and fails axe contrast. Tone down with colours and keep the text readable (`6495a57`).',
    ],
    tradeoffs: [
      'Storybook is the heaviest option (96 packages, a 9 MB build); accepted because the stand never ships with the product.',
      '`react-docgen` keeps the workspace on TypeScript 7 but leaves inherited props out of the tables, so components that forward native attributes list them by hand.',
      'Every story runs twice in a real browser: about ten seconds and a Chromium download in CI, in exchange for render, interaction and accessibility checks on every component.',
      'Fixed fixtures make pictures and tests stable but cannot show bugs that only real, edited data triggers; the running app is still where those are found.',
    ],
    links: [
      { label: 'Storybook: How to write stories', href: 'https://storybook.js.org/docs/writing-stories' },
      { label: 'Storybook: Component Story Format', href: 'https://storybook.js.org/docs/api/csf' },
      { label: 'Storybook: Toolbars & globals', href: 'https://storybook.js.org/docs/essentials/toolbars-and-globals' },
      { label: 'Storybook: Play function', href: 'https://storybook.js.org/docs/writing-stories/play-function' },
      {
        label: 'Storybook: Vitest addon',
        href: 'https://storybook.js.org/docs/writing-tests/integrations/vitest-addon',
      },
      {
        label: 'Storybook: Accessibility tests',
        href: 'https://storybook.js.org/docs/writing-tests/accessibility-testing',
      },
      { label: 'Vitest: Browser Mode', href: 'https://vitest.dev/guide/browser/' },
      { label: 'react-docgen', href: 'https://react-docgen.dev/' },
    ],
    next: 'Chapter 14 turns every stored change into a step of a history, with undo, redo and a trash, and the stand gets stories for both dialogs.',
  },
  {
    id: 'history',
    summary:
      'You replace an undo that could invert only a few kinds of change with a history: every stored `PlanChange` becomes a step that keeps the edits it led to, so the plan can move to any point with Ctrl/⌘ Z, Ctrl/⌘ Shift Z or a History window. Removing an event or a calendar puts it in a trash kept in `edits.json` for 30 days. Both are pure functions in `plan-domain`, written to disk only by `store.ts`.',
    whereWeAre:
      'Every edit in the viewer is one `PlanChange` applied by the pure reducer `applyChange` (chapter 7), extended in `931fbd6` with custom calendars, own events and progress tracking. The server writes the result to `edits.json`, and the browser shows a pending change before the server answers. An undo bar can take back the last change only when someone wrote an inverse for its kind.',
    problem:
      'The inverse was written per kind: `event.patch`, `event.remove`, `calendar.clear` and `calendar.remove` had one, and every other change returned `null`, so it could not be undone. Each new kind of change would need a new inverse, there was no redo, and there was no way back more than one step. Deleting was final as well: a removed calendar took its events with it.',
    outcomes: [
      'Model undo and redo as a cursor over stored snapshots instead of inverse commands.',
      'Bound the history at 100 steps by folding the oldest step into a new origin.',
      'Detect a history that no longer describes the data on disk and start over safely.',
      'Implement soft delete with removal times and a purge that keeps generated items from coming back.',
      'Wire Ctrl/⌘ Z through a server function and router invalidation, with optimistic changes in the browser.',
      'Make the compiler refuse a new kind of change until the history can describe it.',
    ],
    concepts: [
      {
        term: 'Inverse commands versus snapshots',
        explanation:
          'There are two classic ways to undo. With commands, every action knows its inverse and undo runs it: compact, but every action needs a correct inverse. With snapshots (the memento idea), you store the state after each action and undo restores an earlier one: more memory, but it works for any action. Here the state is `PlanEdits`, the overlay on the generated schedule, so a snapshot per step stays small.',
      },
      {
        term: 'Undo cursor and the redo branch',
        explanation:
          '`PlanHistory` holds `origin` (the edits before the first step), `steps` (each with the edits right after it) and `cursor` (how many steps are applied). Undo and redo only move the cursor, and `historyEdits(history)` reads the edits at that point. A new change after an undo cuts the steps past the cursor, as in any editor: they cannot be redone.',
      },
      {
        term: 'Bounded history',
        explanation:
          '`recordChange` keeps at most `HISTORY_LIMIT` (100) steps. When one more arrives, the oldest is dropped and its edits become the new `origin`, so the earliest reachable state is still exact rather than approximate.',
      },
      {
        term: 'Soft delete and a trash',
        explanation:
          'Removing writes the removal time into `edits.removed` instead of deleting anything. `trashOf` lists what can still be restored with the days left; `purgeTrash` drops what is older than `TRASH_DAYS` (30). An expired generated item keeps a `null` mark, because the next `pnpm run plan` would otherwise generate it again.',
        link: {
          label: 'MDN: structuredClone()',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone',
        },
      },
      {
        term: 'Server functions and router invalidation',
        explanation:
          'TanStack Start `createServerFn` declares a function that runs on the server and is called from the browser like an async function, with a `validator` for its untrusted input. `travelPlanHistory` writes the edits of the chosen step; the route then calls `router.invalidate()`, the loader runs again and the page receives fresh state.',
        link: {
          label: 'TanStack Start: Server Functions',
          href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-functions',
        },
      },
      {
        term: 'Optimistic changes',
        explanation:
          '`usePlanSession` keeps changes on their way to the server in `pending` and applies them to the plan on screen with the same `applyChange`, so a dragged event does not jump back while saving. When the loader returns, the server state replaces the preview and the pending change is dropped.',
        link: {
          label: 'TanStack Router: Data Loading',
          href: 'https://tanstack.com/router/latest/docs/framework/react/guide/data-loading',
        },
      },
      {
        term: 'Exhaustiveness with `satisfies never`',
        explanation:
          "A `switch` over a discriminated union can end with `default: return change satisfies never`. When someone adds a member to `PlanChange`, `change` is no longer `never` in that branch and the build fails, so `subjectOf` cannot forget to describe a new kind. The test file uses a mapped type over `PlanChange['type']` for the same purpose.",
        link: { label: 'TypeScript: Narrowing', href: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html' },
      },
    ],
    decisions: [
      {
        question: 'How should undo work for every kind of change?',
        options: [
          {
            name: 'An inverse change per kind (command pattern)',
            pros: ['One small change stored per step', 'Undo is itself an ordinary change'],
            cons: [
              'Every kind needs a hand-written inverse; at `972da82` four kinds had one and the rest returned `null`',
              'An inverse that captures the old values wrongly corrupts the plan on undo',
            ],
          },
          {
            name: 'A snapshot of the edits after every step',
            pros: [
              'Works for every kind, present and future, with no extra code',
              'Jumps to any step, not only one back',
            ],
            cons: [
              'Stores a whole `PlanEdits` per step',
              'Needs a check that the newest snapshot still matches the file',
            ],
          },
          {
            name: 'Replay the changes from the origin',
            pros: ['Only the changes are stored'],
            cons: [
              'Each move back re-runs `applyChange` up to the cursor',
              'Changes that read the clock (removal times, new ids) replay differently',
            ],
          },
        ],
        chosen: 'A snapshot of the edits after every step',
        why: '`32c9733` says each stored change becomes a step of `PlanHistory` with the edits it led to, so the plan can be moved to any point, and that this replaces the undo that only knew event patches. Storing the result of a change, not its inverse, is what makes undo hold for every kind.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '32c9733' },
          {
            kind: 'file',
            ref: 'modules/planner/src/pages/planner/model/use-plan-session.ts',
            note: 'at 972da82: `inverse()` with `default: return null`',
          },
        ],
      },
      {
        question: 'Where should the history be kept?',
        options: [
          {
            name: 'An untracked `data/history.json` next to the edits',
            pros: [
              'Survives reloads and server restarts',
              'Every writer of this checkout shares it: the planner, `/api/plan-update`, the MCP server',
              'Not committed: undo does not create git diffs',
            ],
            cons: ['Lost with the checkout', 'Must be checked against `edits.json`, which git or a person can change'],
          },
          {
            name: 'Browser memory or `localStorage`',
            pros: ['No server code'],
            cons: ['Changes made by another tool are not in it', 'One history per browser'],
          },
          {
            name: 'Committed next to `edits.json`',
            pros: ['Travels with the repository'],
            cons: ['Every undo is a diff in git'],
          },
        ],
        chosen: 'An untracked `data/history.json` next to the edits',
        why: '`32c9733` puts the project history in the untracked `data/history.json` and keeps the history of a file opened from disk in memory. `store.ts` states the reason next to the path: it is local to a checkout, a record of what was done here, not part of the plan.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '32c9733' },
          { kind: 'file', ref: 'packages/plan-data/src/store.ts', note: 'the comment above `HISTORY_FILE`' },
          { kind: 'file', ref: '.gitignore', note: '`packages/plan-data/data/history.json`' },
        ],
      },
      {
        question: 'What should deleting do?',
        options: [
          {
            name: 'Delete at once',
            pros: ['Nothing to purge'],
            cons: [
              'No way back once the undo history moved on',
              'A generated event comes back on the next `pnpm run plan`',
            ],
          },
          {
            name: 'A trash with removal times, restorable for 30 days',
            pros: [
              'Restore from a dialog long after undo would help',
              'Purge keeps generated items hidden with a `null` mark',
            ],
            cons: ['Every reader of the edits must honour `removed`', 'More states to test'],
          },
          {
            name: 'An archive flag kept forever',
            pros: ['Nothing is ever lost'],
            cons: ['The edits file only grows'],
          },
        ],
        chosen: 'A trash with removal times, restorable for 30 days',
        why: '`972da82`: removing an event or a calendar, or clearing a calendar, moves it to a trash kept in `edits.json`; it can be restored for 30 days and is purged on the next write after that. The comment on `purgeTrash` explains the `null` mark: without it the schedule would bring a generated item back.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '972da82' },
          { kind: 'file', ref: 'packages/plan-domain/src/trash.ts', note: 'the JSDoc of `purgeTrash`' },
        ],
      },
      {
        question: 'What happens when `edits.json` was changed outside the viewer?',
        options: [
          {
            name: 'Start an empty history whose origin is the current edits',
            pros: ['Never moves the plan to a snapshot that ignores the outside change'],
            cons: ['Earlier steps are lost'],
          },
          {
            name: 'Keep the old history',
            pros: ['No steps lost'],
            cons: ['The next undo overwrites the outside change with an old snapshot'],
          },
          {
            name: 'Merge the outside change into every snapshot',
            pros: ['Keeps both'],
            cons: ['Needs a three-way merge of edits and a policy for conflicts'],
          },
        ],
        chosen: 'Start an empty history whose origin is the current edits',
        why: '`32c9733` says the history starts over when the edits were changed outside the viewer. `inSync` compares the edits at the cursor with the file; the comment on it says that when they differ the file was changed by hand or by another tool and the history no longer describes it, so `currentHistory` returns `emptyHistory(edits)`.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '32c9733' },
          { kind: 'file', ref: 'packages/plan-domain/src/history.ts', note: 'the comment on `inSync`' },
          { kind: 'file', ref: 'packages/plan-data/src/store.ts', note: '`currentHistory`' },
        ],
      },
    ],
    steps: [
      {
        title: 'Keep removals as a trash in the edits',
        detail:
          '`PlanEdits.removed` maps event uids and calendar ids to the ISO time they were removed, or `null` once they can no longer be restored. `event.remove`, `calendar.remove` and `calendar.clear` write that time, `trash.restore` deletes the marks that are still restorable, and `trashOf` turns the marks into what the Trash dialog lists, with days left.',
        files: [
          {
            path: 'packages/plan-domain/src/edits.ts',
            lines: [16, 32],
            note: 'The `removed` field and what `null` means.',
          },
          {
            path: 'packages/plan-domain/src/changes.ts',
            lines: [437, 478],
            note: 'Remove, clear, restore and empty in `applyChange`.',
          },
          { path: 'packages/plan-domain/src/trash.ts', lines: [5, 50], note: '`TRASH_DAYS` and `trashOf`.' },
        ],
        commit: '972da82',
      },
      {
        title: 'Purge what outstayed the trash',
        detail:
          '`purgeTrash` works on a `structuredClone` of the edits. An expired item made in the viewer disappears with its patches; an expired generated item keeps a `null` mark so the schedule does not resurrect it. `writePlan` purges on every write, and `trash.empty` calls the same function with `now = Infinity`.',
        files: [
          {
            path: 'packages/plan-domain/src/trash.ts',
            lines: [52, 87],
            note: '`purgeTrash` and the two kinds of expired item.',
          },
          {
            path: 'packages/plan-data/src/store.ts',
            lines: [145, 158],
            note: '`writePlan` purges before it writes both files.',
          },
        ],
        commit: '972da82',
      },
      {
        title: 'Model the history as snapshots with a cursor',
        detail:
          '`recordChange` cuts the steps past the cursor, appends the new step with the edits after it, and folds steps beyond `HISTORY_LIMIT` into `origin`. `historyEdits` reads the edits at any cursor and `travel` clamps a cursor into range. `parseHistory` reads the file as untrusted input and returns an empty history for anything malformed.',
        files: [
          {
            path: 'packages/plan-domain/src/history.ts',
            lines: [6, 47],
            note: 'The types: steps, stored edits, origin, cursor.',
          },
          {
            path: 'packages/plan-domain/src/history.ts',
            lines: [89, 136],
            note: '`recordChange`, `historyEdits`, `travel`, `inSync`, `historyView`.',
          },
          {
            path: 'packages/plan-domain/src/history.ts',
            lines: [138, 157],
            note: '`parseHistory`: malformed gives empty.',
          },
        ],
        commit: '32c9733',
      },
      {
        title: 'Pin the behaviour with tests',
        detail:
          'Five tests state the contract in plain words: travelling moves the edits back and forward, a change after an undo drops the undone steps, the oldest of 101 steps becomes the origin, a hand edit makes the history out of sync, and a history survives JSON while a broken one reads as empty.',
        files: [
          {
            path: 'packages/plan-domain/src/history.test.ts',
            lines: [11, 66],
            note: 'The `record` helper and the five tests.',
          },
        ],
        commands: ['pnpm run test'],
        commit: 'e24a983',
      },
      {
        title: 'Store each change as a step on the server',
        detail:
          '`currentHistory` reads the file and resets it when `inSync` fails. `saveChanges` purges first, then for each change records the plan before it, applies it and records the step; only when every change applied does it write the plan, the edits and the history. Since `7267049` this one function serves the planner, `/api/plan-update` and the MCP server.',
        files: [
          {
            path: 'packages/plan-data/src/store.ts',
            lines: [40, 43],
            note: 'The three files; the history is local to the checkout.',
          },
          { path: 'packages/plan-data/src/store.ts', lines: [160, 184], note: '`currentHistory` and `saveChanges`.' },
          { path: '.gitignore', lines: [17, 17], note: 'The history is never committed.' },
        ],
        commit: '7267049',
      },
      {
        title: 'Travel through a server function',
        detail:
          '`travelPlanHistory` validates that the cursor is a non-negative integer, refuses on a read-only host, writes the edits of that step and the moved history, and returns fresh `PlanState`. The route passes `onTravel` to the planner module, which knows nothing about servers: it calls the callback and the route invalidates the router.',
        files: [
          {
            path: 'apps/web/src/server/plan.ts',
            lines: [60, 91],
            note: '`savePlanChange`, `savePlanChanges` and `travelPlanHistory`.',
          },
          {
            path: 'apps/web/src/routes/index.tsx',
            lines: [78, 89],
            note: 'The callbacks the route hands to `PlannerPage`.',
          },
        ],
        commit: '32c9733',
      },
      {
        title: 'Wire undo in the browser',
        detail:
          '`usePlanSession` previews pending changes and, for a plan file opened from disk, keeps a history of its own in memory with the same `recordChange` and `travel`. Since `8fda5fe`, `useQuietChange` derives `canUndo`, `undo` and `redo` from the cursor. The page binds `mod+z` and `mod+shift+z`; `useShortcuts` maps Ctrl and ⌘ to `mod` and leaves the keys to a text field when one has focus.',
        files: [
          {
            path: 'modules/planner/src/pages/planner/model/use-plan-session.ts',
            lines: [62, 137],
            note: 'Pending changes, the in-memory history of a file, and `go`.',
          },
          {
            path: 'modules/planner/src/pages/planner/model/use-quiet-change.ts',
            lines: [23, 42],
            note: 'Undo and redo as cursor moves.',
          },
          {
            path: 'modules/planner/src/pages/planner/ui/PlannerPage.tsx',
            lines: [312, 322],
            note: 'The key bindings.',
          },
          {
            path: 'packages/ui/src/shortcuts.ts',
            lines: [13, 36],
            note: '`mod` for Ctrl or ⌘, and the text field exception for `+z`.',
          },
        ],
        commit: '32c9733',
      },
      {
        title: 'Describe each step and show the timeline',
        detail:
          'A step stores `subject`, the title or name it touched as it was then, read from the plan before the change. `describeStep` turns a step into one localized line, and `HistoryDialog` lists every point of the timeline: the current one is marked with `aria-current="step"` and undone steps are struck through.',
        files: [
          {
            path: 'packages/plan-domain/src/history.ts',
            lines: [49, 87],
            note: '`subjectOf`, read before the change.',
          },
          {
            path: 'modules/planner/src/features/history/model/describe-step.ts',
            lines: [15, 66],
            note: 'One line per kind of change.',
          },
          {
            path: 'modules/planner/src/features/history/ui/HistoryDialog.tsx',
            lines: [34, 46],
            note: 'Picking a point calls `onTravel`.',
          },
        ],
        commit: '32c9733',
      },
      {
        title: 'Make a new kind of change fail the build until it is described',
        detail:
          '`subjectOf` ends with `return change satisfies never`, so a new member of `PlanChange` is a type error there. The test file declares `EXAMPLES` as a mapped type over every `type`, so a new kind does not compile until it has an example that round-trips through JSON and applies.',
        files: [
          { path: 'packages/plan-domain/src/history.ts', lines: [83, 86], note: 'The exhaustive default.' },
          {
            path: 'packages/plan-domain/src/changes.test.ts',
            lines: [56, 60],
            note: 'One example per kind, enforced by the type.',
          },
        ],
        commit: '8fda5fe',
      },
    ],
    checkpoint: {
      commands: ['pnpm run test', 'pnpm run dev', 'git check-ignore -v packages/plan-data/data/history.json'],
      expect: [
        'The `plan-domain` and `plan-data` tests pass, `history.test.ts` and the change examples among them.',
        'At http://localhost:3000, drag a session and press Ctrl/⌘ Z: it goes back; Ctrl/⌘ Shift Z puts it again; `H` opens History with both steps, the undone one struck through.',
        'git prints the `.gitignore` rule that matches the history file: it is never committed.',
      ],
      quiz: [
        {
          question:
            'A history has five steps and the cursor at 5. You undo twice, then make a new change. How many steps does it hold?',
          options: ['6', '4', '5', '3'],
          answer: 1,
          explanation:
            '`recordChange` keeps `steps.slice(0, cursor)`, three steps, and appends the new one. The two undone steps are gone, which `history.test.ts` pins down.',
        },
        {
          question:
            'Why does `purgeTrash` leave a `null` mark for an expired generated event instead of deleting its key?',
          options: [
            'To keep the file smaller',
            'Regenerating the schedule would bring the event back otherwise',
            'So undo can still restore it',
            'Because JSON cannot delete keys',
          ],
          answer: 1,
          explanation:
            'A generated event comes from `content.ts` on every `pnpm run plan`. The `null` mark keeps it hidden; an event made in the viewer has no such source and simply disappears.',
        },
        {
          question: 'What does `currentHistory()` return after someone edited `edits.json` by hand?',
          options: [
            'The stored history with the hand edit merged into every step',
            'It throws, and the server refuses to save',
            'An empty history whose origin is the edits now on disk',
            'The stored history, and the hand edit is reverted',
          ],
          answer: 2,
          explanation:
            '`inSync` finds that the edits at the cursor differ from the file, so the old snapshots no longer describe it. Starting over is the only safe choice.',
        },
      ],
    },
    pitfalls: [
      'The old inverse-based undo returned `null` for most kinds, so the undo bar silently offered nothing after a move of a series or a restore (`972da82`, replaced in `32c9733`).',
      'A history out of step with `edits.json` (a hand edit, a `git pull`, another tool) would undo to snapshots that ignore those edits; `currentHistory` resets it through `inSync` (`32c9733`).',
      '`saveChanges` purges the trash before recording, so the last step holds exactly the edits `writePlan` writes. Without it, a step and the file could differ by an expired item and `inSync` would discard the history on the next save (`store.ts`).',
      'A restore from the trash cannot be previewed in the browser, so it appears only when the server answers (`use-plan-session.ts`).',
      'Ctrl/⌘ Z inside a text field belongs to the text: `useShortcuts` skips `+z` shortcuts while an input, a textarea or a contenteditable element has focus.',
      'A change made after an undo drops the undone steps. That is the expected editor behaviour, but a History window that still showed them would mislead.',
    ],
    tradeoffs: [
      'A snapshot per step stores up to 100 copies of `PlanEdits`; memory and file size buy undo that works for every kind of change without inverse code.',
      'The history is local to one checkout and resets after outside edits: safe, but steps can be lost.',
      'Soft delete keeps data for 30 days at the cost of every reader of the edits honouring `removed`.',
      'Each change of a multi-change update is its own step, so taking back a whole update can take several undos; the History window jumps there in one click.',
    ],
    links: [
      {
        label: 'TanStack Start: Server Functions',
        href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-functions',
      },
      {
        label: 'TanStack Router: Data Loading',
        href: 'https://tanstack.com/router/latest/docs/framework/react/guide/data-loading',
      },
      { label: 'TypeScript: Narrowing', href: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html' },
      {
        label: 'TypeScript 4.9: the satisfies operator',
        href: 'https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html',
      },
      {
        label: 'MDN: structuredClone()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone',
      },
      {
        label: 'MDN: KeyboardEvent.metaKey',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/metaKey',
      },
    ],
    next: 'Chapter 15 adds a third module, a read-only progress dashboard, and checks that the module boundaries hold.',
  },
  {
    id: 'dashboard-module',
    summary:
      'You add `@lc/dashboard`, a third build-time module that renders a read-only progress page at `/dashboard`: stat tiles, a burn-up chart, the load of every week, a bar per course, a forecast at the real pace and a study streak. Charts are plain SVG drawn at the measured width, with a hover readout and the same numbers in a table. Every number comes from a pure, tested function in `plan-domain`.',
    whereWeAre:
      'Two modules, `planner` and `calendar-export`, are composed by `apps/web` (chapter 11). Lint forbids a module from importing another module, `@lc/plan-data`, `node:*` or server functions; the app passes data and callbacks in. The planner shows progress rings per course and a budget panel, but nothing shows the trend over the weeks.',
    problem:
      'The person needs to know whether the plan is on track: hours done against hours planned over time, which weeks go over the 12 h budget, and when the rest will really be finished at the current pace. That is a different screen with different concerns from the editing planner. It is also the first test of the module architecture: can a new vertical slice join without touching the others?',
    outcomes: [
      'Create a module package with the `type:module` tag and one public entry, and compose it in a file route.',
      'Keep calculations in pure domain functions (`planStats`, `studyStreak`, `paceForecast`) and pass their results to widgets.',
      'Draw a responsive SVG chart by hand: scales, round ticks, paths and a hover readout from pointer events.',
      'Measure an element with `ResizeObserver` so chart text is never stretched.',
      'Make a chart accessible with `role="img"`, a label and the same numbers in a table.',
      'Keep page state such as `expanded` in validated URL search params.',
    ],
    concepts: [
      {
        term: 'A build-time microfrontend',
        explanation:
          'A module is a workspace package with one public entry, `src/index.ts`, that the app imports like a library; Vite builds everything into one deployable. It does not know the router or where data comes from: the route passes `plan`, `expanded` and callbacks as props. Adding one is a package, a tag, a dependency in `apps/web/package.json` and a route file.',
        link: {
          label: 'TanStack Router: File-Based Routing',
          href: 'https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing',
        },
      },
      {
        term: 'Domain statistics computed once',
        explanation:
          '`planStats(plan, now)` walks the sessions once and returns every week from the first to the last with planned, done and per-calendar hours, plus totals and a simple forecast. `DashboardPage` computes it in one `useMemo` and passes the result to every widget, so tiles, chart and table always agree.',
        link: { label: 'React: useMemo', href: 'https://react.dev/reference/react/useMemo' },
      },
      {
        term: 'SVG scales and paths',
        explanation:
          'A chart is SVG elements placed in pixels. Two scale functions map data to pixels: `x(i)` maps a week index across the plot width, `y(hours)` maps hours to the height with 0 at the bottom, flipped because SVG y grows downward. A line is one `<path d="M x,y L x,y …">`; an area closes the same path back along the baseline with `Z`.',
        link: {
          label: 'MDN: SVG paths',
          href: 'https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths',
        },
      },
      {
        term: 'Round axis ticks',
        explanation:
          'Axis values read better as round numbers. `niceTicks(max, count)` divides the range into about `count` parts, takes the power of ten of that rough step and picks the first of 1, 2, 2.5, 5 or 10 times it that is large enough. For a maximum of 12 and four ticks that gives 0, 5, 10 and 15.',
      },
      {
        term: 'ResizeObserver',
        explanation:
          '`ResizeObserver` calls back whenever an element changes size, not only on a window resize, so a chart inside a grid cell follows its cell. `useWidth` keeps `contentRect.width` in state and the chart renders only once it is known (`width > 0`), so the SVG is drawn at its real pixel size.',
        link: { label: 'MDN: ResizeObserver', href: 'https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver' },
      },
      {
        term: 'Pointer events for a hover readout',
        explanation:
          '`onPointerMove` on the `<svg>` gives `clientX`; subtracting `getBoundingClientRect().x` gives the x inside the chart, which the inverse of the x scale turns into the nearest week. Pointer events cover mouse, pen and touch with one API, and `touch-pan-y` keeps vertical page scrolling working on a phone.',
        link: { label: 'MDN: Pointer events', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events' },
      },
      {
        term: 'Accessible charts',
        explanation:
          'To a screen reader a chart is one image: the `<svg>` has `role="img"` and an `aria-label`. The readout is decoration with `pointer-events-none`; the facts live in a `<details>` table with `scope` on its header cells, which a keyboard or a screen reader can reach.',
        link: {
          label: 'MDN: ARIA img role',
          href: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/img_role',
        },
      },
      {
        term: 'A clock that is safe to hydrate',
        explanation:
          'The server render and the first client render must produce the same markup. `useNow()` returns `null` until an effect runs in the browser, then Minsk wall-clock time every minute; widgets treat `null` as not known yet. Stories pass a fixed `now`, so the picture does not depend on the day it is opened.',
      },
    ],
    decisions: [
      {
        question: 'Where should the progress page live?',
        options: [
          {
            name: 'A new module, `@lc/dashboard`',
            pros: [
              'One user-facing area per package, as the architecture asks',
              'The app composes it in one route; the planner is untouched',
            ],
            cons: ['Chart helpers (`Card`, `ChartTip`) live in the module until a second user appears'],
          },
          {
            name: 'A page inside the planner module',
            pros: ['No new package'],
            cons: ['Mixes a read-only report with the editing UI; the planner grows further'],
          },
          {
            name: 'A separate app',
            pros: ['Deploys on its own'],
            cons: ['A second shell, a second server, and no shared typed routes'],
          },
        ],
        chosen: 'A new module, `@lc/dashboard`',
        why: '`docs/architecture.md` gives each module one user-facing area and describes adding a module as copying the shape of `calendar-export`, adding it to `apps/web/package.json` and composing it in a route. `632e3aa` does exactly that for a read-only progress page.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/architecture.md', note: 'How the principles map; Adding things' },
          { kind: 'commit', ref: '632e3aa' },
        ],
      },
      {
        question: 'A chart library or plain SVG?',
        options: [
          {
            name: 'Plain SVG written in React',
            pros: [
              'No dependency',
              'Colours come straight from the theme tokens (`var(--done)`)',
              'Same markup on server and client',
            ],
            cons: ['Scales, ticks, hover and resizing are written by hand'],
          },
          {
            name: 'A React chart library',
            pros: ['Axes, tooltips, legends and animation ready'],
            cons: ['A dependency in the bundle', 'Theming through its props instead of the kit tokens'],
          },
          {
            name: 'D3',
            pros: ['The best scale and shape helpers'],
            cons: ['Its DOM manipulation competes with React rendering, unless only its maths is used'],
          },
        ],
        chosen: 'Plain SVG written in React',
        why: 'The commit records what was built, plain SVG at the measured width with a hover readout, not why a library was left out. A reconstruction: the charts are simple (lines, stacked bars, a grid of cells), their colours must follow the theme tokens that switch with `color-scheme`, and the workspace catalog had no chart library to reuse.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '632e3aa' },
          { kind: 'file', ref: 'pnpm-workspace.yaml', note: 'the catalog has no chart library' },
        ],
      },
      {
        question: 'How should a chart fit its container?',
        options: [
          {
            name: 'Scale the SVG with `viewBox`',
            pros: ['No JavaScript'],
            cons: ['Text and strokes scale with the chart: 11 px labels shrink on a phone and grow on a wide screen'],
          },
          {
            name: 'Measure the width and draw at that size',
            pros: ['Text stays 11 px', 'The number of labels follows the width'],
            cons: ['Needs `ResizeObserver` and draws nothing until the width is known'],
          },
          {
            name: 'A fixed width with horizontal scrolling',
            pros: ['Simple'],
            cons: ['Awkward on a phone'],
          },
        ],
        chosen: 'Measure the width and draw at that size',
        why: 'The comment on `useWidth` gives the reason: the width is measured so a chart is drawn at its real size and its text is never stretched. `632e3aa` describes the charts as plain SVG drawn at the measured width.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'modules/dashboard/src/shared/lib/use-width.ts' },
          { kind: 'commit', ref: '632e3aa' },
        ],
      },
      {
        question: 'How do the numbers reach someone who cannot see the chart?',
        options: [
          {
            name: 'Only the hover readout',
            pros: ['Nothing extra to build'],
            cons: ['Pointer only; a screen reader gets nothing'],
          },
          {
            name: 'A labelled image plus the same numbers in a table',
            pros: ['Every value reachable by keyboard and screen reader', 'Easy to copy'],
            cons: ['A second rendering of the data to keep in step'],
          },
          { name: 'A sentence that describes the trend', pros: ['Short'], cons: ['Loses the exact numbers'] },
        ],
        chosen: 'A labelled image plus the same numbers in a table',
        why: '`632e3aa` gives the charts a hover readout and the same numbers as a table, and `ChartTip` states the rule in its comment: everything it says is also in the data table.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '632e3aa' },
          { kind: 'file', ref: 'modules/dashboard/src/shared/ui/ChartTip.tsx', note: 'the JSDoc of `ChartTip`' },
        ],
      },
    ],
    steps: [
      {
        title: 'Put the numbers in the domain',
        detail:
          '`planStats` lists every week from the first session to the last without gaps, adds planned and done hours per week and per calendar, counts sessions and the hours that should be over by `now`, and extrapolates a finish from the pace so far. It is pure TypeScript with the Minsk date helpers, so it runs on the server, in the browser and in tests.',
        files: [
          {
            path: 'packages/plan-domain/src/stats.ts',
            lines: [5, 69],
            note: '`WeekStats`, `PlanStats` and `planStats`.',
          },
        ],
        commit: '632e3aa',
      },
      {
        title: 'Create the module package',
        detail:
          'Copy the shape of `calendar-export`: a private package with `exports` pointing at `src/index.ts`, `typecheck`, `lint` and `lint:fsd` scripts, `@lc/i18n`, `@lc/plan-domain` and `@lc/ui` as its only workspace dependencies, React as a peer, and the `type:module` and `scope:dashboard` tags. The public entry exports the page and its search parser, nothing else.',
        files: [
          {
            path: 'modules/dashboard/package.json',
            lines: [1, 34],
            note: 'Exports, scripts, dependencies and Nx tags.',
          },
          { path: 'modules/dashboard/tsconfig.json', lines: [1, 7], note: 'Extends the base config; no Node types.' },
          { path: 'modules/dashboard/src/index.ts', lines: [1, 1], note: 'The public API of the module.' },
        ],
        commands: ['pnpm exec nx run @lc/dashboard:typecheck', 'pnpm exec nx run @lc/dashboard:lint:fsd'],
        commit: '632e3aa',
      },
      {
        title: 'Compose it in a route',
        detail:
          'The app depends on `@lc/dashboard` and adds `routes/dashboard.tsx`. The route loads the same `PlanState` as the planner through `getPlanState` and passes only `plan` and the shell header slot; the module never sees a server function. The router plugin regenerates `routeTree.gen.ts`.',
        files: [
          {
            path: 'apps/web/src/routes/dashboard.tsx',
            lines: [1, 15],
            at: '632e3aa',
            note: 'The first version: loader and component.',
          },
          {
            path: 'apps/web/src/routes/dashboard.tsx',
            lines: [7, 24],
            note: 'Today: `validateSearch` and `expanded` wired to the URL.',
          },
        ],
        commit: '632e3aa',
      },
      {
        title: 'Check the boundaries, and fix the rule that needed an edit',
        detail:
          'In `632e3aa` the rule that keeps modules apart was a deny-list of module names, so the new module had to be added to it. `8fda5fe` turned it into an allow-list: inside `modules/**`, every `@lc/*` import is refused except `plan-domain`, `ui` and the `i18n` subpaths, so the next module needs no lint change. Steiger checks the Feature-Sliced layers of the new `src/` with the shared config.',
        files: [
          { path: '.oxlintrc.json', lines: [56, 59], at: '632e3aa', note: 'The deny-list with `@lc/dashboard` added.' },
          { path: '.oxlintrc.json', lines: [172, 195], note: 'The allow-list that replaced it.' },
          { path: 'steiger.config.ts', lines: [1, 12], note: 'Feature-Sliced rules for every module source.' },
        ],
        commit: '8fda5fe',
      },
      {
        title: 'Build the page: compute once, pass down',
        detail:
          '`DashboardPage` takes `plan`, an optional fixed `now`, a header slot and the `expanded` state with its callback. It computes `planStats` once and hands it to the widgets, so every widget shows the same numbers. `useNow` returns `null` until the browser runs its effect.',
        files: [
          {
            path: 'modules/dashboard/src/pages/dashboard/ui/DashboardPage.tsx',
            lines: [15, 47],
            note: 'Props, the stats `useMemo` and the layout state.',
          },
          {
            path: 'modules/dashboard/src/pages/dashboard/ui/DashboardPage.tsx',
            lines: [96, 103],
            note: 'The widgets receive the shared numbers.',
          },
          {
            path: 'modules/dashboard/src/shared/lib/use-now.ts',
            lines: [1, 13],
            note: 'Null during SSR, then the Minsk clock every minute.',
          },
        ],
        commit: '632e3aa',
      },
      {
        title: 'Draw the burn-up chart',
        detail:
          'Accumulate planned and done hours per week into two arrays, compute round ticks, then write two scale functions and a `path` helper that joins points with `M` and `L`. The done line stops at the running week, the area under it closes back to the baseline, and labels are thinned with `every` so they never overlap at narrow widths.',
        files: [
          {
            path: 'modules/dashboard/src/shared/lib/use-width.ts',
            lines: [1, 16],
            note: 'The width from `ResizeObserver`.',
          },
          { path: 'modules/dashboard/src/shared/lib/nice-ticks.ts', lines: [1, 9], note: 'Round axis values.' },
          {
            path: 'modules/dashboard/src/widgets/burn-up/ui/BurnUp.tsx',
            lines: [24, 57],
            note: 'Running totals, scales, path and label spacing.',
          },
          {
            path: 'modules/dashboard/src/widgets/burn-up/ui/BurnUp.tsx',
            lines: [95, 153],
            note: 'The SVG: grid, labels, today line, plan and done paths.',
          },
        ],
        commit: '632e3aa',
      },
      {
        title: 'Add the hover readout and the table',
        detail:
          '`pointerMove` turns the pointer position into the nearest week and stores it; the readout shows planned and, up to the running week, done hours. `ChartTip` flips to the left of the pointer in the right half of the chart. Under the charts, a `<details>` table lists every week with its hours and running totals.',
        files: [
          {
            path: 'modules/dashboard/src/widgets/burn-up/ui/BurnUp.tsx',
            lines: [59, 80],
            note: 'From pointer x to a week, and the readout rows.',
          },
          {
            path: 'modules/dashboard/src/shared/ui/ChartTip.tsx',
            lines: [1, 27],
            note: 'The readout that never takes pointer events.',
          },
          {
            path: 'modules/dashboard/src/pages/dashboard/ui/DashboardPage.tsx',
            lines: [105, 138],
            note: 'The same numbers as a table.',
          },
        ],
        commit: '632e3aa',
      },
      {
        title: 'Forecast the finish at the real pace',
        detail:
          'Once a session logs the minutes it really took, each course has a pace: real hours per planned hour. `paceForecast` multiplies every open session by its course pace, pours that work into the slots the plan still holds and, when it does not fit, into the part of the weekly budget other courses leave free. `d02cd5e` drew the result on the burn-up as a dashed line and let the time axis run on to it.',
        files: [
          {
            path: 'packages/plan-domain/src/forecast.ts',
            lines: [21, 84],
            note: '`paceForecast`: needed hours, remaining slots, then free budget.',
          },
          {
            path: 'modules/dashboard/src/widgets/burn-up/ui/BurnUp.tsx',
            lines: [46, 48],
            note: 'The axis extends to a later forecast.',
          },
          {
            path: 'modules/dashboard/src/widgets/burn-up/ui/BurnUp.stories.tsx',
            lines: [21, 22],
            note: 'The story with a forecast past the plan.',
          },
        ],
        commit: 'ddc347c',
      },
      {
        title: 'Add the study streak',
        detail:
          '`studyStreak` lays out every day from the Monday of the first week to the Sunday of the last and counts study days in a row with something done. A day without a session and today while it is still open do not break the run. The widget draws one cell per day in week columns, each with `role="img"` and a label.',
        files: [
          {
            path: 'packages/plan-domain/src/streak.ts',
            lines: [22, 47],
            note: 'The rule for the current and the best run.',
          },
          {
            path: 'packages/plan-domain/src/streak.test.ts',
            lines: [8, 30],
            note: 'Missed days end the run; empty days do not.',
          },
          {
            path: 'modules/dashboard/src/widgets/study-streak/ui/StudyStreak.tsx',
            lines: [22, 35],
            note: 'Fill and label of a cell.',
          },
        ],
        commands: ['pnpm run test'],
        commit: 'a9a4f72',
      },
      {
        title: 'Expand the page and keep the choice in the URL',
        detail:
          'Expand (E) and Full screen (Shift F) give the charts the whole window or screen. `expanded` lives in the URL: the module exports `parseDashboardSearch`, the route uses it as `validateSearch` and writes the value back with `navigate`. A play function in the page story clicks Expand and checks that the header goes and the page is no longer held to a column.',
        files: [
          {
            path: 'modules/dashboard/src/pages/dashboard/model/search.ts',
            lines: [1, 9],
            note: 'The validated search params.',
          },
          {
            path: 'modules/dashboard/src/pages/dashboard/ui/DashboardPage.stories.tsx',
            lines: [56, 73],
            note: 'The Expand interaction as a test.',
          },
        ],
        commit: 'cb758b9',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run dev',
        'pnpm exec nx run-many -t typecheck lint lint:fsd --projects=tag:type:module',
        'pnpm run test',
      ],
      expect: [
        'http://localhost:3000/dashboard shows the tiles, the burn-up with a today line, the pace forecast, weekly load, course bars and the streak; hovering the burn-up shows a readout, and the table under the charts holds the same numbers.',
        'All three modules pass type checks, Oxlint and Steiger; nothing in `.oxlintrc.json` names `@lc/dashboard`.',
        'The domain tests pass, `streak.test.ts` among them.',
      ],
      quiz: [
        {
          question: 'Why does `BurnUp` measure its width instead of scaling one SVG with `viewBox`?',
          options: [
            'Browsers do not support `viewBox` on inline SVG',
            'So the chart is drawn at its real size and its text is never stretched',
            'Because `ResizeObserver` is faster than CSS',
            'Because server rendering needs a width',
          ],
          answer: 1,
          explanation:
            'With `viewBox` the 11 px labels and 2 px strokes scale with the chart. Measuring keeps them at their size and lets the label spacing follow the width.',
        },
        {
          question:
            'When `@lc/dashboard` was added in `632e3aa`, one line of `.oxlintrc.json` changed. Why does a fourth module need no lint change today?',
          options: [
            'Oxlint discovers modules from the Nx tags',
            '`8fda5fe` turned the deny-list of module names into an allow-list: every `@lc/*` except the shared packages',
            'Steiger replaced the Oxlint rule',
            'pnpm alone refuses the import',
          ],
          answer: 1,
          explanation:
            'A deny-list has to name every module, and a forgotten entry silently allows an import. The allow-list refuses any workspace package a module is not meant to use.',
        },
        {
          question: 'Why does `useNow()` return `null` on the first render?',
          options: [
            'A bug that the widgets work around',
            'So the server markup and the first client render match; the clock is read after hydration',
            'To avoid a timer on the server',
            'Because the Minsk offset is not known yet',
          ],
          answer: 1,
          explanation:
            'The server and the browser would read different times. Rendering nothing time-dependent until the effect runs avoids a hydration mismatch.',
        },
      ],
    },
    pitfalls: [
      'The deny-list of module names in `.oxlintrc.json` had to be edited for the new module (`632e3aa`); a forgotten entry would allow imports between modules. `8fda5fe` replaced it with an allow-list.',
      'A chart drawn before its width is known renders into 0 px; draw the `<svg>` only when `width > 0`.',
      'A page that reads the clock cannot have a stable story or screenshot. `DashboardPage` takes an optional `now`, which its story pins (`6495a57`).',
      'A forecast later than the last planned week fell off the chart until the time axis was made to run on to it (`d02cd5e`).',
      'SVG y grows downward. Forget the flip in `y(hours)` and the chart is upside down.',
      'Sessions already lengthened to the real pace by a catch-up scenario must not be multiplied again; they carry `paced: true`, which `paceForecast` respects (`d02cd5e`).',
    ],
    tradeoffs: [
      'Hand-written SVG means owning scales, ticks and hover; in return there is no chart dependency and the colours are the theme tokens.',
      'Charts appear only after hydration and measurement: no chart in the server HTML, but no stretched text either.',
      '`planStats` once per page keeps every widget consistent, but every change to the plan recomputes all weeks.',
      'The module is read-only by design: marks are made in the planner, so the dashboard needs no `onChange` and no server function.',
    ],
    links: [
      { label: 'MDN: ResizeObserver', href: 'https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver' },
      {
        label: 'MDN: SVG paths',
        href: 'https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths',
      },
      { label: 'MDN: Pointer events', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events' },
      {
        label: 'MDN: ARIA img role',
        href: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/img_role',
      },
      {
        label: 'MDN: the details element',
        href: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details',
      },
      { label: 'MDN: Fullscreen API', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API' },
      {
        label: 'TanStack Router: Search Params',
        href: 'https://tanstack.com/router/latest/docs/framework/react/guide/search-params',
      },
      { label: 'Nx: Enforce Module Boundaries', href: 'https://nx.dev/docs/features/enforce-module-boundaries' },
    ],
    next: 'Chapter 16 grows the planner itself: new views, a focus page, reminders, a second time zone, and the refactor that made room for them.',
  },
  {
    id: 'planner-grows',
    summary:
      'You split an 800-line planner page into hooks and one action list, then build on it: day and year views with a time scale, a second time zone, a quick event typed into the command palette, system reminders, a focus page with a stopwatch that survives reloads, spaced reviews, catch-up scenarios and week goals. Each new rule is a pure function in `plan-domain`, and each new edit is a `PlanChange`, so it is one step to undo.',
    whereWeAre:
      'The planner edits the plan through `PlanChange` values with a full history (chapter 14), and the dashboard shows progress (chapter 15). The page component holds the toolbar, every view and every dialog: 803 lines and 14 `useState` calls before `8fda5fe`, with each action declared four times, for the command search, the menu, the shortcuts and the shortcut list.',
    problem:
      '`docs/feature-research.md` ranked what calendar and planner users ask for most and found three unanswered needs that fit a study plan: a plan that reacts to the time sessions really took, a catch-up that plans itself as compared options, and goals derived from the plan. Adding those, plus new views and a focus mode, to the existing page would multiply its state and the four copies of every action. The page has to be restructured before it can grow.',
    outcomes: [
      'Split a large page into hooks per concern and one declarative action list that the palette, the menu, the key bindings and the shortcut list all read.',
      'Decide per piece of state between URL search params and `localStorage`, and guard every storage access.',
      'Remind before a start with the Notification API and a timer, within the limits of a page.',
      'Work with IANA time zones through `Intl.DateTimeFormat`, without a date library.',
      'Write a stopwatch that stays right after a reload or a sleeping laptop by storing timestamps.',
      'Turn missed sessions into compared scenarios that apply as one history step.',
    ],
    concepts: [
      {
        term: 'Custom hooks as the seams of a page',
        explanation:
          'A custom hook is a function that calls other hooks and returns values and callbacks. `usePlannerView` turns the URL into dates and navigation, `useDialogFlags` holds which dialogs are open, `useEventDraft` the event being drawn, `useQuietChange` the saves made outside a dialog, and `usePlanSession` the plan on screen. The page reads them and renders; each can be read and changed alone.',
        link: {
          label: 'React: Reusing Logic with Custom Hooks',
          href: 'https://react.dev/learn/reusing-logic-with-custom-hooks',
        },
      },
      {
        term: 'One action list',
        explanation:
          '`PlannerAction` declares an action once: id, group, label, keys, icon, badge, where it shows in the menu, and `run`. `toCommands`, `toMenuItems`, `toShortcuts` and `toShortcutRows` derive the command palette, the `⋮` menu, the key bindings and the shortcuts dialog from the same array, so they cannot drift apart.',
      },
      {
        term: 'URL search params as state',
        explanation:
          'TanStack Router validates the search params of a route (`validateSearch: parsePlannerSearch`) and hands them to the component typed. State kept there survives a reload, works with the back button and can be linked: view, week, day, zoom, work week, the open event, the session to focus on. The module does not own the router; it receives `search` and calls `onSearchChange`.',
        link: {
          label: 'TanStack Router: Search Params',
          href: 'https://tanstack.com/router/latest/docs/framework/react/guide/search-params',
        },
      },
      {
        term: '`localStorage` for choices of one browser',
        explanation:
          'Some choices belong to a device, not to a link: the second time zone, reminders on or off, the running stopwatch, the break rhythm. They are read in an effect after mount so the server markup matches, and every read and write sits in `try/catch`, because storage can be disabled or full; the fallback is a choice that lasts until the page closes.',
        link: {
          label: 'MDN: Window.localStorage',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage',
        },
      },
      {
        term: 'Notification API and long timers',
        explanation:
          '`Notification.requestPermission()` asks once; after `granted`, `new Notification(title, { body, tag })` shows a system notification, and a repeated `tag` replaces the earlier one instead of stacking. Without a service worker it works only while the page is open, so `useReminders` sets one `setTimeout` for the next start, capped at the largest delay a timer accepts, `2 ** 31 - 1` ms.',
        link: {
          label: 'MDN: Using the Notifications API',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API',
        },
      },
      {
        term: 'Time zones with `Intl`',
        explanation:
          "The plan stores Minsk wall-clock strings (UTC+3 all year). To read another IANA zone, `zoneShift` formats the same instant with `Intl.DateTimeFormat` and `timeZone`, rebuilds a wall-clock value from `formatToParts` and subtracts. It is computed for the week on screen, so a daylight-saving change in the other zone shows; `Intl.supportedValuesOf('timeZone')` lists the zones for the picker.",
        link: {
          label: 'MDN: Intl.DateTimeFormat.formatToParts()',
          href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts',
        },
      },
      {
        term: 'Timestamps, not ticks',
        explanation:
          'A timer that adds one every second is lost on reload and falls behind when a background tab is throttled or a laptop sleeps. `useStopwatch` stores `startedAt` (epoch ms) and `banked` (time counted before the last start) in `localStorage` and computes `banked + now - startedAt`; the one-second interval only refreshes the display.',
      },
      {
        term: 'IME composition',
        explanation:
          'Chinese or Japanese text goes through an input method, and the Enter that picks a candidate must not submit a form or run a command. `KeyboardEvent.isComposing` says so, but Safari can clear it before that Enter, which then carries key code 229. `composing(e)` checks both.',
        link: {
          label: 'MDN: KeyboardEvent.isComposing',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing',
        },
      },
    ],
    decisions: [
      {
        question: 'How do you make room in an 800-line page component?',
        options: [
          {
            name: 'Hooks per concern and one action list',
            pros: ['Each action declared once; four consumers derive from it', 'The page went from 803 to 390 lines'],
            cons: ['Behaviour is spread over `model/*`; reading a feature means opening several files'],
          },
          {
            name: 'A global store',
            pros: ['Central state and devtools'],
            cons: ['A new dependency and pattern, while most state is already URL or server state'],
          },
          {
            name: 'Keep adding to the page',
            pros: ['No refactor now'],
            cons: ['Fourteen `useState` calls and four copies of each action grow with every feature'],
          },
        ],
        chosen: 'Hooks per concern and one action list',
        why: '`8fda5fe` names the problem and the fix: the page held fourteen pieces of state and declared every action four times; now each action is declared once in `build-actions` and the four are read from it, while the view maths, the draft event, the dialog flags and the quiet changes are hooks.',
        evidence: 'evidenced',
        sources: [{ kind: 'commit', ref: '8fda5fe' }],
      },
      {
        question: 'Where should each piece of UI state live?',
        options: [
          {
            name: 'Everything in the URL',
            pros: ['Every screen can be linked'],
            cons: [
              'Device preferences would travel with a shared link',
              'A running stopwatch does not belong in a link',
            ],
          },
          {
            name: 'Everything in `localStorage`',
            pros: ['No router involved'],
            cons: ['A week or an open event cannot be linked or restored with the back button'],
          },
          {
            name: 'The URL for what a link should reproduce, `localStorage` for choices of this browser',
            pros: ['Links open the same view and event', 'Preferences stay with the device'],
            cons: ['Two mechanisms, and each storage access needs a guard'],
          },
        ],
        chosen: 'The URL for what a link should reproduce, `localStorage` for choices of this browser',
        why: '`PlannerSearch` says it keeps in the URL what should be linked and survive a reload: a week, a view, an event. `3a7cf48` remembers the second zone per browser, `86e03cb` keeps the break rhythm per browser like the stopwatch, and `e544134` moves the focus session into the URL so a link opens the session that was picked.',
        evidence: 'evidenced',
        sources: [
          {
            kind: 'file',
            ref: 'modules/planner/src/pages/planner/model/search.ts',
            note: 'the JSDoc of `PlannerSearch`',
          },
          { kind: 'commit', ref: '3a7cf48' },
          { kind: 'commit', ref: '86e03cb' },
          { kind: 'commit', ref: 'e544134' },
        ],
      },
      {
        question: 'How should the planner help after missed sessions?',
        options: [
          {
            name: 'One lever: shift the rest by N days',
            pros: ['Simple and predictable'],
            cons: ['The cost (a later end, heavier weeks) is seen only after applying'],
          },
          {
            name: 'Compared scenarios, applied as one `events.move`',
            pros: [
              'Each shows the end of the plan, the room before the deadline and the heaviest week',
              'One undo takes the whole scenario back',
            ],
            cons: ['Three placement strategies and an outlook to write and test'],
          },
          {
            name: 'Ask a language model to re-plan',
            pros: ['Flexible'],
            cons: ['Not deterministic, and there is no protocol for its answer yet (chapter 17)'],
          },
        ],
        chosen: 'Compared scenarios, applied as one `events.move`',
        why: '`610a506` offers whole scenarios instead of one lever, each shown with the end of the plan, the room before the certificate deadline and the heaviest week, and stores the chosen one as one history step through the new `events.move`. The research had found that shipped tools move leftovers to tomorrow but none shows the trade-off as choices against a weekly budget and a fixed end.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '610a506' },
          { kind: 'file', ref: 'docs/feature-research.md', note: '1.2 Catch-up that plans itself' },
        ],
      },
      {
        question: 'How should the focus stopwatch keep time?',
        options: [
          {
            name: 'Count ticks in React state',
            pros: ['Simplest code'],
            cons: ['Lost on reload', 'Falls behind when `setInterval` is throttled in a background tab'],
          },
          {
            name: 'Store the start moment and the banked time in `localStorage`',
            pros: ['Right after a reload, a sleep or a background tab', 'A paused session survives a reload too'],
            cons: ['Without storage it lasts only until the page closes'],
          },
          {
            name: 'Keep it on the server',
            pros: ['Shared across devices'],
            cons: ['A round trip for a personal timer, and nothing on a read-only host'],
          },
        ],
        chosen: 'Store the start moment and the banked time in `localStorage`',
        why: 'The JSDoc of `useStopwatch` states it: it keeps the moment it was started, not a count, so it is right after a reload, a sleeping laptop or a tab left in the background.',
        evidence: 'evidenced',
        sources: [{ kind: 'file', ref: 'modules/planner/src/pages/focus/model/use-stopwatch.ts' }],
      },
    ],
    steps: [
      {
        title: 'Split the page into hooks and one action list',
        detail:
          'Move the view maths to `usePlannerView`, the open dialogs to `useDialogFlags` (a set, because dialogs stack), the drawn event to `useEventDraft` and the saves outside dialogs to `useQuietChange`. Declare every action once in `buildActions` and derive the palette, the menu, the shortcuts and the shortcut list with the four `to*` functions. The header, the toolbar and the two bars become components.',
        files: [
          {
            path: 'modules/planner/src/pages/planner/model/planner-actions.ts',
            lines: [6, 54],
            note: 'The action shape and the four derivations.',
          },
          {
            path: 'modules/planner/src/pages/planner/model/build-actions.tsx',
            lines: [74, 111],
            note: 'The first actions: undo, redo, new event, history.',
          },
          {
            path: 'modules/planner/src/pages/planner/model/use-dialog-flags.ts',
            lines: [1, 21],
            note: 'Open dialogs as a set.',
          },
          {
            path: 'modules/planner/src/pages/planner/ui/PlannerPage.tsx',
            lines: [160, 182],
            note: 'The page reads its hooks.',
          },
        ],
        commit: '8fda5fe',
      },
      {
        title: 'Drive views and the time scale from the URL',
        detail:
          '`PlannerSearch` gains `day`, `workWeek` and `zoom`, each validated in `parsePlannerSearch`. `usePlannerView` turns them into the day columns of the grid (one day, five or seven) and an hour height (40, 56 or 84 px), and `WeekGrid` takes `dayCount` and `hourHeight`, so one grid draws a day, a work week and a week at three scales.',
        files: [
          {
            path: 'modules/planner/src/pages/planner/model/search.ts',
            lines: [8, 51],
            note: 'The search params and their parser.',
          },
          {
            path: 'modules/planner/src/pages/planner/model/use-planner-view.ts',
            lines: [28, 60],
            note: 'Zoom levels, the day view and the grid columns.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [34, 43],
            note: '`dayCount` and `hourHeight`.',
          },
        ],
        commit: 'b8f20ca',
      },
      {
        title: 'Show a second time zone in the hour column',
        detail:
          '`zoneShift` reads the clock of an IANA zone with `formatToParts` and returns how far it is from the plan clock. The page computes it at noon of the first shown day, so a daylight-saving change in the other zone shows week by week. The picker lists every zone the browser knows and searches city, zone name, country in the page language and offset; the choice is kept per browser.',
        files: [
          {
            path: 'packages/plan-domain/src/dates.ts',
            lines: [54, 76],
            note: '`zoneShift` with `Intl.DateTimeFormat`.',
          },
          {
            path: 'modules/planner/src/features/second-zone/model/zones.ts',
            lines: [45, 75],
            note: '`listZones` and `findZones`.',
          },
          {
            path: 'modules/planner/src/features/second-zone/model/use-second-zone.ts',
            lines: [1, 25],
            note: 'The zone kept in `localStorage`.',
          },
          {
            path: 'modules/planner/src/pages/planner/ui/PlannerPage.tsx',
            lines: [184, 190],
            note: 'The shift for the week on screen.',
          },
        ],
        commit: '3a7cf48',
      },
      {
        title: 'Read a quick event from a typed line',
        detail:
          '`parseQuickEvent` scans the words for a time or a range, a length with a unit, and a day (today, tomorrow, a weekday, `23.11`, an ISO date) in Russian, English and Spanish; the words left over are the title. The palette offers the result first when the line holds a time, and Enter hands it to `onQuickAdd`. Every Enter handler checks `composing(e)` first.',
        files: [
          { path: 'packages/plan-domain/src/quick-event.ts', lines: [51, 112], note: 'The parser and its defaults.' },
          {
            path: 'modules/planner/src/features/command-palette/ui/CommandPalette.tsx',
            lines: [79, 86],
            note: 'A typed time ranks first.',
          },
          {
            path: 'modules/planner/src/shared/lib/composing.ts',
            lines: [1, 10],
            note: 'The IME check shared by four inputs.',
          },
        ],
        commit: 'ad44560',
      },
      {
        title: 'Remind before a start',
        detail:
          '`useReminders` reads the saved choice after mount, asks for permission only when the person turns reminders on, and sets one timeout for the first upcoming start minus ten minutes. When it fires it shows a notification tagged with the event and start, then bumps a counter so the effect schedules the next one.',
        files: [
          {
            path: 'modules/planner/src/features/reminders/model/use-reminders.ts',
            lines: [5, 71],
            note: 'Permission, the capped timeout and the tag.',
          },
          {
            path: 'modules/planner/src/pages/planner/ui/PlannerPage.tsx',
            lines: [229, 234],
            note: 'The next 21 days of timed events feed it.',
          },
        ],
        commit: 'ad44560',
      },
      {
        title: 'A focus page with a stopwatch that survives reloads',
        detail:
          '`/focus` is a second page of the planner module, composed by its own route. It times one session; Finish stores one `event.patch` with `done: true` and the minutes in quarter hours as `actual`, which the pace forecast reads (`ddc347c`). The session comes from the URL, but a running stopwatch keeps its own session so a link cannot drop counted time (`e544134`).',
        files: [
          {
            path: 'modules/planner/src/pages/focus/model/use-stopwatch.ts',
            lines: [36, 73],
            note: 'Start, pause and elapsed from timestamps.',
          },
          {
            path: 'modules/planner/src/pages/focus/ui/FocusPage.tsx',
            lines: [93, 103],
            note: 'Which session is shown.',
          },
          {
            path: 'modules/planner/src/pages/focus/ui/FocusPage.tsx',
            lines: [130, 144],
            note: 'Finish logs the real time as one change.',
          },
          {
            path: 'apps/web/src/routes/focus.tsx',
            lines: [9, 40],
            note: 'The route: search params, loader and callbacks.',
          },
        ],
        commit: 'ad44560',
      },
      {
        title: 'Offer breaks in focus',
        detail:
          'A rhythm of 25 + 5 or 50 + 10 minutes is chosen and kept per browser. After every block of study time a chime sounds through Web Audio and the page offers a break; taking it pauses the stopwatch and counts the rest down, and skipping moves the next break a whole rhythm on.',
        files: [
          {
            path: 'modules/planner/src/pages/focus/model/use-breaks.ts',
            lines: [1, 70],
            note: 'Rhythms, storage, the chime and the hook state.',
          },
        ],
        commit: '86e03cb',
      },
      {
        title: 'Offer spaced reviews when a module is done',
        detail:
          'When every session of a module is done, `reviewOffers` proposes three half-hour reviews one, three and seven days later, each in the first free half hour of its day from the hour the module used to end, skipping days off. Accepting stores one new change, `reviews.plan`, whose events have the new kind `review`: they count toward the budget but not as a module.',
        files: [
          {
            path: 'packages/plan-domain/src/reviews.ts',
            lines: [7, 95],
            note: 'Gaps, the free slot search and the offers.',
          },
        ],
        commit: '5630ed9',
      },
      {
        title: 'Compare catch-up scenarios and apply one as a step',
        detail:
          '`catchUpScenarios` builds `push` (every open session slides to later study days), `squeeze` (missed sessions go into Saturday buffers and an extra hour) and `pace` (sessions ahead get the length their course pace asks for). `610a506` brought the first two and `d02cd5e` added `pace`. `planOutlook` scores each on the plan as it would be, and the dialog stores the chosen moves as one `events.move`.',
        files: [
          {
            path: 'packages/plan-domain/src/replan.ts',
            lines: [13, 70],
            note: 'The scenario and outlook types and `planOutlook`.',
          },
          { path: 'packages/plan-domain/src/replan.ts', lines: [188, 197], note: 'Which scenarios are offered.' },
          {
            path: 'modules/planner/src/features/catch-up/ui/CatchUpDialog.tsx',
            lines: [52, 77],
            note: 'Preview with `withMoves`, apply as one change.',
          },
        ],
        commit: '610a506',
      },
      {
        title: 'Derive goals from the plan and review the week',
        detail:
          'A module is the sessions that share a title without the `(i/n)` counter, so goals need no input: the modules that end this week, what the month asks of each course, how far each certificate is. `moduleGoals` orders them by their last session, and the week review sums hours done, real time spent, goals met and sessions missed.',
        files: [
          {
            path: 'packages/plan-domain/src/goals.ts',
            lines: [5, 60],
            note: 'The goal and review types and `moduleGoals`.',
          },
        ],
        commit: '928e180',
      },
    ],
    checkpoint: {
      commands: ['pnpm run dev', 'pnpm run stand:test', 'pnpm exec nx run @lc/planner:typecheck'],
      expect: [
        'At http://localhost:3000 the keys D, W, M and Y switch views, 5 toggles the work week, + and - change the time scale, and each change shows in the URL; a reload keeps it. Typing `Review tomorrow 14:00 1.5h` into the palette (`/` or Ctrl/⌘ K) offers a new event first. At `/focus`, start the stopwatch and reload: the time goes on.',
        'The story tests pass, among them the palette quick event, the focus page and the catch-up dialog.',
        'The planner module type-checks.',
      ],
      quiz: [
        {
          question: 'Why does `useStopwatch` store `startedAt` instead of adding one to a counter every second?',
          options: [
            'Because `setInterval` is not available in React',
            'So elapsed time is right after a reload, a sleeping laptop or a throttled background tab',
            'To make the display smoother',
            'Because `localStorage` only stores numbers',
          ],
          answer: 1,
          explanation:
            'Elapsed time is `banked + now - startedAt`, computed from the clock whenever it is needed. A counter would lose everything on reload and drift whenever ticks are skipped.',
        },
        {
          question: 'Which of these does the planner keep in URL search params?',
          options: [
            'The second time zone',
            'Whether reminders are on',
            'The time scale of the week grid',
            'The break rhythm of focus',
          ],
          answer: 2,
          explanation:
            '`zoom` is in `PlannerSearch`, so a link or a reload shows the same scale. The other three are choices of one browser, kept in `localStorage`.',
        },
        {
          question: 'Why is a catch-up scenario stored as one `events.move` instead of one `event.patch` per session?',
          options: [
            'The server accepts only one change per request',
            'One change is one history step, so one undo takes the whole scenario back',
            '`event.patch` cannot change times',
            'It makes the edits file smaller',
          ],
          answer: 1,
          explanation:
            '`610a506` adds `events.move` precisely to store the chosen scenario as one step; dozens of patches would need dozens of undos.',
        },
      ],
    },
    pitfalls: [
      'The plan title saved a half-typed name when an input method was still composing, and Safari can clear `isComposing` before the confirming Enter; four inputs now share `composing(e)`, which also checks key code 229 (`569ce61`).',
      'A `setTimeout` longer than `2 ** 31 - 1` ms overflows and fires at once; `useReminders` caps the delay and sets the next timer when it runs out.',
      'Notifications fire only while a planner tab is open and after permission. When the person refuses, the hook reports `blocked` instead of failing silently, and the page can say so.',
      'A link to another focus session must not drop time from a running stopwatch: the running session wins over the one in the URL (`e544134`).',
      'The undo bar in the page flow pushed the calendar down after every drag; it floats over the page now (`d02cd5e`).',
      '`localStorage` can throw in some private modes or when full; every read and write is wrapped, with a choice that lasts until the page closes as the fallback.',
    ],
    tradeoffs: [
      'Hooks and an action list add indirection; the gain is one declaration per action and a page half the size.',
      'Notifications without a service worker are simple but work only while the planner is open.',
      '`Intl` instead of a date library keeps the bundle small, at the cost of hand-written zone maths and the assumption that Minsk has a fixed offset.',
      'Catch-up scenarios are deterministic heuristics, not an optimiser; the solver-based re-balance came later (`docs/rebalancing.md`).',
    ],
    links: [
      {
        label: 'React: Reusing Logic with Custom Hooks',
        href: 'https://react.dev/learn/reusing-logic-with-custom-hooks',
      },
      {
        label: 'TanStack Router: Search Params',
        href: 'https://tanstack.com/router/latest/docs/framework/react/guide/search-params',
      },
      {
        label: 'MDN: Using the Notifications API',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API',
      },
      { label: 'MDN: setTimeout()', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout' },
      {
        label: 'MDN: Intl.DateTimeFormat.formatToParts()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts',
      },
      {
        label: 'MDN: Intl.supportedValuesOf()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf',
      },
      {
        label: 'MDN: Window.localStorage',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage',
      },
      { label: 'MDN: Web Audio API', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API' },
    ],
    next: 'Chapter 17 opens the plan to language models: one update protocol served through HTTP, an MCP server and an AI chat tab.',
  },
  {
    id: 'language-models',
    summary:
      'You let a chat or an agent change the plan safely. An update is a JSON document holding a list of `PlanChange` values; its JSON Schema, a guide generated from the plan and the parser describe one protocol, and tests keep the three in step. The same protocol is served three ways: `GET /api/plan-guide` and `/api/plan-schema` with `POST /api/plan-update`, an MCP server over stdio, and an AI chat tab that works with any chat app through the clipboard.',
    whereWeAre:
      'Every edit is a `PlanChange` applied by `applyChange` and stored as a history step (chapter 14), and the planner offers re-planning helpers (chapter 16). Adding a whole course still means many clicks, and a language model can neither read the plan nor hand changes back, except by editing `edits.json` directly.',
    problem:
      'A model needs three things: the rules of this plan (budget, holidays, naming, time format), a precise format for its answer, and a check that refuses a bad answer before anything is stored. If each channel (a pasted chat answer, an HTTP agent, an MCP client) had its own format and checks, they would drift apart. And a model cannot add a course in one step: the change kinds for that do not exist yet.',
    outcomes: [
      'Add coarse change kinds (`course.add`, `events.add`, weekly repeats) so one answer maps to few history steps.',
      'Write JSON Schemas (draft 2020-12) whose descriptions teach a model how to fill every field, and validate them with Ajv in tests.',
      'Generate a guide and a brief from live data, with the contract at the top and again at the end.',
      'Parse an untrusted answer, preview it, and apply it all or nothing, with rule warnings that inform rather than refuse.',
      'Expose tools, resources and a prompt through an MCP server over stdio, and register it for Claude Code.',
      'Keep three adapters thin by putting every rule in `plan-domain`.',
    ],
    concepts: [
      {
        term: 'JSON Schema',
        explanation:
          'A JSON document that describes the allowed shape of other JSON with keywords such as `type`, `required`, `properties`, `pattern`, `enum`, `minItems` and `oneOf`; `$schema` names the draft, here 2020-12. `PLAN_SCHEMA` and `UPDATE_SCHEMA` also carry a `description` on every field, written for a model, so the schema is documentation and an input contract at once.',
        link: {
          label: 'JSON Schema: What is a schema?',
          href: 'https://json-schema.org/understanding-json-schema/about',
        },
      },
      {
        term: 'A tagged union in JSON Schema',
        explanation:
          "Each change kind is an object schema with `type: { const: 'event.patch' }`, its own `required` list and `additionalProperties: false`, and `items: { oneOf: CHANGES }` says a change must match exactly one of them. It mirrors the TypeScript union `PlanChange`, discriminated by `type`.",
        link: {
          label: 'JSON Schema: Boolean JSON Schema combination',
          href: 'https://json-schema.org/understanding-json-schema/reference/combining',
        },
      },
      {
        term: 'Ajv in the tests, the parser in the app',
        explanation:
          'Ajv compiles a schema into a validation function. `schema.test.ts` compiles both schemas with `Ajv2020` and checks the generated plan, every JSON example in the guide, and a list of bad updates that the schema and `parseUpdate` must both refuse. The app never runs Ajv: `parseUpdate` enforces, and the tests keep it equal to the schema.',
        link: { label: 'Ajv JSON schema validator', href: 'https://ajv.js.org/' },
      },
      {
        term: 'All-or-nothing updates',
        explanation:
          '`previewUpdate` applies the changes in order to an empty overlay and stops at the first one that throws, reporting its index. `saveChanges` runs the same loop and writes files only after every change applied, so a failing third change leaves the first two unstored. Each stored change is still its own history step.',
      },
      {
        term: 'Model Context Protocol (MCP)',
        explanation:
          'An open protocol, JSON-RPC 2.0 underneath, through which an AI client discovers and calls what a server offers. Tools are functions with an `inputSchema` that the model may call (`preview_update`); resources are documents addressed by URI (`plan://guide`); prompts are message templates the person picks (`change_plan`). The server uses `@modelcontextprotocol/sdk` 1.32.2, which implements the 2025-11-25 revision.',
        link: {
          label: 'MCP: What is the Model Context Protocol?',
          href: 'https://modelcontextprotocol.io/docs/getting-started/intro',
        },
      },
      {
        term: 'The stdio transport',
        explanation:
          'The client starts the server as a subprocess and exchanges newline-delimited JSON-RPC messages over its stdin and stdout. Anything else printed to stdout corrupts the stream, which is why the command is `pnpm --silent run mcp`. `.mcp.json` at the repository root registers it for Claude Code.',
        link: {
          label: 'MCP: Transports',
          href: 'https://modelcontextprotocol.io/specification/2025-11-25/basic/transports',
        },
      },
      {
        term: 'Prompt layout for long data',
        explanation:
          'Vendor guides agree on delimiting the parts and putting the request after the data. The brief is the guide, the plan inside `<plan>` tags, the request inside `<request>` tags, and then the five-line contract again, so the answer format is the last thing a model reads before it answers.',
        link: {
          label: 'Claude: Prompting best practices',
          href: 'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices',
        },
      },
      {
        term: 'Server routes in TanStack Start',
        explanation:
          'A file route can declare `server.handlers` per HTTP method and return a `Response`: an HTTP endpoint next to the pages, with no separate server. `/api/plan-update` reads the body as text, so it accepts a bare update, one change, or a whole chat answer with the update in a code block.',
        link: {
          label: 'TanStack Start: Server Routes',
          href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-routes',
        },
      },
    ],
    decisions: [
      {
        question: 'What does a model send back to change the plan?',
        options: [
          {
            name: 'An edited copy of the plan file',
            pros: ['The model reads and returns one document'],
            cons: [
              'Tens of kilobytes rewritten by a model: silent changes anywhere, lost uids',
              'No history steps: nothing to undo one by one',
            ],
          },
          {
            name: 'An update: a list of `PlanChange` values',
            pros: [
              'The same values the viewer stores, so each becomes an undoable step',
              'Small, and it points at events by `uid`',
              'Checked by the same `parseChange` and `applyChange`',
            ],
            cons: ['The model must learn the change kinds; coarse kinds had to be added first (`a20dc07`)'],
          },
          {
            name: 'One endpoint or tool per action',
            pros: ['Each call is simple'],
            cons: ['Many round trips, no atomic multi-change update, and a second protocol beside `PlanChange`'],
          },
        ],
        chosen: 'An update: a list of `PlanChange` values',
        why: '`7267049` defines an update as a list of changes checked as a whole before any is stored, and the plan schema tells a tool that the file is read-only: to change the plan it returns an update, never an edited copy. Because an update is made of the values the viewer already stores, `applyChange`, the history and undo cover model edits with no new code.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '7267049' },
          { kind: 'file', ref: 'packages/plan-domain/src/schema.ts', note: 'the description of `PLAN_SCHEMA`' },
          { kind: 'file', ref: 'CLAUDE.md', note: 'a chat or a tool changes the plan with an update' },
        ],
      },
      {
        question: 'One protocol for every channel, or one per channel?',
        options: [
          {
            name: 'One protocol in `plan-domain`, thin adapters',
            pros: [
              'The rules live once',
              'Tests catch drift between schema, guide and parser',
              'A new channel is only an adapter',
            ],
            cons: ['The domain package carries prompt text (`guide.ts`)'],
          },
          {
            name: 'Each channel formats and checks on its own',
            pros: ['Each can be tuned to its client'],
            cons: ['Three parsers and three rule sets that drift apart'],
          },
        ],
        chosen: 'One protocol in `plan-domain`, thin adapters',
        why: '`7267049` serves the same documents three ways, and the MCP script opens with the rule: it is a thin adapter, the documents and their rules come from `@lc/plan-domain`. The later research confirmed it: one update document, one parser and one guide is what every route needs; the adapters are what is thin.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '7267049' },
          { kind: 'file', ref: 'packages/plan-data/scripts/mcp.ts', note: 'the header comment' },
          { kind: 'file', ref: 'docs/llm-integration-research.md', note: '1. Short answer' },
        ],
      },
      {
        question: 'Should an update that breaks a rule of the plan be refused?',
        options: [
          {
            name: 'Refuse it',
            pros: ['The plan never breaks a rule'],
            cons: ['The person may want a session on a Saturday, and a model could not do what was asked'],
          },
          {
            name: 'Warn in the preview and let the person decide',
            pros: ['The person sees holidays, weekends, overlaps, deadlines and finished sessions before applying'],
            cons: ['A careless apply can still break a rule'],
          },
          {
            name: 'Check only the weekly budget',
            pros: ['Little code'],
            cons: ['A session on a holiday or on top of another comes back as fine'],
          },
        ],
        chosen: 'Warn in the preview and let the person decide',
        why: '`febfff0` says the preview had checked only the weekly budget, so a model could put a session on a holiday or after its course deadline and the update came back as fine; `ruleWarnings` now checks what a change touched, and the warnings warn and do not refuse. The comment in `rules.ts` gives the reason: the person may want a session on a Saturday.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: 'febfff0' },
          { kind: 'file', ref: 'packages/plan-domain/src/rules.ts', note: 'the JSDoc of `RuleWarning`' },
        ],
      },
      {
        question: 'Which API of the MCP SDK should the server use?',
        options: [
          {
            name: 'The high-level `McpServer`',
            pros: ['Less code per tool', 'Typed handlers'],
            cons: ['Takes tool inputs as Zod shapes, while the contract already exists as raw JSON Schema'],
          },
          {
            name: 'The low-level `Server` with raw JSON Schema',
            pros: ['`inputSchema: UPDATE_SCHEMA` reuses the schema the route and the tests use'],
            cons: [
              'Tool names are switched on by hand',
              'The class is marked deprecated in SDK 1.x, so the import needs a lint suppression',
            ],
          },
        ],
        chosen: 'The low-level `Server` with raw JSON Schema',
        why: 'The suppression above `new Server` in `mcp.ts` gives the reason: `McpServer` takes Zod shapes, and the tools here are raw JSON Schema. Rewriting `UPDATE_SCHEMA` as Zod would have created a second definition of the protocol.',
        evidence: 'evidenced',
        sources: [{ kind: 'file', ref: 'packages/plan-data/scripts/mcp.ts', note: 'the comment above `new Server`' }],
      },
    ],
    steps: [
      {
        title: 'Add coarse change kinds',
        detail:
          'A model adds a course in one answer, so the domain gets `course.add` (a new calendar and its sessions as one step) and `events.add` (several events in calendars that exist). A new event may carry a plain weekly `rrule` and the `lab` kind, so an event made outside the generator can repeat, skip a day and have one repeat moved like a generated one.',
        files: [
          {
            path: 'packages/plan-domain/src/changes.ts',
            lines: [20, 42],
            note: '`NewEvent` with `kind` and `rrule`, and `NewSession`.',
          },
          {
            path: 'packages/plan-domain/src/changes.ts',
            lines: [95, 99],
            note: 'The two kinds in the `PlanChange` union.',
          },
          {
            path: 'packages/plan-domain/src/changes.ts',
            lines: [381, 396],
            note: 'Applying them; a duplicate course name is refused.',
          },
        ],
        commit: 'a20dc07',
      },
      {
        title: 'Describe both documents with JSON Schema',
        detail:
          'Shared field schemas (`LOCAL_TIME`, `DAY`, `COLOR`, `RRULE`, `TITLE`) each carry a pattern and a description that says how to fill them. `change()` builds one closed object schema per kind, and `UPDATE_SCHEMA` takes `oneOf` them. `UPDATE_CHANGE_TYPES` lists what an update may carry: emptying the trash and removing calendars stay with the person.',
        files: [
          {
            path: 'packages/plan-domain/src/schema.ts',
            lines: [1, 41],
            note: 'Formats and field schemas written for a model.',
          },
          {
            path: 'packages/plan-domain/src/schema.ts',
            lines: [108, 116],
            note: 'The plan file is read-only for a tool.',
          },
          { path: 'packages/plan-domain/src/schema.ts', lines: [211, 217], note: 'One closed schema per change kind.' },
          {
            path: 'packages/plan-domain/src/schema.ts',
            lines: [383, 424],
            note: 'The allowed kinds and `UPDATE_SCHEMA`.',
          },
        ],
        commit: '7267049',
      },
      {
        title: 'Parse, preview and report an update',
        detail:
          '`parseUpdate` accepts the document, a bare list, one change, or the text of an answer, trying the whole text, then its code blocks from the last, then the outermost braces. It refuses unknown or forbidden kinds and names the change at fault. `previewUpdate` applies the changes in memory, and `reportPreview` turns the result into plain data a tool can read back.',
        files: [
          {
            path: 'packages/plan-domain/src/update.ts',
            lines: [24, 73],
            note: 'Finding JSON in an answer and parsing every change.',
          },
          {
            path: 'packages/plan-domain/src/update.ts',
            lines: [93, 149],
            note: '`reportPreview`, `previewUpdate` and `updateOutcome`.',
          },
        ],
        commit: '7267049',
      },
      {
        title: 'Generate the guide and the brief from the plan',
        detail:
          '`planGuide` writes Markdown for a model: the contract, today in the plan zone, the layout of the file, the calendars with their open hours, the next eight weeks against the budget, naming rules and worked examples. `planBrief` appends the compact plan in `<plan>` tags, the request in `<request>` tags and the contract again. Examples are dated from `now`, so they are never in the past.',
        files: [
          {
            path: 'packages/plan-domain/src/guide.ts',
            lines: [9, 27],
            note: 'Future example days, the contract and `compactPlan`.',
          },
          {
            path: 'packages/plan-domain/src/guide.ts',
            lines: [54, 68],
            note: 'A worked example built from a real open session.',
          },
          {
            path: 'packages/plan-domain/src/guide.ts',
            lines: [256, 270],
            note: 'The brief: guide, tagged plan, tagged request, contract.',
          },
        ],
        commit: 'd282b5a',
      },
      {
        title: 'Keep schema, guide and parser in step with tests',
        detail:
          'The tests compile both schemas with Ajv. The generated plan and its compact copy must fit `PLAN_SCHEMA`; every JSON example of the guide must fit `UPDATE_SCHEMA`, parse and apply without a problem; a list of bad updates must be refused by the schema and by `parseUpdate` alike. A drift in any of the three fails `pnpm run test`.',
        files: [
          {
            path: 'packages/plan-domain/src/schema.test.ts',
            lines: [1, 93],
            note: 'The three-way agreement and the refusal list.',
          },
        ],
        commands: ['pnpm run test'],
        commit: '7267049',
      },
      {
        title: 'Serve the protocol over HTTP',
        detail:
          'Three server routes: the guide or the brief as Markdown, both schemas as JSON, and an update endpoint. `POST /api/plan-update` parses the body as text, previews, answers 422 with the change at fault, returns the report alone with `?dry=1`, refuses with 403 on a read-only host, and otherwise stores through `saveChanges`.',
        files: [
          { path: 'apps/web/src/routes/api/plan-guide.ts', lines: [5, 24], note: '`?brief=1` adds the plan.' },
          { path: 'apps/web/src/routes/api/plan-schema.ts', lines: [1, 11], note: 'Both schemas in one answer.' },
          {
            path: 'apps/web/src/routes/api/plan-update.ts',
            lines: [1, 33],
            note: 'Dry run, 422, 403 and the stored outcome.',
          },
          {
            path: 'packages/plan-data/src/store.ts',
            lines: [167, 184],
            note: '`saveChanges`: all or nothing, one step per change.',
          },
        ],
        commit: '7267049',
      },
      {
        title: 'Serve the protocol over MCP',
        detail:
          'The script declares tools with `inputSchema: UPDATE_SCHEMA` and annotations (`readOnlyHint`, `openWorldHint: false`), four resources and one prompt, and answers each request type with `setRequestHandler`. Errors come back as `isError: true` with the message of `PlanChangeError`, so the model knows which change to fix. `apply_update` previews first and stores only when the report is ok.',
        files: [
          { path: 'packages/plan-data/scripts/mcp.ts', lines: [35, 84], note: 'The read, preview and apply tools.' },
          {
            path: 'packages/plan-data/scripts/mcp.ts',
            lines: [176, 223],
            note: 'The server, its instructions and the tool handler.',
          },
          {
            path: 'packages/plan-data/scripts/mcp.ts',
            lines: [225, 260],
            note: 'Resources, the prompt and the stdio transport.',
          },
          { path: '.mcp.json', lines: [1, 8], note: 'The registration for Claude Code.' },
        ],
        commands: ['pnpm --silent run mcp'],
        commit: '7267049',
      },
      {
        title: 'An AI chat tab for any chat app',
        detail:
          'The plan file reader gains an AI chat tab: write a request or pick a ready one, copy the brief and open Claude, ChatGPT or Gemini in the same click, paste the answer back. The tab parses it live, previews what it adds, removes and changes, lets single changes be left out, and applies the rest as history steps through `onApply`, all or none. `6db86bf` added the tab; `c987824` added the ready requests, the chat links and leaving single changes out.',
        files: [
          {
            path: 'modules/planner/src/features/open-plan-file/ui/ReaderAssistant.tsx',
            lines: [43, 65],
            note: 'Chat links, the MCP entry and the agent instruction.',
          },
          {
            path: 'modules/planner/src/features/open-plan-file/ui/ReaderAssistant.tsx',
            lines: [98, 160],
            note: 'Brief, clipboard, live parse and apply.',
          },
        ],
        commit: '6db86bf',
      },
      {
        title: 'Warn about the rules an update breaks',
        detail:
          '`ruleWarnings` looks only at what the update touched: a session on a holiday or a weekend, an overlap with a busy event (repeats included), a session after its course deadline, and a finished session changed or removed. `updateOutcome` attaches the warnings to every preview; tools receive them as sentences and the tab lists them in the language of the page.',
        files: [
          {
            path: 'packages/plan-domain/src/rules.ts',
            lines: [7, 72],
            note: 'The warnings and their words for a model.',
          },
          {
            path: 'packages/plan-domain/src/update.ts',
            lines: [132, 149],
            note: 'Every preview carries the warnings.',
          },
        ],
        commit: 'febfff0',
      },
      {
        title: 'Apply the research to the guide',
        detail:
          'A research pass over the MCP specification and the vendor prompt guides found the answer format stated about 30,000 characters above the request and examples with fixed dates soon in the past. The guide now opens with a five-line contract, the brief tags the plan and the request and repeats the contract last, and the examples are dated from today.',
        files: [
          {
            path: 'docs/llm-integration-research.md',
            lines: [510, 530],
            note: 'The current guide against the vendor advice.',
          },
          { path: 'packages/plan-domain/src/guide.ts', lines: [9, 16], note: 'The contract.' },
        ],
        commit: 'd282b5a',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run test',
        'curl -s http://localhost:3000/api/plan-guide',
        'curl -s -X POST \'http://localhost:3000/api/plan-update?dry=1\' -H \'Content-Type: application/json\' -d \'{"changes":[{"type":"plan.rename","title":"Test"}]}\'',
        'curl -s -X POST \'http://localhost:3000/api/plan-update?dry=1\' -d \'{"changes":[{"type":"trash.empty"}]}\'',
      ],
      expect: [
        '`schema.test.ts` passes: the plan fits its schema, every guide example validates, parses and applies, and every bad update is refused by both the schema and the parser.',
        'With `pnpm run dev` running, Markdown that starts with `# How to work with this study plan` and the five-line contract.',
        'A JSON report with `"ok": true`; nothing is stored because of `?dry=1`.',
        'Status 422 with `Change 1 (trash.empty): an update cannot carry this type of change`.',
      ],
      quiz: [
        {
          question:
            'An update has three changes and the second names an unknown `uid`. What does `POST /api/plan-update` do?',
          options: [
            'Stores changes 1 and 3 and reports change 2',
            'Stores change 1 and stops',
            'Answers 422 with a report that names change 2, and stores nothing',
            'Stores all three and adds a warning',
          ],
          answer: 2,
          explanation:
            '`previewUpdate` stops at the first change that throws and reports its index; the route answers 422 before `saveChanges` is called. An update is all or nothing.',
        },
        {
          question: 'Why is the MCP server started with `pnpm --silent run mcp`?',
          options: [
            'To make it start faster',
            'Because stdout carries the JSON-RPC messages, and any other output would corrupt them',
            'To hide secrets from the logs',
            'Because Claude Code requires the flag',
          ],
          answer: 1,
          explanation:
            'Over the stdio transport the protocol is the stdout of the subprocess. pnpm would otherwise print its own banner there.',
        },
        {
          question: 'What does `schema.test.ts` guarantee?',
          options: [
            'That models always answer correctly',
            'That the JSON Schema, the examples in the guide and `parseUpdate` agree',
            'That the MCP server starts',
            'That the plan stays within the weekly budget',
          ],
          answer: 1,
          explanation:
            'The three describe one protocol in three places. The tests validate the guide examples with Ajv and the parser, and check that what the schema refuses the parser refuses too.',
        },
      ],
    },
    pitfalls: [
      'Examples with fixed dates went stale within days and contradicted the guide, which tells a model to stay out of the past; they are computed from `now` since `d282b5a`.',
      'The answer format sat about 30,000 characters above the request; the contract now opens the guide and closes the brief (`d282b5a`, research 6.2).',
      'The preview checked only the weekly budget, so a session on a holiday or on top of another came back as fine (`febfff0`).',
      'An update that only marks done, logs time or skips a repeat previewed as no change, because the diff compared title, time and calendar only (`b7df72e`).',
      'The brief is 42,735 characters, more than any documented prefill link takes (5,000 for Claude Code, about 14,000 for Claude Desktop); the tab copies it to the clipboard and opens the chat app instead (`c987824`, research 3.2).',
      '`/api/plan-update` has no authentication: keep the app on localhost or behind a login before exposing it (research finding 9).',
    ],
    tradeoffs: [
      'Warnings instead of refusals trust the person; a careless apply can still put a session on a holiday.',
      'The low-level MCP `Server` reuses the JSON Schemas but is deprecated, and SDK 1.x speaks the 2025-11-25 revision while the current one is 2026-07-28. The research (finding 1) notes that nothing breaks; the newer features come with a move to SDK v2.',
      'stdio needs a client on the same machine that can run `pnpm`; claude.ai or ChatGPT on the web would need a remote Streamable HTTP endpoint with a login.',
      '`UPDATE_SCHEMA` uses `oneOf`, length and range keywords, so it cannot serve as-is for strict structured output at the three large providers; it works as a tool input schema (research 5.4).',
    ],
    links: [
      { label: 'JSON Schema: What is a schema?', href: 'https://json-schema.org/understanding-json-schema/about' },
      { label: 'Ajv JSON schema validator', href: 'https://ajv.js.org/' },
      {
        label: 'MCP: What is the Model Context Protocol?',
        href: 'https://modelcontextprotocol.io/docs/getting-started/intro',
      },
      {
        label: 'MCP specification 2025-11-25: Tools',
        href: 'https://modelcontextprotocol.io/specification/2025-11-25/server/tools',
      },
      {
        label: 'MCP specification 2025-11-25: Transports',
        href: 'https://modelcontextprotocol.io/specification/2025-11-25/basic/transports',
      },
      { label: 'Claude Code: Connect to tools via MCP', href: 'https://code.claude.com/docs/en/mcp' },
      {
        label: 'TanStack Start: Server Routes',
        href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-routes',
      },
      {
        label: 'Claude: Prompting best practices',
        href: 'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices',
      },
    ],
    next: 'Chapter 18 keeps the plan in Google Calendar and Outlook through one sync engine, and takes edits made there back into the plan, with Undo.',
  },
] satisfies readonly Syllabus[]
