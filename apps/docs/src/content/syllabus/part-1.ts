import type { Syllabus } from './types'

export const PART_1 = [
  {
    id: 'scaffold',
    summary:
      'You go from an empty folder to a server-rendered React app on TanStack Start: file routes, a root document, one page and one JSON endpoint, built by Vite and served by Nitro. Then you move the project to pnpm, Node 26 and TypeScript 7, the toolchain every later chapter assumes.',
    whereWeAre:
      'Nothing exists yet. The history starts at `1370abc` (22 Nov 2026, 16:19), which already holds a working app of 35 files installed with npm; how that tree was generated is not recorded. `201ce64` follows 19 minutes later with the toolchain switch; like the first commit it is titled `init` and has no body.',
    problem:
      'The plan needs more than a static page. It needs HTML rendered on the server, so the first paint already shows the week, and plain HTTP endpoints (`/api/plan`, `/api/ics/:calendarId`) that a calendar app can subscribe to. A Vite single-page app gives neither without a second server, and a hand-wired SSR setup costs days before the first screen exists.',
    outcomes: [
      'Create a TanStack Start project and say what each starter file does: `vite.config.ts`, `src/router.tsx`, `src/routes/__root.tsx`, `src/routeTree.gen.ts`.',
      'Add a page route with `createFileRoute` and a server route with `server.handlers` in the same `src/routes` tree.',
      'Explain what `shellComponent`, `HeadContent` and `Scripts` do in the root document.',
      'Build with `vite build` and run the Nitro output with `node .output/server/index.mjs`.',
      'Use the `#/` import alias and name the three settings that make it resolve.',
      'Move a project from npm to pnpm and allow dependency build scripts with `allowBuilds`.',
    ],
    concepts: [
      {
        term: 'TanStack Start',
        explanation:
          'A full-stack React framework built on TanStack Router and Vite. Each request is rendered on the server into a complete HTML document, then React hydrates it in the browser. The same `src/routes` tree also holds HTTP endpoints, so here one process renders the planner and serves the `.ics` feeds.',
        link: {
          label: 'TanStack Start overview',
          href: 'https://tanstack.com/start/latest/docs/framework/react/overview',
        },
      },
      {
        term: 'File-based routing and the generated route tree',
        explanation:
          'Each file in `src/routes` is a route: `index.tsx` is `/`, `api/plan.ts` is `/api/plan`, a `$name` segment is a path parameter, and a `.` in a file name nests segments, so `api/ics.$calendarId.ts` is `/api/ics/$calendarId`. The router plugin scans the folder and writes `routeTree.gen.ts`, which wires the routes together and gives every `Link` and `navigate` call its types. Treat that file like a lockfile: commit it, never edit it.',
        link: {
          label: 'File-based routing',
          href: 'https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing',
        },
      },
      {
        term: 'Root route and the document shell',
        explanation:
          '`__root.tsx` exports `createRootRoute(...)`. Its `head()` returns meta tags and links, `shellComponent` renders `<html>`, `<head>` and `<body>` and is always server-rendered, and `notFoundComponent` handles unknown paths. `<HeadContent />` prints what `head()` returned and `<Scripts />` adds the client bundle; without them the page has no title or never hydrates.',
        link: {
          label: 'Document head management',
          href: 'https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management',
        },
      },
      {
        term: 'Router factory and type registration',
        explanation:
          '`src/router.tsx` exports `getRouter()`, which must return a new router instance each time it is called; the Start routing guide requires it. The `declare module` block that extends `Register` tells TanStack Router which router this app uses, so route paths, params and search params are type-checked everywhere, including `Route.useSearch()` in chapter 3.',
        link: {
          label: 'Start routing guide',
          href: 'https://tanstack.com/start/latest/docs/framework/react/guide/routing',
        },
      },
      {
        term: 'Server routes',
        explanation:
          'A route file can pass `server: { handlers: { GET } }` to `createFileRoute`. The handler gets the Web `Request` and returns a Web `Response`, so an endpoint is a few lines with no extra server framework. Here `/api/plan` returns the plan as JSON and `/api/ics/$calendarId` returns `text/calendar`.',
        link: {
          label: 'Server routes',
          href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-routes',
        },
      },
      {
        term: 'Vite plugins and the Nitro build',
        explanation:
          '`vite.config.ts` lists the plugins that turn the source into an app: `tanstackStart()` (route tree, client and server entries, SSR), `viteReact()` (JSX and Fast Refresh) and `nitro()` (the server build). Nitro writes client and server into one `.output/` folder; `.output/server/index.mjs` is a ready Node server that listens on port 3000 unless `PORT` or `NITRO_PORT` says otherwise.',
        link: { label: 'Nitro as a Vite plugin', href: 'https://nitro.build/docs/vite' },
      },
      {
        term: 'The `#/` import alias',
        explanation:
          '`#/components/WeekGrid` means `src/components/WeekGrid`. Three settings agree on it: the `imports` field in `package.json` (Node subpath imports, which must start with `#`), `paths` in `tsconfig.json` for the type checker, and `resolve.tsconfigPaths: true` in `vite.config.ts` for the bundler. It stays private to the app; packages added in chapter 10 import each other by name.',
        link: { label: 'Node.js subpath imports', href: 'https://nodejs.org/api/packages.html#subpath-imports' },
      },
      {
        term: 'pnpm and dependency build scripts',
        explanation:
          'pnpm links packages from one content-addressable store and puts only declared dependencies at the top of `node_modules`, so code cannot import a package it did not list. It also does not run the install scripts of dependencies unless they are allowed: `allowBuilds` in `pnpm-workspace.yaml` lists the ones that may run (`esbuild` here, `nx` later).',
        link: { label: 'pnpm build settings', href: 'https://pnpm.io/settings/build' },
      },
    ],
    decisions: [
      {
        question: 'How do you get from an empty folder to a working Start app?',
        options: [
          {
            name: 'Official CLI scaffold',
            pros: [
              'One command (`npx @tanstack/cli@latest create`) gives a running SSR app with the router plugin, the Vite config and a server build already wired',
              'Prompts for the package manager and add-ons; `--blank` gives a one-route project',
            ],
            cons: [
              'The starter brings files and settings the app does not need, which you delete or carry along',
              'What the template decided is not visible in your history',
            ],
          },
          {
            name: 'Clone the start-basic example',
            pros: [
              '`npx gitpick TanStack/router/tree/main/examples/react/start-basic start-basic` copies a maintained example with several routes',
            ],
            cons: ['Example pages and dependencies to strip out', 'Follows the router repository, not a CLI release'],
          },
          {
            name: 'Assemble by hand',
            pros: ['The official build-from-scratch guide shows every file, so nothing arrives unexplained'],
            cons: ['Slower to a first screen', 'Easy to miss a piece such as the router type registration'],
          },
        ],
        chosen: 'Official CLI scaffold',
        why: 'Reconstruction: the scaffold step is not in the history. The first commit already holds a complete app plus leftovers that look generated rather than written: `.gitignore` entries for `.wrangler`, `.vinxi` and `todos.json`, a Nitro option that keeps `@sentry/*` external although Sentry is not a dependency, and editor settings that hide `routeTree.gen.ts`. That points to a generator, most likely the official CLI, but the tool and its flags cannot be shown.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '1370abc', note: '35 files, an npm lockfile, no commit body' },
          { kind: 'file', ref: '.gitignore', at: '1370abc', note: 'entries for tools the app never used' },
          { kind: 'doc', ref: 'https://tanstack.com/start/latest/docs/framework/react/getting-started' },
        ],
      },
      {
        question: 'Does the app need its own server, or is a static page enough?',
        options: [
          {
            name: 'Full-stack app with server routes',
            pros: [
              'A calendar app can subscribe to a URL such as `/api/ics/certs` and pick up every deploy',
              'The first HTML already contains the week: no loading state',
            ],
            cons: [
              'Needs a Node host, not just static files',
              'Server and browser must render the same markup (hydration)',
            ],
          },
          {
            name: 'Static single-page app with downloads only',
            pros: ['Any static host', 'Simplest mental model'],
            cons: ['No subscription URL: every change means importing files again and deleting duplicates'],
          },
          {
            name: 'Single-page app plus a separate API service',
            pros: ['A clear split between UI and API'],
            cons: ['Two deployables, two dev servers and a shared type contract to keep in step for a one-person tool'],
          },
        ],
        chosen: 'Full-stack app with server routes',
        why: 'The first README says why the endpoints exist: once deployed on a public URL, `/api/ics/:calendarId` can be added in Google Calendar or Outlook as a subscription, and "the calendar then updates itself after each deploy, with no re-import and no duplicates". That needs a server answering HTTP, and TanStack Start keeps those routes next to the pages.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'README.md', at: '1370abc', note: 'lines 57-59' },
          { kind: 'doc', ref: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-routes' },
        ],
      },
      {
        question: 'Which package manager?',
        options: [
          {
            name: 'npm, as in the first commit',
            pros: ['Ships with Node', 'No extra tool to install'],
            cons: [
              'Flat `node_modules`: code can import a package it never declared',
              'Runs the install scripts of every dependency by default',
            ],
          },
          {
            name: 'pnpm',
            pros: [
              'Strict `node_modules`: only declared dependencies resolve',
              'Dependency build scripts run only when listed in `allowBuilds`',
              'Workspaces and catalogs for the monorepo that comes in chapter 9',
            ],
            cons: [
              'One more tool, pinned through the `packageManager` field',
              'Different habits: `pnpm run plan --ics` instead of `npm run plan -- --ics`',
            ],
          },
        ],
        chosen: 'pnpm',
        why: 'Reconstruction: `201ce64` is titled `init` and has no body. It removes `package-lock.json`, adds `pnpm-lock.yaml`, `packageManager: pnpm@12.21.0` and a `pnpm-workspace.yaml` with `allowBuilds`, and rewrites every `npm run` in the README and CLAUDE.md. The architecture doc written two hours later relies on the strictness: "pnpm: a package can only import what its package.json lists" is the first of three things that enforce the dependency rules.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '201ce64' },
          { kind: 'file', ref: 'docs/architecture.md', note: 'line 43' },
          { kind: 'doc', ref: 'https://pnpm.io/motivation' },
        ],
      },
      {
        question: 'Keep the scaffold toolchain, or move to the newest one right away?',
        options: [
          {
            name: 'Keep Node 22, TypeScript 6 and the Nitro beta',
            pros: ['What the scaffold was tested with', 'The ESLint and typescript-eslint tooling works'],
            cons: ['A second migration later, over more code'],
          },
          {
            name: 'Move to Node 26, TypeScript 7 and the Nitro rc now',
            pros: [
              'The upgrade touches 35 files instead of hundreds',
              'No lint or test setup depends on the old versions yet',
            ],
            cons: [
              'TypeScript 7 has no compiler API, so typescript-eslint and the Nx TypeScript plugins do not run',
              'Nitro is a release candidate',
            ],
          },
        ],
        chosen: 'Move to Node 26, TypeScript 7 and the Nitro rc now',
        why: 'Reconstruction: `201ce64` raises `engines.node` from `>=22.12` to `>=26`, `typescript` from `6.0.3` to `7.0.2` and `nitro` from a beta to an rc without saying why. The cost is recorded later: `6aca64f` picks Oxlint because typescript-eslint does not support TypeScript 7, and CLAUDE.md lists the tools that cannot run here.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '201ce64' },
          { kind: 'commit', ref: '6aca64f', note: 'the linter choice that follows from TypeScript 7' },
          { kind: 'file', ref: 'CLAUDE.md', note: 'line 15' },
        ],
      },
    ],
    steps: [
      {
        title: 'Scaffold the app',
        detail:
          'Run the official CLI and answer its prompts; this step is reconstructed, since the history starts after it. The result is a Vite project whose `package.json` has four scripts that still exist in `apps/web`: `dev` (Vite on port 3000), `build`, `preview` and `start` (the Nitro server). The runtime dependencies are `@tanstack/react-start`, `@tanstack/react-router`, React 19 and `nitro`; Vite and `@vitejs/plugin-react` are dev dependencies.',
        files: [
          {
            path: 'package.json',
            at: '1370abc',
            lines: [8, 32],
            note: 'The scripts and dependencies of the first commit.',
          },
          {
            path: 'apps/web/package.json',
            lines: [6, 13],
            note: 'The same four scripts in the app today, plus typecheck and lint.',
          },
        ],
        commands: ['npx @tanstack/cli@latest create'],
        commit: '1370abc',
      },
      {
        title: 'Read the Vite config',
        detail:
          'Three plugins build the app: `tanstackStart()` generates the route tree and the client and server entries, `viteReact()` compiles JSX with Fast Refresh, and `nitro()` produces the deployable server in `.output/`. `resolve.tsconfigPaths: true` makes Vite honour the `paths` of `tsconfig.json`. The current config keeps the same core and adds Paraglide, Tailwind and settings for the HiGHS solver.',
        files: [
          {
            path: 'vite.config.ts',
            at: '1370abc',
            lines: [1, 18],
            note: 'The whole first config: three plugins and the tsconfig paths switch.',
          },
          {
            path: 'apps/web/vite.config.ts',
            lines: [8, 28],
            note: 'The same plugins today, with i18n and Tailwind in front.',
          },
        ],
      },
      {
        title: 'Create the router',
        detail:
          "`getRouter()` builds a router from the generated `routeTree`. `defaultPreload: 'intent'` loads a route when the pointer rests on its link, and `scrollRestoration` restores the scroll position on back and forward. The `Register` interface registers this router type globally. Six chapters later the file has only gained a `rewrite` for languages.",
        files: [
          { path: 'src/router.tsx', at: '1370abc', lines: [1, 19], note: 'The factory and the type registration.' },
          { path: 'apps/web/src/router.tsx', lines: [6, 19], note: 'Today: the same options plus the locale rewrite.' },
        ],
      },
      {
        title: 'Write the root document',
        detail:
          '`__root.tsx` owns the HTML. `head()` returns the charset, a viewport with `viewport-fit=cover` for phones with a notch, the title, preconnects and the Google Fonts stylesheet, and the app CSS imported with `?url` so Vite hands back its hashed address. `shellComponent: RootDocument` renders `<html lang="ru">` with `<HeadContent />` in the head and `<Scripts />` at the end of the body; the matched page arrives as `children`.',
        files: [
          {
            path: 'src/routes/__root.tsx',
            at: '1370abc',
            lines: [1, 40],
            note: 'Head tags, the shell component and the not-found page.',
          },
          {
            path: 'apps/web/src/routes/__root.tsx',
            lines: [11, 60],
            note: 'Today: a localized title, a color-scheme meta and two boot scripts in the same structure.',
          },
        ],
      },
      {
        title: 'Let the router plugin write the route tree',
        detail:
          'Start the dev server once and `src/routeTree.gen.ts` appears. It imports every route file, attaches each to its parent with `update({ id, path, getParentRoute })`, declares the path types and registers the router with Start. The file opens with a warning not to edit it, and the starter marks it read-only in VS Code and hides it from search. `tsr.config.json` sets the generator target to React.',
        files: [
          {
            path: 'src/routeTree.gen.ts',
            at: '1370abc',
            lines: [1, 15],
            note: 'The warning header and one import per route file.',
          },
          {
            path: 'src/routeTree.gen.ts',
            at: '1370abc',
            lines: [111, 122],
            note: 'The assembled tree and the Start registration.',
          },
          {
            path: '.vscode/settings.json',
            at: '1370abc',
            lines: [1, 11],
            note: 'The generated file is excluded from watching and search, and read-only.',
          },
          { path: 'tsr.config.json', at: '1370abc', lines: [1, 3], note: 'The generator config.' },
        ],
        commands: ['npm run dev'],
      },
      {
        title: 'Add the first server route',
        detail:
          '`src/routes/api/plan.ts` is a route with no component and a `server.handlers.GET`. It returns `Response.json(planData)` with `Cache-Control: no-store`, so a client always gets the current plan. Because it lives in the same tree, the generated route tree lists `/api/plan` next to `/` and the dev server answers both. Today the handler reads the plan from disk through `@lc/plan-data` instead of a bundled import.',
        files: [
          { path: 'src/routes/api/plan.ts', at: '1370abc', lines: [1, 11], note: 'A GET handler that returns JSON.' },
          {
            path: 'apps/web/src/routes/api/plan.ts',
            lines: [1, 11],
            note: 'The same route today, reading the file at request time.',
          },
        ],
      },
      {
        title: 'Wire the `#/` alias',
        detail:
          'Imports such as `#/lib/plan/dates` must resolve in three tools, and each needs its own setting: Node reads the `imports` field of `package.json`, TypeScript reads `paths`, and Vite reads the tsconfig because of `resolve.tsconfigPaths`. Use the alias only inside the app. Once code moves into packages, the app type-checks their sources with its own tsconfig, so a package that used an alias would resolve it against the wrong folder; CLAUDE.md forbids aliases there.',
        files: [
          { path: 'package.json', at: '1370abc', lines: [5, 7], note: 'The subpath import Node understands.' },
          { path: 'tsconfig.json', at: '1370abc', lines: [8, 10], note: 'The same mapping for the type checker.' },
          { path: 'apps/web/tsconfig.json', lines: [1, 10], note: 'Today the alias is declared only for the app.' },
        ],
      },
      {
        title: 'Build and run the production server',
        detail:
          '`vite build` builds the client and the server bundle, and the Nitro plugin writes both into `.output/`. `start` runs `node .output/server/index.mjs`, a self-contained Node server; `.output` is ignored by git. That folder is what you deploy.',
        files: [
          { path: 'package.json', at: '1370abc', lines: [8, 15], note: 'The build and start scripts.' },
          { path: '.gitignore', at: '1370abc', lines: [1, 14], note: 'Build output and tool folders stay out of git.' },
        ],
        commands: ['npm run build', 'npm start'],
      },
      {
        title: 'Switch to pnpm, Node 26 and TypeScript 7',
        detail:
          'Delete `package-lock.json`, run `pnpm install` and commit `pnpm-lock.yaml`. pnpm does not run dependency build scripts unless allowed, so the `pnpm.onlyBuiltDependencies` block in `package.json` becomes `allowBuilds` in `pnpm-workspace.yaml`, with only `esbuild`. Pin the tool with `packageManager`, raise `engines.node` to `>=26`, and update TypeScript, Nitro, Vite and the React plugin. pnpm passes flags after the script name straight to the script, so the README turns `npm run plan -- --ics` into `pnpm run plan --ics`.',
        files: [
          {
            path: 'package.json',
            at: '201ce64',
            lines: [16, 37],
            note: 'New versions, the Node engine and the pinned pnpm.',
          },
          {
            path: 'pnpm-workspace.yaml',
            at: '201ce64',
            lines: [1, 2],
            note: 'The one dependency allowed to run its build script.',
          },
          { path: 'README.md', at: '201ce64', lines: [6, 23], note: 'Every command rewritten for pnpm.' },
        ],
        commands: ['pnpm install', 'pnpm run dev'],
        commit: '201ce64',
      },
    ],
    checkpoint: {
      commands: [
        'git worktree add ../learning-curve-201ce64 201ce64',
        'cd ../learning-curve-201ce64 && pnpm install',
        'pnpm run dev',
        'pnpm run build && pnpm start',
        'git worktree remove ../learning-curve-201ce64',
      ],
      expect: [
        'The worktree is a second checkout of the repository at the end of this chapter; your own checkout is not touched.',
        '`pnpm install` installs from `pnpm-lock.yaml` and runs the build script of `esbuild` only.',
        'Vite prints a local address on port 3000. http://localhost:3000/ shows the plan viewer in Russian, and `curl -s http://localhost:3000/api/plan` prints a JSON object with `meta`, `calendars` and `events`.',
        '`pnpm run build` writes `.output/`, and `pnpm start` serves the same pages from `.output/server/index.mjs` on port 3000.',
      ],
      quiz: [
        {
          question: 'You add `src/routes/api/ics.$calendarId.ts`. Which URL does it serve?',
          options: [
            '`/api/ics.$calendarId`, literally',
            '`/api/ics/:calendarId`, with `calendarId` as a path parameter',
            '`/api/ics?calendarId=...`',
            'Nothing until you add it to `routeTree.gen.ts` by hand',
          ],
          answer: 1,
          explanation:
            'A `.` in a file name nests a segment and `$` marks a parameter. The router plugin adds the route to `routeTree.gen.ts` itself; a hand edit there is overwritten on the next scan.',
        },
        {
          question: 'What goes wrong if `<Scripts />` is left out of `RootDocument`?',
          options: [
            'The page title disappears',
            'The server answers 500',
            'The server HTML arrives, but the client bundle never loads, so React does not hydrate and nothing responds to clicks',
            'Server routes stop answering',
          ],
          answer: 2,
          explanation:
            '`<HeadContent />` renders the head tags; `<Scripts />` renders the body scripts that load the client and hydrate the server markup. Server routes do not go through the document at all.',
        },
        {
          question: 'Why does `201ce64` add `allowBuilds: { esbuild: true }` to `pnpm-workspace.yaml`?',
          options: [
            'pnpm runs the build scripts only of dependencies allowed there, and `esbuild` needs its script',
            'It makes installs faster by skipping the lockfile check',
            'It is what makes the `#/` alias work',
            'It tells Vite which packages to pre-bundle',
          ],
          answer: 0,
          explanation:
            'pnpm treats packages that are not listed in `allowBuilds` as unreviewed and does not run their build scripts. The npm-era `pnpm.onlyBuiltDependencies` block in `package.json` moves there.',
        },
      ],
    },
    pitfalls: [
      'Editing `routeTree.gen.ts` by hand: the router plugin rewrites it on the next scan. Add or rename files in `src/routes` instead; the starter marks the file read-only in VS Code, and the Oxlint and Oxfmt configs ignore it.',
      'Carrying npm habits over: `npm run plan -- --ics` needs the `--`, pnpm passes flags through directly. `201ce64` rewrites the README to `pnpm run plan --ics`.',
      'Expecting the ESLint ecosystem on TypeScript 7: it has no compiler API, so typescript-eslint and the Nx TypeScript and module-boundary plugins do not run. Linting moves to Oxlint (`6aca64f`) and boundaries to Oxlint overrides (`docs/architecture.md`).',
      'A dependency whose build script pnpm skipped fails later, far from the install. Add it to `allowBuilds`; the workspace later adds `nx` there too.',
      'Rendering the current time during SSR makes the server HTML differ from the first browser render, and React reports a hydration mismatch. The first commit already avoids it with a `useNow` hook that returns `null` until after hydration (chapter 3).',
      'Using the `#/` alias inside a shared package: it resolves against the project that type-checks the file, so it breaks as soon as another project reads the source. CLAUDE.md forbids path aliases in `modules/*` and `packages/*`.',
    ],
    tradeoffs: [
      'SSR gives a complete first paint and real HTTP endpoints, at the price of a Node host and markup that must match between server and browser.',
      'A generator is the fastest start but leaves residue: the `@sentry` external in the Nitro options and the `.wrangler` and `todos.json` lines in `.gitignore` are still there at the pinned commit.',
      'Moving to TypeScript 7 on day one keeps the code on the newest compiler, and rules out ESLint-based tools until they support it.',
    ],
    links: [
      { label: 'TanStack Start: overview', href: 'https://tanstack.com/start/latest/docs/framework/react/overview' },
      {
        label: 'TanStack Start: getting started',
        href: 'https://tanstack.com/start/latest/docs/framework/react/getting-started',
      },
      { label: 'TanStack CLI reference', href: 'https://tanstack.com/cli/latest/docs/cli-reference' },
      {
        label: 'TanStack Start: build from scratch',
        href: 'https://tanstack.com/start/latest/docs/framework/react/build-from-scratch',
      },
      {
        label: 'TanStack Router: file-based routing',
        href: 'https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing',
      },
      {
        label: 'TanStack Start: selective SSR (shellComponent)',
        href: 'https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr',
      },
      { label: 'Nitro: Node.js runtime', href: 'https://nitro.build/deploy/runtimes/node' },
      { label: 'pnpm: build settings', href: 'https://pnpm.io/settings/build' },
    ],
    next: 'The app runs but has nothing to show; chapter 2 generates the schedule from code into `plan.json`.',
  },
  {
    id: 'plan-as-code',
    summary:
      'You model the study plan as TypeScript: courses as queues of sessions, rules as one config object, and a scheduler that places every session in a slot. A `tsx` script writes the result to `plan.json`, the one file the page, the API and the export read, and warns when a week goes over the 12 h budget.',
    whereWeAre:
      'The Start app from chapter 1 runs but has no data model. In the first commit `src/lib/plan/` already holds the content, the rules and the date helpers, and `src/data/plan.json` is committed next to them.',
    problem:
      'A plan typed straight into a calendar cannot be regenerated: change one course and every later session must be moved by hand, the weekly load is unknown until you count it, and a second import doubles the events. A hand-written JSON file has the same problem one level down. The plan needs a source that can be run again, a check for the budget, and ids that stay the same between runs.',
    outcomes: [
      'Describe a schedule as data (`QueueItem` lists) plus rules (`ScheduleConfig`) and generate dated events from them.',
      'Store local times as wall-clock strings and compute with them as UTC-naive milliseconds, independent of the machine time zone.',
      'Write a `tsx` script that regenerates a committed JSON artifact and warns about rule violations.',
      'Give generated events ids that survive regeneration and double as iCalendar `UID`s.',
      'Explain why `plan.json` is never edited by hand.',
    ],
    concepts: [
      {
        term: 'Generated, committed artifact',
        explanation:
          'The source of truth is code (`content.ts` plus `schedule.ts`); `plan.json` is its output. It is committed so that the app, the API and the export read one file, and so that a diff shows what a rule change did. Like `routeTree.gen.ts` it is regenerated, never edited: CLAUDE.md says so from the first commit.',
      },
      {
        term: 'Queues and slots',
        explanation:
          'Each course is an ordered list of sessions (`QueueItem`: title, 1 or 2 hours, kind, description). The scheduler walks the calendar day by day and takes the next item from a queue whenever a slot is free: certificate sessions on weekdays 12:00–14:00 first, courses at 11:00, 12:00 and 13:00 later. It is a greedy fill, not an optimizer: order in the queue is order in time.',
      },
      {
        term: 'Wall-clock strings, UTC-naive numbers',
        explanation:
          'Times are stored as `2026-11-23T12:00`, the clock on the wall in Minsk (UTC+3, no DST). For arithmetic they become milliseconds through `Date.UTC(...)` and are read back with `getUTCHours()` and friends, so the value never passes through the zone of the machine. `new Date(localString)` would parse in the zone of whatever server or browser runs it.',
        link: {
          label: 'MDN: Date.UTC()',
          href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC',
        },
      },
      {
        term: 'Stable event ids',
        explanation:
          'Every event gets `uid` = calendar id + a three-digit counter + `@learning-curve`, for example `certs-001@learning-curve`. The id is reused as the iCalendar `UID`, which calendar apps use to recognize the same event across imports. It holds only while the queue order holds: inserting a session renumbers the ones after it.',
      },
      {
        term: 'Recurrence instead of copies',
        explanation:
          "The gym is one event with `rrule: 'FREQ=WEEKLY;BYDAY=TU,TH'`, the RFC 5545 rule syntax without the `RRULE:` prefix, not dozens of copies. Readers expand it when they need dates (chapter 3), the export copies the rule as is, and the budget check skips it.",
        link: { label: 'RFC 5545 (iCalendar)', href: 'https://www.rfc-editor.org/rfc/rfc5545' },
      },
      {
        term: 'Budget as a check, not a constraint',
        explanation:
          "`weeklyHours(plan)` sums the busy, timed, non-repeating events per Monday. The scheduler does not stop at 12 h; the generator prints `Weeks over budget:` and you change the content or the rules. Free time (`availability: 'free'`), all-day items and the gym do not count.",
      },
      {
        term: 'Running TypeScript scripts with tsx',
        explanation:
          '`tsx` runs a `.ts` file in Node with no build step. The `plan` script is `tsx scripts/build-plan.ts`, and the script imports the same modules as the app, without file extensions, exactly as the app code does.',
        link: { label: 'tsx on GitHub', href: 'https://github.com/privatenumber/tsx' },
      },
    ],
    decisions: [
      {
        question: 'Where does the schedule live?',
        options: [
          {
            name: 'TypeScript source that generates committed JSON',
            pros: [
              'Rules run again in seconds after any change',
              'One file that the page, the API and the export all read',
              'A diff of `plan.json` shows the effect of a rule change',
            ],
            cons: [
              'Two files to keep in step: forget to regenerate and the app shows the old plan',
              'Changes made in the viewer need a separate layer (`edits.json`, chapter 7)',
            ],
          },
          {
            name: 'Hand-written JSON',
            pros: ['No generator to write'],
            cons: ['Moving one course means editing every later date by hand', 'No budget check'],
          },
          {
            name: 'Compute the schedule in the browser on every load',
            pros: ['No artifact to commit'],
            cons: [
              'The API and the `.ics` export need the same computation on the server',
              'No reviewable diff of what changed',
            ],
          },
        ],
        chosen: 'TypeScript source that generates committed JSON',
        why: 'The first README and CLAUDE.md state the arrangement and what it is for: content and rules are the source, `npm run plan` writes `src/data/plan.json`, and "The app, the API and the export all read this file". The README lists the file as "the database (generated, committed)", and CLAUDE.md says "never hand-edit it, regenerate". The README also lets the viewer open any other `plan.json`, which works because the plan is one self-contained file.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'README.md', at: '1370abc', note: 'lines 25-37 and 65' },
          { kind: 'file', ref: 'CLAUDE.md', at: '1370abc', note: 'line 4' },
        ],
      },
      {
        question: 'How are times stored?',
        options: [
          {
            name: 'Minsk wall-clock strings, computed as UTC-naive milliseconds',
            pros: [
              'Server and every browser get the same numbers, whatever their own zone',
              'Readable in JSON and in diffs',
              'No date library',
            ],
            cons: [
              'Correct only while the plan has one zone without DST; another zone needs explicit conversion (`zoneShift`, added later)',
              'Every helper must use the `getUTC*` methods',
            ],
          },
          {
            name: 'UTC instants such as `2026-11-23T09:00:00Z`',
            pros: ['An unambiguous moment in time'],
            cons: [
              'Every display and every slot rule converts to Minsk first',
              'A rule like "12:00 on weekdays" no longer reads as 12:00 in the data',
            ],
          },
          {
            name: 'A date-time library with time zones',
            pros: ['Handles DST and many zones'],
            cons: ['A dependency in pure domain code, for a zone that has no DST'],
          },
        ],
        chosen: 'Minsk wall-clock strings, computed as UTC-naive milliseconds',
        why: 'The header of `dates.ts` gives the reason: plan times are Europe/Minsk wall-clock strings (UTC+3 all year, no DST), "handled as UTC-naive millisecond values so that server and browser agree regardless of the machine\'s own time zone". The README repeats it.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'src/lib/plan/dates.ts', at: '1370abc', note: 'lines 1-3' },
          { kind: 'file', ref: 'README.md', at: '1370abc', note: 'lines 79-80' },
        ],
      },
      {
        question: 'How is an event identified?',
        options: [
          {
            name: 'Calendar id plus a counter',
            pros: [
              'Readable: `certs-001@learning-curve`',
              'The same id on every run while the content order holds',
              'Has the `@domain` form calendar apps expect from a `UID`',
            ],
            cons: ['Inserting a session renumbers later ids, so anything keyed by the old ids loses its target'],
          },
          {
            name: 'Hash of title and start',
            pros: ['Independent of queue order'],
            cons: [
              'Changes whenever the title or time changes, which is exactly when a calendar app should see the same event updated',
            ],
          },
          {
            name: 'A UUID stored in the content',
            pros: ['Never shifts, never collides'],
            cons: ['Every session in `content.ts` needs an id written by hand'],
          },
        ],
        chosen: 'Calendar id plus a counter',
        why: 'Reconstruction. The types state the requirement, "Stable id, reused as the ICS UID", but not why a counter was picked over the alternatives. The cost showed once viewer edits were stored by uid: the generator now lists the edits whose events no longer exist.',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'src/lib/plan/types.ts', at: '1370abc', note: 'line 15' },
          { kind: 'file', ref: 'packages/plan-data/scripts/build-plan.ts', note: 'lines 16-17' },
        ],
      },
      {
        question: 'How does the generator script run?',
        options: [
          {
            name: 'tsx',
            pros: ['Runs `.ts` directly', 'Extensionless and JSON imports work as they do in the app'],
            cons: ['One more dev dependency'],
          },
          {
            name: 'Compile with tsc, then run node',
            pros: ['No runtime loader'],
            cons: ['A build step and an output folder for a 20-line script', 'The tsconfig has `noEmit: true`'],
          },
          {
            name: 'Node type stripping',
            pros: ['No dependency at all'],
            cons: ['Node ESM needs explicit file extensions on relative imports, which the app code does not write'],
          },
        ],
        chosen: 'tsx',
        why: 'Reconstruction: the first commit has `"plan": "tsx scripts/build-plan.ts"` and no note. The script imports `../src/lib/plan/schedule` without an extension, as the app does, which plain Node ESM would reject.',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'package.json', at: '1370abc', note: 'line 13' },
          { kind: 'file', ref: 'scripts/build-plan.ts', at: '1370abc', note: 'lines 4-6' },
        ],
      },
    ],
    steps: [
      {
        title: 'Define the types first',
        detail:
          'Start with the shapes everything else agrees on. `Plan` is `meta` plus `calendars` plus `events`. A `PlanEvent` has a `uid`, a `calendar` id, wall-clock `start` and `end`, a `kind`, an `availability` (`free` becomes `TRANSP:TRANSPARENT` in iCalendar and stays out of the budget) and optional `allDay` and `rrule`. `QueueItem` is a session before it has a date. Today the types live in `@lc/plan-domain`, with fields for done marks and logged time and an `isPlan` guard for JSON read from disk.',
        files: [
          {
            path: 'src/lib/plan/types.ts',
            at: '1370abc',
            lines: [1, 55],
            note: 'Calendar, event, meta, plan and queue item.',
          },
          {
            path: 'packages/plan-domain/src/types.ts',
            lines: [16, 39],
            note: 'The event today, with skip, done, paced and actual.',
          },
        ],
        commit: '1370abc',
      },
      {
        title: 'Write the date helpers',
        detail:
          '`parseLocal` turns `YYYY-MM-DDTHH:MM` into milliseconds with `Date.UTC`, and `ymd`, `hm` and `toLocalString` read them back with the `getUTC*` methods. `startOfDay`, `weekday`, `mondayOf` and `addDays` are arithmetic on those numbers. `nowMinsk` reads the real clock: `Date.now()` plus three hours. The Russian day and month names and `plural()` in this file give way to `Intl` and plural messages in chapter 6.',
        files: [
          {
            path: 'src/lib/plan/dates.ts',
            at: '1370abc',
            lines: [1, 35],
            note: 'Parsing, reading back and the current Minsk time.',
          },
          {
            path: 'packages/plan-domain/src/dates.ts',
            lines: [1, 45],
            note: 'The same helpers today, without any display text.',
          },
        ],
      },
      {
        title: 'Write the content as queues',
        detail:
          'The calendars (id, name, colour, whether the calendar must be created before import) come first. Each course is then an exported `QueueItem[]`; helpers such as `d()` (course URL, module URL, goal, one per line) and `series()` (n numbered sessions on one topic) keep the lists short and enforce the description format CLAUDE.md asks for. Dates appear nowhere in this file: only order and length reach the scheduler.',
        files: [
          {
            path: 'src/lib/plan/content.ts',
            at: '1370abc',
            lines: [1, 32],
            note: 'Calendars, the description helper and the series helper.',
          },
          { path: 'packages/plan-domain/src/content.ts', lines: [6, 13], note: 'The calendar list today.' },
        ],
      },
      {
        title: 'Put the rules in one config object',
        detail:
          '`ScheduleConfig` names every knob: time zone, weekly budget, holidays, the certificate window and deadline, the day courses resume, the first buffer Saturday and the first gym day. `DEFAULT_CONFIG` holds the values. `buildPlan(config, generated)` takes both as parameters with defaults, so a test or another plan can pass its own.',
        files: [
          { path: 'src/lib/plan/schedule.ts', at: '1370abc', lines: [5, 32], note: 'The config type and its values.' },
        ],
      },
      {
        title: 'Generate events and their ids',
        detail:
          '`push()` turns a queue item into a `PlanEvent` and counts per calendar, so ids come out as `certs-001@learning-curve`, `certs-002@learning-curve` and so on. Defaults are applied here (`availability` falls back to `busy`) and `extra` adds `allDay` or `rrule`. Everything after this is loops that decide when to call `push`.',
        files: [
          {
            path: 'src/lib/plan/schedule.ts',
            at: '1370abc',
            lines: [37, 57],
            note: 'The event factory with its per-calendar counter.',
          },
          { path: 'packages/plan-domain/src/schedule.ts', lines: [39, 61], note: 'The same factory today.' },
        ],
      },
      {
        title: 'Fill the slots',
        detail:
          'Certificate sessions fill weekdays 12:00–14:00 in queue order; a 2-hour lab may not start at 13:00, so a later 1-hour session is pulled forward and the lab moves to the next day. If the queue does not fit before the end of the window, `buildPlan` throws instead of writing a broken plan. Courses then take the 11:00, 12:00 and Monday/Wednesday 13:00 slots until every queue is empty, Saturday buffers are added as `free` time, and the gym is one recurring event.',
        files: [
          {
            path: 'src/lib/plan/schedule.ts',
            at: '1370abc',
            lines: [59, 90],
            note: 'The certificate loop, the lab rule and the error when it does not fit.',
          },
          {
            path: 'src/lib/plan/schedule.ts',
            at: '1370abc',
            lines: [92, 115],
            note: 'Courses, Saturday buffers and the weekly gym rule.',
          },
        ],
      },
      {
        title: 'Check the weekly budget',
        detail:
          '`weeklyHours` groups busy, timed hours by Monday. It skips all-day items, recurring events and free time; the side panel in chapter 3 applies a similar filter, `countsToBudget`. The check stays outside `buildPlan`: the rules produce a plan, the check reports on it, and you decide what to change.',
        files: [
          {
            path: 'src/lib/plan/schedule.ts',
            at: '1370abc',
            lines: [136, 147],
            note: 'Hours per week, keyed by the Monday.',
          },
        ],
      },
      {
        title: 'Write the generator script',
        detail:
          'The script calls `buildPlan()`, writes `src/data/plan.json` with two-space indentation and a trailing newline so diffs stay small, prints a one-line summary and warns with `Weeks over budget:`. With `--ics` it also writes one `.ics` per calendar into the ignored `exports/` folder. Run it after every change to the content or the rules and commit the source and the JSON together.',
        files: [
          {
            path: 'scripts/build-plan.ts',
            at: '1370abc',
            lines: [1, 23],
            note: 'Generate, write, summarize, warn, optionally export.',
          },
          { path: 'package.json', at: '1370abc', lines: [13, 13], note: 'The `plan` script runs it with tsx.' },
        ],
        commands: ['npm run plan', 'npm run plan -- --ics'],
        commit: '1370abc',
      },
      {
        title: 'See where it lives now',
        detail:
          'Since chapter 10 the rules are in `@lc/plan-domain` (pure TypeScript, no Node) and the script in `@lc/plan-data`, which owns the files on disk. The script now also applies the viewer edits, names edits whose events are gone, and prints the next deadline. `writePlan` keeps the stored date when nothing else changed (`1adeacd`), so running the command on a new day leaves the tracked file alone.',
        files: [
          { path: 'packages/plan-data/scripts/build-plan.ts', lines: [1, 29], note: 'The generator today.' },
          { path: 'packages/plan-data/src/store.ts', lines: [136, 158], note: 'The date moves only with the content.' },
          { path: 'packages/plan-data/package.json', lines: [9, 14], note: 'The `plan` script of the package.' },
        ],
        commands: ['pnpm run plan', 'pnpm run plan --ics'],
        commit: '1adeacd',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run plan',
        'git status --short packages/plan-data/data',
        'pnpm run plan --ics',
        'ls packages/plan-data/exports',
      ],
      expect: [
        '`pnpm run plan` prints a summary line with `data/plan.json:`, the number of events and manual edits, and the last day of the plan.',
        'A `Weeks over budget:` warning appears only when some week holds more busy study hours than `meta.weeklyBudgetHours`.',
        'Run `pnpm run plan` a second time with no change to the content or the edits: `git status` shows the same as before it, because the date in `meta.generated` moves only with the content.',
        '`ls` lists one `.ics` per calendar that has events and a text file with import instructions.',
      ],
      quiz: [
        {
          question:
            "Why does `parseLocal` build the number with `Date.UTC(...)` instead of `new Date('2026-11-23T12:00')`?",
          options: [
            '`Date.UTC` is faster',
            'A date-time string without an offset is parsed in the local zone of the machine, so a server and a browser abroad would get different numbers',
            '`new Date` cannot parse that format',
            'Plan times are stored in UTC',
          ],
          answer: 1,
          explanation:
            "The stored strings are Minsk wall-clock times. Treating them as UTC-naive numbers keeps every machine on the same value; the display code then reads them with the `getUTC*` methods or `timeZone: 'UTC'`.",
        },
        {
          question:
            'You insert a session in the middle of a course queue and run `pnpm run plan`. What happens to the uids?',
          options: [
            'Nothing: uids are hashes of the title',
            'The new session gets a random uid',
            'The generator refuses to run',
            'Sessions after the insertion take the next counter value, so their uids shift by one',
          ],
          answer: 3,
          explanation:
            '`push()` numbers events per calendar in the order it places them. Anything keyed by the old uids (an earlier import, an edit in `edits.json`) now points at a different session or at none.',
        },
        {
          question: 'Which events does `weeklyHours` count toward the budget?',
          options: [
            'Every event in the plan',
            'Only events in the certificate calendar',
            'Busy, timed events without a repeat rule',
            "Events with `availability: 'free'`",
          ],
          answer: 2,
          explanation:
            'It skips `allDay`, `rrule` and `free` events: deadlines, the gym and the Saturday buffer are not study time.',
        },
      ],
    },
    pitfalls: [
      "`new Date('2026-11-23T12:00')` parses in the zone of the machine. CLAUDE.md bans it from the first commit; use `parseLocal` and the `getUTC*` readers.",
      'Stamping the run date into a tracked file: every `pnpm run plan` changed `meta.generated`, so `plan.json` showed a diff on any day the command ran. Fixed in `1adeacd`: the date moves only with the content.',
      'A typo in the content reaches every artifact. A calendar named "LLM Cource" went into `plan.json`, the exports and the guide for language models until `5e6756c` fixed `content.ts` and regenerated.',
      'Counter-based uids shift when a queue changes, and anything keyed by uid loses its target. The generator lists such orphaned edits so they can be removed.',
      'Importing `plan.json` into the bundle means every new plan needs a rebuild. `746a107` reads the file at runtime so saved edits show without one.',
      'Swallowing an impossible schedule: the certificate loop throws `Certificates do not fit before ...` instead of silently dropping sessions. Keep that error; it is the scheduler saying the rules cannot be met.',
    ],
    tradeoffs: [
      'A greedy fill is easy to follow and predictable but cannot balance load across weeks; that arrives much later as an integer program solved with HiGHS (`packages/plan-domain/src/rebalance/`).',
      'Committing generated JSON doubles the files to review, and in return gives a readable diff of every rule change and lets every reader work without running the generator.',
      'One fixed zone without DST keeps the date code to a few lines; a second zone needs explicit conversion (`zoneShift` in `dates.ts`).',
    ],
    links: [
      {
        label: 'MDN: Date.UTC()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC',
      },
      { label: 'tsx', href: 'https://github.com/privatenumber/tsx' },
      { label: 'RFC 5545: iCalendar (RRULE, UID)', href: 'https://www.rfc-editor.org/rfc/rfc5545' },
      { label: 'pnpm run: passing arguments', href: 'https://pnpm.io/cli/run' },
      { label: 'TypeScript: resolveJsonModule', href: 'https://www.typescriptlang.org/tsconfig/#resolveJsonModule' },
    ],
    next: 'With `plan.json` in place, chapter 3 draws it as a week grid and serves it as `.ics` files.',
  },
  {
    id: 'first-screen',
    summary:
      'You turn `plan.json` into the first screen (a week grid, an agenda list, a budget panel and a certificate runway) and into files a calendar app can import: one `.ics` per calendar, a zip of all of them, and later one combined calendar. It takes a handful of React components, two pure functions and three server routes.',
    whereWeAre:
      'The app renders a root document and `plan.json` exists. In `1370abc` all of this chapter is already present: `src/routes/index.tsx`, five components in `src/components`, `occurrences.ts` and `ics.ts` in `src/lib/plan`, and three routes under `src/routes/api`. `7b49692` adds the combined export two hours later.',
    problem:
      'A JSON file is not a schedule anyone can read, and stored events are not what a week shows: a recurring gym session must appear on every Tuesday and Thursday, an all-day deadline on its day. The plan must also leave the app, and Google Calendar and Outlook read iCalendar, not this JSON.',
    outcomes: [
      'Expand stored events into concrete occurrences for a date range, including weekly repeats and all-day items.',
      'Keep view state (week, view) in typed URL search params with `validateSearch`.',
      'Render anything that depends on the current time or `localStorage` without a hydration mismatch.',
      'Write a valid RFC 5545 file: `VCALENDAR`, `VTIMEZONE`, `VEVENT` with `UID`, `DTSTART`, `RRULE` and `TRANSP`, CRLF line ends and folding at 75 octets.',
      'Serve files from server routes with the right `Content-Type` and `Content-Disposition`, and zip several of them in the browser or on the server.',
    ],
    concepts: [
      {
        term: 'SSR and hydration',
        explanation:
          'The server renders the page to HTML, then React in the browser hydrates it: it renders the same tree again and attaches handlers to the existing markup. The two renders must produce the same output. Anything that differs between server and browser (the current minute, `localStorage`) is read in an effect after hydration, so the first client render matches the server.',
        link: { label: 'React: hydrateRoot', href: 'https://react.dev/reference/react-dom/client/hydrateRoot' },
      },
      {
        term: 'Search params as state',
        explanation:
          'A route can declare `validateSearch`, which turns the raw query into a typed object. The page reads it with `Route.useSearch()` and changes it with `navigate({ search: (prev) => ({ ...prev, week }) })`. Here `?week=YYYY-MM-DD&view=week|list` is the whole view state, so a week can be linked, reloaded and reached with the back button.',
        link: {
          label: 'TanStack Router: search params',
          href: 'https://tanstack.com/router/latest/docs/framework/react/guide/search-params',
        },
      },
      {
        term: 'Occurrences',
        explanation:
          'Stored events are rules; a screen needs instances. `occurrences(plan, from, to, hidden)` expands each event into concrete intervals that overlap a range, with `s` and `e` in wall-clock milliseconds: one per matching weekday for a repeat, one per day for an all-day item. Components render occurrences and never look at `rrule` again.',
      },
      {
        term: 'Positioning on a time grid',
        explanation:
          'The week grid is seven relatively positioned columns. An event is an absolutely positioned button: `top` is hours since the first visible hour times a fixed pixel height per hour, `height` is its duration times the same number. No layout library, no measuring.',
      },
      {
        term: 'iCalendar (RFC 5545)',
        explanation:
          'A `.ics` file is text: a `VCALENDAR` with a `VTIMEZONE` and one `VEVENT` per event. `UID` identifies the event across imports, `DTSTART;TZID=...` and `DTEND` give local times in the declared zone, `VALUE=DATE` marks all-day items, `RRULE` repeats and `TRANSP` says whether the event blocks time. Lines end with CRLF and lines over 75 octets are folded with CRLF plus a space.',
        link: { label: 'RFC 5545', href: 'https://www.rfc-editor.org/rfc/rfc5545' },
      },
      {
        term: 'Serving a file from a server route',
        explanation:
          "A handler returns `new Response(body, { headers })`. `Content-Type: text/calendar; charset=utf-8` lets a calendar app read it; `Content-Disposition: attachment; filename*=UTF-8''<encoded>` makes the browser save it under a name that may contain Cyrillic letters.",
        link: {
          label: 'MDN: Content-Disposition',
          href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition',
        },
      },
      {
        term: 'Zip files with JSZip',
        explanation:
          'JSZip builds a zip in memory: `zip.file(name, text)` per entry, then `generateAsync({ type })` gives a `Blob` in the browser or an `ArrayBuffer` on the server. The export dialog loads it with a dynamic `import()` only when the button is pressed, so it is not part of the first page load.',
        link: { label: 'JSZip', href: 'https://stuk.github.io/jszip/' },
      },
      {
        term: 'Native dialogs',
        explanation:
          'The event and export dialogs are `<dialog>` elements opened with `showModal()`, which gives a backdrop, focus trapping and closing on Escape from the browser. A small `Modal` component syncs the `open` prop to `showModal()` and `close()` in an effect.',
        link: {
          label: 'MDN: <dialog>',
          href: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog',
        },
      },
    ],
    decisions: [
      {
        question: 'How does the page get the plan?',
        options: [
          {
            name: 'Import the JSON into the bundle',
            pros: ['No request: available during SSR and in the browser', 'Typed through `resolveJsonModule`'],
            cons: ['A new plan needs a rebuild and a redeploy', 'The whole plan ships in the client bundle'],
          },
          {
            name: 'Read the file on the server in a route loader',
            pros: ['Changes show on the next request'],
            cons: ['Needs a loader backed by a server function, which the first version did not have'],
          },
          {
            name: 'Fetch `/api/plan` from the browser',
            pros: ['The same endpoint other clients use'],
            cons: ['A loading state on every visit and no plan in the server HTML'],
          },
        ],
        chosen: 'Import the JSON into the bundle',
        why: 'Reconstruction for the first version: `index.tsx` imports `#/data/plan.json` and casts it to `Plan`, with no note. The limit is recorded when it was replaced: `746a107` reads the plan from disk at runtime "so saved edits show up without a rebuild".',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'src/routes/index.tsx', at: '1370abc', note: 'lines 3 and 21' },
          { kind: 'commit', ref: '746a107' },
        ],
      },
      {
        question: 'Where does view state live?',
        options: [
          {
            name: 'URL search params',
            pros: [
              'A week can be linked and survives a reload',
              'Back and forward move between weeks',
              'Typed through `validateSearch`',
            ],
            cons: ['Every value needs parsing and validation'],
          },
          {
            name: 'React state',
            pros: ['Simplest'],
            cons: ['Lost on reload and not shareable'],
          },
          {
            name: 'localStorage',
            pros: ['Survives a reload'],
            cons: ['Not shareable; unreadable during SSR, so the first HTML shows the wrong week'],
          },
        ],
        chosen: 'URL search params',
        why: 'Reconstruction: `index.tsx` validates `week` and `view`, and the README documents `?week=YYYY-MM-DD&view=week|list` as the address of the viewer, without stating why. Hidden calendars go the other way, into `localStorage`, "remembered per browser": a personal filter, not part of an address.',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'src/routes/index.tsx', at: '1370abc', note: 'lines 14-29' },
          { kind: 'file', ref: 'src/lib/client.ts', at: '1370abc', note: 'line 17' },
          { kind: 'file', ref: 'README.md', at: '1370abc', note: 'line 75' },
        ],
      },
      {
        question: 'How does the plan get into a calendar app?',
        options: [
          {
            name: 'iCalendar files and a subscription URL',
            pros: [
              'Google Calendar, Outlook and Apple Calendar all read it, with no account linking',
              'A subscribed URL picks up every deploy',
            ],
            cons: [
              'An import is a snapshot: importing again duplicates events',
              'Subscriptions are read-only and refreshed on the provider schedule',
            ],
          },
          {
            name: 'Provider APIs with OAuth',
            pros: ['Writes straight into the calendar of the user; two-way sync is possible'],
            cons: ['One adapter and one sign-in flow per provider', 'A public deployment needs an app login first'],
          },
          {
            name: 'Only a JSON download',
            pros: ['Nothing to build'],
            cons: ['No calendar app reads it'],
          },
        ],
        chosen: 'iCalendar files and a subscription URL',
        why: 'The first README documents both paths: import the files ("Delete old future events from existing calendars, otherwise you get duplicates."), or, once deployed, add `/api/ics/:calendarId` "as a subscription" so the calendar "updates itself after each deploy, with no re-import and no duplicates". The later research doc keeps that order: the open standard first, OAuth only when refresh lag becomes a real problem.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'README.md', at: '1370abc', note: 'lines 39-59' },
          { kind: 'file', ref: 'docs/calendar-integration-research.md', note: 'section 1, lines 13-31' },
        ],
      },
      {
        question: 'Write iCalendar by hand, or use a library?',
        options: [
          {
            name: 'A small writer in the plan code',
            pros: [
              'About 70 lines, no dependency, runs in the browser and on the server',
              'Full control over `UID`, `TRANSP`, `VTIMEZONE` and folding',
            ],
            cons: ['Every rule of RFC 5545 that matters must be known and tested by you'],
          },
          {
            name: 'An iCalendar library',
            pros: ['Escaping, folding and time zones handled'],
            cons: ['A dependency in domain code', 'Still needs a mapping from `PlanEvent`'],
          },
        ],
        chosen: 'A small writer in the plan code',
        why: 'Reconstruction: `ics.ts` cites RFC 5545 section 3.1 for folding and builds the lines by hand; no reason for skipping a library is written. A library (`ical.js`) arrives much later in `@lc/plan-data`, to read the calendar a person subscribes to, not to write the plan.',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'src/lib/plan/ics.ts', at: '1370abc', note: 'line 6' },
          { kind: 'file', ref: 'packages/plan-data/package.json', note: 'line 20' },
        ],
      },
    ],
    steps: [
      {
        title: 'Make the week part of the URL',
        detail:
          '`validateSearch` receives the raw query object and returns a typed `Search`: `week` only if it matches `YYYY-MM-DD`, `view` only if it is `week` or `list`, otherwise `undefined`. The page reads it with `Route.useSearch()` and changes it with `navigate({ search })`, so the arrows, Today and the view switch are all URL changes. Without a `week` the page opens on the Monday of today, or of the plan start if the plan has not started yet.',
        files: [
          {
            path: 'src/routes/index.tsx',
            at: '1370abc',
            lines: [14, 35],
            note: 'The search type, its validation and the default week.',
          },
          {
            path: 'src/routes/index.tsx',
            at: '1370abc',
            lines: [48, 56],
            note: 'The week from the URL and the occurrences for it.',
          },
        ],
        commit: '1370abc',
      },
      {
        title: 'Expand events into occurrences',
        detail:
          'For a weekly `RRULE` the function reads the `BYDAY` days (all the plan uses) and emits one copy per matching day in the range at the same time of day; an all-day event covers its day; any other event passes through if it overlaps. The result is sorted by start. Two helpers sit next to it: `durationHours` and `countsToBudget` (busy, timed, not in the personal calendar). Today the same function also honours skipped repeats.',
        files: [
          {
            path: 'src/lib/plan/occurrences.ts',
            at: '1370abc',
            lines: [4, 42],
            note: 'Expansion of repeats and all-day items, and the budget helpers.',
          },
          {
            path: 'packages/plan-domain/src/occurrences.ts',
            lines: [11, 34],
            note: 'The same expansion today, with `skip`.',
          },
        ],
      },
      {
        title: 'Draw the week grid',
        detail:
          'The visible hours start at 08:00 and end at 15:00, widened to fit the earliest and latest event of the week. Each hour is 56 px, so an event is a button with `top` from its start and `height` from its duration (at least 22 px). The calendar colour goes in as the CSS variable `--c`, and a line marks the current time once `now` is known. The widget today also takes a day count, a time scale, drag callbacks and a draft slot.',
        files: [
          {
            path: 'src/components/WeekGrid.tsx',
            at: '1370abc',
            lines: [13, 31],
            note: 'Visible hours, pixels per hour and the seven days.',
          },
          {
            path: 'src/components/WeekGrid.tsx',
            at: '1370abc',
            lines: [70, 101],
            note: 'Hour lines, event buttons and the now line.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [34, 74],
            note: 'The props of the widget today.',
          },
        ],
      },
      {
        title: 'List the whole plan',
        detail:
          'The list view groups occurrences under a heading per day and scrolls to the first day on or after today once mounted. Every row is a button, so the keyboard reaches every event; free time gets its own style.',
        files: [
          {
            path: 'src/components/AgendaList.tsx',
            at: '1370abc',
            lines: [13, 57],
            note: 'Day headings, the scroll anchor and the rows.',
          },
        ],
      },
      {
        title: 'Sum the week against the budget',
        detail:
          'The side panel adds up `durationHours` of the occurrences that `countsToBudget`. The meter has one segment per calendar, scaled to the larger of budget and total, gets the over-budget style past the budget, and has `role="img"` with an `aria-label` that reads the numbers.',
        files: [
          {
            path: 'src/components/BudgetPanel.tsx',
            at: '1370abc',
            lines: [10, 34],
            note: 'Totals per calendar and the meter.',
          },
          {
            path: 'modules/planner/src/widgets/budget-panel/ui/BudgetPanel.tsx',
            lines: [17, 53],
            note: 'The same sums today, with localized text.',
          },
        ],
      },
      {
        title: 'Show the countdown to the deadline',
        detail:
          'The runway is a strip from the first certificate session to the deadline, with a segment per certificate and a numbered marker per challenge lab. Every position is a percentage of the time span, so nothing is measured.',
        files: [
          {
            path: 'src/components/Runway.tsx',
            at: '1370abc',
            lines: [17, 37],
            note: 'The span, the position function and the groups.',
          },
        ],
      },
      {
        title: 'Keep the clock and storage out of the server render',
        detail:
          'During SSR there is no meaningful client clock and no `localStorage`. `useNow` returns `null` on the server and during hydration, then sets the Minsk time in an effect and refreshes it every minute; components draw the now line and the countdown only when it is not `null`. `useHiddenCalendars` reads `localStorage` in an effect for the same reason. React calls this two-pass rendering.',
        files: [
          {
            path: 'src/lib/client.ts',
            at: '1370abc',
            lines: [4, 43],
            note: 'The clock hook and the remembered calendar filter.',
          },
          { path: 'modules/planner/src/shared/lib/use-now.ts', lines: [4, 13], note: 'The same hook today.' },
        ],
      },
      {
        title: 'Write the iCalendar file',
        detail:
          '`buildICS` writes one `VCALENDAR` per target calendar. A fixed `VTIMEZONE` for Europe/Minsk (+03:00, no DST) lets every start be `DTSTART;TZID=Europe/Minsk:20261123T120000`; all-day events use `VALUE=DATE` with an exclusive end, `RRULE` is copied, and `TRANSP` is `TRANSPARENT` for free time. Backslashes, semicolons, commas and newlines are escaped, lines end with CRLF, and lines over 75 octets are folded, counted in UTF-8 bytes because a Cyrillic letter takes two.',
        files: [
          {
            path: 'src/lib/plan/ics.ts',
            at: '1370abc',
            lines: [3, 73],
            note: 'Escaping, folding, the time zone block and the events.',
          },
          {
            path: 'packages/plan-domain/src/ics.ts',
            lines: [75, 137],
            note: 'The writer today, with alarms, versions and skipped repeats.',
          },
        ],
      },
      {
        title: 'Serve and download the files',
        detail:
          '`GET /api/ics/:calendarId` accepts `certs` or `certs.ics`, answers 404 with the known ids for anything else, and returns `text/calendar; charset=utf-8`; `?download=1` adds `Content-Disposition` with `filename*` so a Cyrillic name survives. `/api/ics-zip` zips every calendar with events on the server. The export dialog builds the same zip in the browser and imports JSZip only when the button is pressed.',
        files: [
          {
            path: 'src/routes/api/ics.$calendarId.ts',
            at: '1370abc',
            lines: [8, 32],
            note: 'One calendar as a feed or an attachment.',
          },
          { path: 'src/routes/api/ics-zip.ts', at: '1370abc', lines: [9, 28], note: 'All calendars in one archive.' },
          {
            path: 'src/components/Dialogs.tsx',
            at: '1370abc',
            lines: [92, 101],
            note: 'The client-side zip with a lazy JSZip import.',
          },
        ],
      },
      {
        title: 'Add one combined calendar',
        detail:
          '`7b49692` adds a second export mode: one `.ics` with the events of every chosen calendar, for importing into a single calendar. `calendarICS` and `combinedICS` wrap `buildICS`, `combinedCalendar` is a stand-in calendar named after the plan, and `GET /api/ics/all?calendars=a,b` serves the same file. Today the dialog lives in the `calendar-export` module and the feed also sends an `ETag`.',
        files: [
          {
            path: 'src/lib/plan/ics.ts',
            at: '7b49692',
            lines: [76, 98],
            note: 'One calendar, the stand-in, and the combined file.',
          },
          {
            path: 'src/routes/api/ics.$calendarId.ts',
            at: '7b49692',
            lines: [15, 28],
            note: '`all` and the `calendars` filter.',
          },
          {
            path: 'modules/calendar-export/src/features/export-calendars/ui/ExportDialog.tsx',
            lines: [99, 108],
            note: 'The combined download in the dialog today.',
          },
        ],
        commit: '7b49692',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run dev',
        'curl -i http://localhost:3000/api/ics/certs',
        'curl -s "http://localhost:3000/api/ics/all?calendars=certs,hfllm" | grep -c BEGIN:VEVENT',
        'curl -s -o plan.zip http://localhost:3000/api/ics-zip && unzip -l plan.zip',
        'pnpm run stand',
      ],
      expect: [
        'http://localhost:3000/ru?view=week shows the week grid with the budget panel beside it; `?view=list` shows the agenda.',
        'The first curl answers `200` with `Content-Type: text/calendar; charset=utf-8` and an `ETag` header; the body starts with `BEGIN:VCALENDAR` and ends with `END:VCALENDAR`.',
        'The combined feed counts the events of both calendars in one file.',
        '`unzip -l` lists one `.ics` per calendar with events and a text file with import instructions.',
        'The stand on http://localhost:6006 shows the WeekGrid, AgendaList, BudgetPanel and Runway widgets under Planner/Widgets.',
      ],
      quiz: [
        {
          question: 'Why does `useNow` return `null` on the server?',
          options: [
            'The server has no clock',
            '`Date.now()` throws during SSR',
            'So the server HTML and the first browser render match; the time-dependent parts appear after hydration',
            'To save CPU on the server',
          ],
          answer: 2,
          explanation:
            'Hydration expects identical output. The current minute differs between server and browser, so it is set in an effect, which runs only in the browser after hydration.',
        },
        {
          question:
            'A Russian title of 50 characters is written to an `.ics` file. Why may its line still need folding?',
          options: [
            'RFC 5545 limits lines to 75 octets, and a Cyrillic letter takes two bytes in UTF-8',
            'Folding is by characters, and 50 is under 75',
            'Every SUMMARY line is folded',
            'Google Calendar folds at 50 characters',
          ],
          answer: 0,
          explanation:
            'The limit is in octets. `fold()` measures with `TextEncoder` and iterates by code point, so it never splits a letter in two.',
        },
        {
          question: 'Which property tells a calendar app that the Saturday buffer does not block time?',
          options: ['`STATUS:TENTATIVE`', '`CLASS:PRIVATE`', '`X-WR-CALNAME`', '`TRANSP:TRANSPARENT`'],
          answer: 3,
          explanation:
            "`TRANSP` controls free/busy: `OPAQUE` blocks the slot, `TRANSPARENT` does not. Events with `availability: 'free'` are written as `TRANSPARENT`.",
        },
      ],
    },
    pitfalls: [
      'Rendering `Date.now()` or reading `localStorage` during render makes the server HTML differ from the first browser render. Read them in an effect, as `useNow` and `useHiddenCalendars` do; the lint rule `react/set-state-in-effect` is switched off in `.oxlintrc.json` with exactly that reason.',
      '`DTSTAMP` set to the time of the request makes two exports of the same plan differ, so a subscribed client cannot tell whether anything changed. `8958caa` adds `SEQUENCE` and `LAST-MODIFIED` per event and a weak `ETag` that ignores `DTSTAMP`, answering `304` while nothing changed.',
      'Importing the same `.ics` again duplicates events; the first README tells you to delete old future events before a second import. A subscription URL avoids the problem.',
      'Folding by characters instead of bytes breaks RFC 5545 for Cyrillic text. Count UTF-8 octets and never split a character.',
      'A Cyrillic file name in a plain `filename="..."` parameter is mangled by some clients. Use `filename*=UTF-8\'\'` with `encodeURIComponent`, as the `ics` route does.',
    ],
    tradeoffs: [
      'Expanding repeats in a small function supports only weekly `BYDAY` rules. That is all the plan uses; anything richer needs a full RRULE engine.',
      'Absolute positioning by hour is simple and fast, but overlapping events cover each other until a lane layout is added (`layoutLanes` in `occurrences.ts`).',
      'A zip built in the browser saves a request and works for a plan opened from a file; the server route gives a stable URL. The app keeps both.',
      'A subscription keeps a calendar current without imports, but it is read-only and refreshed on the provider schedule; the first README notes that Google refreshes every few hours.',
    ],
    links: [
      {
        label: 'TanStack Router: search params',
        href: 'https://tanstack.com/router/latest/docs/framework/react/guide/search-params',
      },
      {
        label: 'TanStack Start: server routes',
        href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-routes',
      },
      {
        label: 'React: hydrateRoot and two-pass rendering',
        href: 'https://react.dev/reference/react-dom/client/hydrateRoot',
      },
      { label: 'RFC 5545: iCalendar', href: 'https://www.rfc-editor.org/rfc/rfc5545' },
      { label: 'RFC 7986: new iCalendar properties', href: 'https://www.rfc-editor.org/rfc/rfc7986' },
      {
        label: 'MDN: Content-Disposition',
        href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition',
      },
      { label: 'JSZip', href: 'https://stuk.github.io/jszip/' },
      { label: 'MDN: <dialog>', href: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog' },
    ],
    next: 'The app works, but nothing stops a bad commit message, a cast or an unformatted file; chapter 4 adds the checks.',
  },
  {
    id: 'guardrails',
    summary:
      'You add the checks every later commit passes: commitlint in a Husky `commit-msg` hook, Oxlint with type-aware rules, Oxfmt for formatting, and TypeScript flags stricter than `strict`. Then you fix what they find by narrowing types instead of casting, and collect it all under `pnpm run check`.',
    whereWeAre:
      'The viewer, the generator and the export work. The interface has just moved to Tailwind and three languages (`4c636c0`, chapters 5 and 6). There is no linter and no formatter, nothing checks commit messages, and `tsc --noEmit` runs with `strict` only.',
    problem:
      'The first commit shows what slips through: `planData as Plan` trusts a JSON file, `llm.shift()!` asserts that a value exists, a style object is cast `as React.CSSProperties`, a click handler is a comma expression, and formatting depends on who typed. TypeScript 7 also rules out the usual answer, ESLint with typescript-eslint, which needs the compiler API that TypeScript 7 does not have.',
    outcomes: [
      'Reject commit messages that do not follow Conventional Commits before the commit exists.',
      'Configure Oxlint with categories, plugins, explicit type-aware rules and per-folder overrides.',
      'Format code and sort imports and Tailwind classes with Oxfmt, and exclude files that read better by hand.',
      'Turn on `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` and fix the findings without `as`, `!` or suppressions.',
      'Write a lint suppression that states its reason.',
    ],
    concepts: [
      {
        term: 'Conventional Commits',
        explanation:
          'A message format: `<type>[optional scope]: <description>`, for example `fix(planner): keep the toolbar inside a phone screen`. `feat` adds a feature, `fix` repairs a bug, and `build`, `docs`, `style`, `refactor`, `test` and `ci` describe other work. Every non-merge commit in this repository from `745c75f` on uses it.',
        link: { label: 'Conventional Commits 1.0.0', href: 'https://www.conventionalcommits.org/en/v1.0.0/' },
      },
      {
        term: 'Git hooks with Husky',
        explanation:
          'Git runs scripts at fixed moments; `commit-msg` runs after you write the message and can reject the commit. Husky keeps hook scripts in the versioned `.husky/` folder and installs them through the `prepare` script, which pnpm runs after every install. Here `.husky/commit-msg` is one line that runs commitlint on the message file.',
        link: { label: 'Husky: get started', href: 'https://typicode.github.io/husky/get-started.html' },
      },
      {
        term: 'commitlint',
        explanation:
          'commitlint parses a message and checks it against rules. `@commitlint/config-conventional` is the Conventional Commits rule set: a known type, a non-empty subject, and so on. `--edit "$1"` reads the message from the file git passes to the hook.',
        link: { label: 'commitlint: getting started', href: 'https://commitlint.js.org/guides/getting-started.html' },
      },
      {
        term: 'Oxlint',
        explanation:
          'A linter written in Rust with ESLint-compatible rule names. `.oxlintrc.json` turns on plugins (`eslint`, `typescript`, `react`, `jsx-a11y`, `import`, `unicorn`, `promise`, `oxc`), sets whole categories (`correctness` and `suspicious` as errors, `perf` as warnings), lists single rules, and narrows rules per folder with `overrides`. `jsPlugins` loads ESLint-style plugins written in JavaScript, such as the Paraglide rule.',
        link: { label: 'Oxlint', href: 'https://oxc.rs/docs/guide/usage/linter.html' },
      },
      {
        term: 'Type-aware linting on TypeScript 7',
        explanation:
          'Some rules need types: `no-floating-promises` must know that an expression is a promise. Oxlint runs them through `oxlint-tsgolint`, which uses the Go implementation of TypeScript 7, so they work where typescript-eslint cannot. It is switched on with `options.typeAware: true` in the root config.',
        link: { label: 'Oxlint: type-aware linting', href: 'https://oxc.rs/docs/guide/usage/linter/type-aware.html' },
      },
      {
        term: 'Oxfmt',
        explanation:
          'A Prettier-compatible formatter from the same project, with import sorting and Tailwind class sorting built in. `.oxfmtrc.json` sets the style (120 columns, no semicolons, single quotes), turns both sorts on, points the Tailwind sort at the stylesheet that defines the theme, and lists files to leave alone.',
        link: { label: 'Oxfmt', href: 'https://oxc.rs/docs/guide/usage/formatter.html' },
      },
      {
        term: 'Strict flags beyond `strict`',
        explanation:
          '`noUncheckedIndexedAccess` adds `undefined` to every index read, so `queue[0]` is `QueueItem | undefined`. `exactOptionalPropertyTypes` separates a missing property from one set to `undefined`: `name?: T` no longer accepts `undefined`, and a prop that callers may pass `undefined` to is written `name?: T | undefined`. Both live in `tsconfig.base.json`, which every project extends.',
        link: {
          label: 'TSConfig: exactOptionalPropertyTypes',
          href: 'https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes',
        },
      },
      {
        term: 'Narrowing instead of asserting',
        explanation:
          'A cast or a `!` tells the compiler to trust you; narrowing makes it check. A type predicate (`isPlan(value): value is Plan`), an early `if (!next) break`, destructuring with a default (`const [one] = ...`) or `.at()` all leave the compiler proving that the value exists, so the code stays correct when it changes.',
        link: { label: 'TypeScript: narrowing', href: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html' },
      },
    ],
    decisions: [
      {
        question: 'Which linter?',
        options: [
          {
            name: 'Oxlint with type-aware rules',
            pros: [
              'Type-aware rules run on TypeScript 7 through `oxlint-tsgolint`',
              'One config for core, TypeScript, React, accessibility, import, unicorn and promise rules',
              'Loads ESLint-style JS plugins, so the Paraglide rule works',
            ],
            cons: [
              'Some ESLint plugins have no equivalent',
              'Type-aware rules need the separate `oxlint-tsgolint` package',
            ],
          },
          {
            name: 'ESLint with typescript-eslint',
            pros: ['The largest rule and plugin ecosystem'],
            cons: ['typescript-eslint does not support TypeScript 7'],
          },
          {
            name: 'No linter, only `tsc`',
            pros: ['Nothing to configure'],
            cons: ['Floating promises, `any` leaks and hook mistakes all pass the compiler'],
          },
        ],
        chosen: 'Oxlint with type-aware rules',
        why: '`6aca64f`: "Oxlint runs type-aware on the TypeScript 7 compiler, which typescript-eslint does not support yet." The same config also runs the Paraglide message rule.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '6aca64f' },
          { kind: 'file', ref: 'CLAUDE.md', note: 'line 15' },
          { kind: 'doc', ref: 'https://oxc.rs/docs/guide/usage/linter/type-aware.html' },
        ],
      },
      {
        question: 'Which formatter?',
        options: [
          {
            name: 'Oxfmt',
            pros: ['Prettier-compatible output', 'Sorts imports and Tailwind classes with no plugins'],
            cons: ['Newer than Prettier; options and plugins differ'],
          },
          {
            name: 'Prettier with plugins',
            pros: ['The reference formatter'],
            cons: ['Import and Tailwind sorting need separate plugins'],
          },
          {
            name: 'No formatter',
            pros: ['Nothing to install'],
            cons: ['Style differences show up in every diff'],
          },
        ],
        chosen: 'Oxfmt',
        why: '`6aca64f`: "Oxfmt also orders imports and Tailwind classes." `eb92d24` formats the codebase in one commit and excludes `content.ts` because "its hand-aligned course tables read better than the formatter\'s output".',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '6aca64f' },
          { kind: 'commit', ref: 'eb92d24' },
        ],
      },
      {
        question: 'How are commit messages checked?',
        options: [
          {
            name: 'commitlint in a Husky commit-msg hook',
            pros: ['Fails before the commit exists', 'The same rule for people and agents'],
            cons: ['`--no-verify` skips it', 'Installed by `prepare`, so a fresh clone needs `pnpm install` first'],
          },
          {
            name: 'Check in CI only',
            pros: ['Cannot be skipped'],
            cons: ['A bad message is found after it is pushed and must be rewritten'],
          },
          {
            name: 'Convention by agreement',
            pros: ['No tooling'],
            cons: ['Drifts'],
          },
        ],
        chosen: 'commitlint in a Husky commit-msg hook',
        why: 'Reconstruction: `745c75f` says what it does ("Commit messages are checked against the Conventional Commits rules from @commitlint/config-conventional") but not why a local hook. Every non-merge commit after it follows the format.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '745c75f' },
          { kind: 'file', ref: '.husky/commit-msg' },
          { kind: 'doc', ref: 'https://commitlint.js.org/guides/local-setup.html' },
        ],
      },
      {
        question: 'How do you fix what the strict checks report?',
        options: [
          {
            name: 'Narrow: guards, early returns, destructuring, `.at()`',
            pros: [
              'The compiler proves the value exists, so the fix stays correct as code changes',
              'No suppressions to audit',
            ],
            cons: ['More lines than a cast', 'Sometimes needs a small restructure'],
          },
          {
            name: 'Cast or assert with `as` and `!`',
            pros: ['A one-token fix'],
            cons: [
              'Switches off exactly the check that was just turned on',
              'A wrong assumption becomes a runtime crash',
            ],
          },
          {
            name: 'Suppress line by line',
            pros: ['Fast'],
            cons: ['Hides the finding and accumulates'],
          },
        ],
        chosen: 'Narrow: guards, early returns, destructuring, `.at()`',
        why: 'Reconstruction of the reason; the method is recorded. `a372236` turns the flags on and fixes the findings "by narrowing: no casts, assertions or suppressions were added", and `e482350` does the same for about 110 lint rules, with four exempt lines that carry a reason. CLAUDE.md turns it into a rule: no `any`, no `as`, no `!`.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: 'a372236' },
          { kind: 'commit', ref: 'e482350' },
          { kind: 'file', ref: 'CLAUDE.md', note: 'line 14' },
        ],
      },
    ],
    steps: [
      {
        title: 'Check commit messages',
        detail:
          'Install `@commitlint/cli`, `@commitlint/config-conventional` and `husky`. `commitlint.config.js` extends the conventional preset; `.husky/commit-msg` runs `pnpm exec commitlint --edit "$1"`, where `$1` is the file git wrote the message to; the `prepare` script runs `husky` after every install, which installs the hooks.',
        files: [
          { path: 'commitlint.config.js', lines: [1, 1], note: 'The preset.' },
          { path: '.husky/commit-msg', lines: [1, 1], note: 'The hook.' },
          {
            path: 'package.json',
            at: '745c75f',
            lines: [8, 16],
            note: 'The `prepare` script that installs the hooks.',
          },
        ],
        commands: ['pnpm install'],
        commit: '745c75f',
      },
      {
        title: 'Add Oxlint and Oxfmt',
        detail:
          'The lint config enables eight plugins, makes `correctness` and `suspicious` errors and `perf` warnings, turns on `typeAware` (which needs `oxlint-tsgolint`), and loads the Paraglide rule as a JS plugin. Four rules are switched off, three of them with a comment that says why. The format config keeps the style the code already had and ignores generated files. A `check` script chains typecheck, lint, format check and translation check.',
        files: [
          {
            path: '.oxlintrc.json',
            at: '6aca64f',
            lines: [1, 26],
            note: 'Plugins, categories, type-aware mode and the first exceptions.',
          },
          { path: '.oxfmtrc.json', at: '6aca64f', lines: [1, 9], note: 'Style, sorting and ignores.' },
          { path: 'package.json', at: '6aca64f', lines: [16, 21], note: 'The lint, format and check scripts.' },
        ],
        commands: ['pnpm run lint', 'pnpm run fmt:check'],
        commit: '6aca64f',
      },
      {
        title: 'Fix the first findings',
        detail:
          'The bundled plan was trusted with `as Plan`; now `isPlan(value): value is Plan` checks the shape and `load()` throws a message that says how to fix it (`pnpm run plan`). The calendar colour style lost its cast by declaring `--c` on React `CSSProperties` through module augmentation. tsconfig moves to ES2023 for `toSorted`.',
        files: [
          { path: 'src/lib/plan/bundled.ts', at: 'cf3a240', lines: [1, 23], note: 'A type guard in place of a cast.' },
          {
            path: 'src/components/ui.tsx',
            at: 'cf3a240',
            lines: [1, 10],
            note: 'A typed custom property in place of a cast.',
          },
        ],
        commit: 'cf3a240',
      },
      {
        title: 'Format once, with exceptions',
        detail:
          'Run `pnpm run fmt` and commit the result on its own, so the formatting diff does not hide real changes. `content.ts` joins the ignore list because its course tables are aligned by hand; generated files (`plan.json`, `routeTree.gen.ts`) and the message files are ignored too.',
        files: [
          { path: '.oxfmtrc.json', at: 'eb92d24', lines: [1, 17], note: 'The ignore list after the first full run.' },
        ],
        commands: ['pnpm run fmt'],
        commit: 'eb92d24',
      },
      {
        title: 'Make strict mean strict',
        detail:
          '`a372236` adds `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `isolatedModules` and `erasableSyntaxOnly` to the base config. In the scheduler `certQueue[0]` is now possibly `undefined`, so the loop reads `const next = certQueue[0]; if (!next) break` instead of a length check the compiler cannot connect. Optional props that callers may pass `undefined` to are written `name?: T | undefined`.',
        files: [
          { path: 'tsconfig.base.json', lines: [13, 27], note: 'The strict flags every project inherits.' },
          {
            path: 'packages/plan-domain/src/schedule.ts',
            lines: [63, 83],
            note: 'An index read narrowed with an early break.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [50, 53],
            note: 'Optional callbacks that accept `undefined` explicitly.',
          },
        ],
        commands: ['pnpm run typecheck'],
        commit: 'a372236',
      },
      {
        title: 'Lint with the strict type-aware set',
        detail:
          '`e482350` makes about 110 rules errors: no `any`, no non-null assertion, no unsafe values, no floating or misused promises, exhaustive `switch`, no dynamic `delete`, plus plain JavaScript, React, import, unicorn and promise rules. `llm.shift()!` becomes `const llmItem = llm.shift()` followed by `if (llmItem)`, comma sequences in handlers become blocks, and a promise started on purpose is written `void work()`.',
        files: [
          { path: '.oxlintrc.json', lines: [24, 72], note: 'The TypeScript rules, each an error.' },
          {
            path: 'packages/plan-domain/src/schedule.ts',
            lines: [105, 116],
            note: 'The course loop without non-null assertions.',
          },
          { path: 'CLAUDE.md', lines: [14, 14], note: 'The rule as written for every contributor.' },
        ],
        commands: ['pnpm run lint'],
        commit: 'e482350',
      },
      {
        title: 'Give every exception a reason',
        detail:
          'A suppression names the rule and, after `--`, why the line is right: `oxlint-disable-next-line jsx-a11y/no-autofocus -- the palette is opened to type`. `23dd1e1` moved the five reasons that sat on a separate line into this form. Rules switched off for the whole repository carry a comment in the config, such as `oxc/no-map-spread`: its fix is mutation, and plans are copied on purpose.',
        files: [
          {
            path: 'modules/planner/src/features/command-palette/ui/CommandPalette.tsx',
            lines: [125, 126],
            note: 'A suppression with its reason.',
          },
          { path: '.oxlintrc.json', lines: [14, 23], note: 'Rules switched off, most with a comment that says why.' },
        ],
        commit: '23dd1e1',
      },
      {
        title: 'Run one command before every commit',
        detail:
          '`pnpm run check` runs typecheck, lint, Steiger (chapter 10) and the translation check through Nx, which caches each project, then the format check. CLAUDE.md asks every change to pass it. `ddefc8b` shows why the format ignore list needs care: Oxfmt read the git-ignored `.claude/settings.local.json` and failed the check on a file that is not in the repository.',
        files: [
          { path: 'package.json', lines: [17, 26], note: 'Typecheck, lint, format and the combined check.' },
          { path: '.oxfmtrc.json', lines: [8, 18], note: 'The ignore list today.' },
        ],
        commands: ['pnpm run check'],
        commit: 'ddefc8b',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run check',
        'pnpm run lint',
        'pnpm run fmt:check',
        'git commit --allow-empty -m "updated things"',
      ],
      expect: [
        '`pnpm run check` finishes without errors; run it again and Nx reports that it read the results from its cache.',
        '`pnpm run lint` reports no errors.',
        '`pnpm run fmt:check` exits with code 0.',
        'The hook rejects the empty commit with `subject may not be empty` and `type may not be empty`, and nothing is committed.',
      ],
      quiz: [
        {
          question: 'With `noUncheckedIndexedAccess` on, what is the type of `queue[0]` when `queue` is `QueueItem[]`?',
          options: ['`QueueItem`', '`QueueItem | undefined`', '`QueueItem | null`', '`unknown`'],
          answer: 1,
          explanation:
            'The flag adds `undefined` to every index read, because an array may be shorter than you think. Narrow with a check before use.',
        },
        {
          question: 'Why does this repository lint with Oxlint instead of ESLint with typescript-eslint?',
          options: [
            'ESLint cannot lint TSX',
            'Oxlint has more rules',
            'typescript-eslint needs the TypeScript compiler API, which TypeScript 7 does not have',
            'ESLint cannot run in a git hook',
          ],
          answer: 2,
          explanation:
            'The commit that adds Oxlint says so, and CLAUDE.md lists the tools that do not run on TypeScript 7. Oxlint gets types from `oxlint-tsgolint`, built on the Go compiler.',
        },
        {
          question: 'Which fix for `llm.shift()!` follows the rules of this repository?',
          options: [
            '`const item = llm.shift()`, then `if (item) push(...)`',
            '`llm.shift() as QueueItem`',
            'An `oxlint-disable-next-line` comment above it',
            'Turning off `typescript/no-non-null-assertion`',
          ],
          answer: 0,
          explanation:
            'Narrowing lets the compiler prove the item exists. A cast or a suppression hides the empty-queue case that the rule is there to catch.',
        },
      ],
    },
    pitfalls: [
      'typescript-eslint and the Nx module-boundary plugin do not run on TypeScript 7; the workspace boundaries are enforced with Oxlint `no-restricted-imports` overrides instead (`docs/architecture.md`).',
      'A tsconfig `include` entry of `.storybook` matched nothing, so the Storybook config was never type-checked until `e482350` listed `.storybook/*.ts` and `.storybook/*.tsx`.',
      'Oxfmt reads files that git ignores: `.claude/settings.local.json` failed `pnpm run check` until `ddefc8b` added `.claude/` to the ignore list.',
      '`||` and `??` differ for empty strings and `false`. `prefer-nullish-coalescing` is set to ignore strings and booleans, because here an empty string must fall through (comment in `.oxlintrc.json`).',
      'Hooks are installed by `prepare` during `pnpm install`. In a fresh clone before the install, or with `git commit --no-verify`, nothing checks the message.',
      'Running the formatter over hand-aligned tables destroys the alignment. Exclude the file (`content.ts`, `eb92d24`) instead of fighting the formatter.',
    ],
    tradeoffs: [
      'Oxlint is fast and works on TypeScript 7, but some ESLint plugins have no Oxlint version; `jsPlugins` covers a few, as with the Paraglide rule.',
      'Strict flags make code longer (guards, early returns, explicit `| undefined`); in exchange the compiler catches the empty-queue and missing-key cases that casts used to hide.',
      'A local hook gives the earliest feedback but can be skipped with `--no-verify`. CI (added in `0fc9c95`) runs the format check, `pnpm run affected` and the story tests on pull requests and on pushes to `main` and `develop`, but it does not run commitlint.',
    ],
    links: [
      { label: 'Conventional Commits', href: 'https://www.conventionalcommits.org/en/v1.0.0/' },
      { label: 'commitlint: getting started', href: 'https://commitlint.js.org/guides/getting-started.html' },
      { label: 'Husky: get started', href: 'https://typicode.github.io/husky/get-started.html' },
      { label: 'Oxlint', href: 'https://oxc.rs/docs/guide/usage/linter.html' },
      { label: 'Oxlint: type-aware linting', href: 'https://oxc.rs/docs/guide/usage/linter/type-aware.html' },
      { label: 'Oxfmt', href: 'https://oxc.rs/docs/guide/usage/formatter.html' },
      {
        label: 'TSConfig: noUncheckedIndexedAccess',
        href: 'https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess',
      },
      { label: 'TypeScript: narrowing', href: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html' },
    ],
    next: 'With the checks in place, chapter 5 goes back to `4c636c0` for its other half: Tailwind, colour tokens and two themes.',
  },
  {
    id: 'tokens-and-themes',
    summary:
      'You replace a hand-written stylesheet with Tailwind CSS v4 while keeping the colours as CSS variables, map those variables to utilities with `@theme inline`, and give each token a light and a dark value with `light-dark()`. A head script pins a chosen theme before the first paint, and text gets its own colour tokens so it passes contrast checks.',
    whereWeAre:
      'The first commit styles everything with `src/styles.css`, 167 lines of hand-written classes (`.wrap`, `.btn`, `.week`, `.ev`). The colours are already tokens on `:root`, and the dark palette is written twice: once for the system preference and once for a `data-theme` attribute that nothing sets yet.',
    problem:
      'Class names and their rules live in different files, so every layout change touches both and dead rules pile up. The duplicated dark palette must be edited in two places, there is no way to choose a theme, and some colours used as text are too light to read on a light surface.',
    outcomes: [
      'Set up Tailwind v4 through its Vite plugin with configuration written in CSS.',
      'Expose semantic CSS variables as utilities (`bg-surface`, `text-muted`, `bg-cal`) with `@theme inline`, and remove the default palette.',
      'Give every colour token both values with `light-dark()` and switch themes by changing `color-scheme` alone.',
      'Pin a theme without a flash, using `<meta name="color-scheme">` and a boot script in `<head>`.',
      'Make Tailwind scan workspace packages with `@source`, and keep text tokens above 4.5:1 contrast.',
    ],
    concepts: [
      {
        term: 'Tailwind CSS v4',
        explanation:
          'A utility-first CSS framework: you style an element with small classes (`rounded-[10px] border px-3.5 py-2`) and Tailwind generates only the rules those classes need. Version 4 is configured in CSS: the Vite plugin `@tailwindcss/vite` plus `@import "tailwindcss"` in the stylesheet, and no `tailwind.config.js`.',
        link: { label: 'Tailwind with Vite', href: 'https://tailwindcss.com/docs/installation/using-vite' },
      },
      {
        term: 'Theme variables and `@theme`',
        explanation:
          'Variables declared in `@theme` create utilities: `--color-surface` gives `bg-surface`, `text-surface` and `border-surface`; `--breakpoint-md` gives the `md:` variant. Setting a namespace to `initial` (`--color-*: initial`) removes the defaults, so only project colours exist and a stray `bg-red-500` simply does not work.',
        link: { label: 'Tailwind: theme variables', href: 'https://tailwindcss.com/docs/theme' },
      },
      {
        term: '`@theme inline`',
        explanation:
          'When a theme variable points at another variable, `@theme inline` makes the generated utility contain that reference itself (`.bg-surface { background-color: var(--surface) }`). The value is then resolved on the element, so it follows whatever `--surface` is there: the current theme, or a calendar colour set inline.',
        link: { label: 'Tailwind: @theme inline', href: 'https://tailwindcss.com/docs/theme' },
      },
      {
        term: 'Semantic tokens and the calendar colour',
        explanation:
          'Components never name a colour, only a role: `bg`, `surface`, `surface-2`, `ink`, `muted`, `line`, `today`, `focus`, later `done`. Calendar colours are data, so they cannot be classes: an element sets `--c` inline and uses `bg-cal` or `border-cal`, which read `var(--c)`.',
      },
      {
        term: '`color-scheme` and `light-dark()`',
        explanation:
          '`color-scheme: light dark` on the root says the page supports both schemes; the browser picks one from the system preference unless told otherwise. `light-dark(a, b)` returns `a` in the light scheme and `b` in the dark one, so each token holds both values in one declaration and a theme switch only changes `color-scheme`.',
        link: {
          label: 'MDN: light-dark()',
          href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark',
        },
      },
      {
        term: 'Pinning the scheme with a meta tag',
        explanation:
          '`<meta name="color-scheme" content="light dark">` tells the browser which schemes the document supports before any CSS loads. The app pins a theme by changing its `content` to `light` or `dark`, and the stylesheet reacts with `:root:has(> head > meta[name=\'color-scheme\'][content=\'dark\'])`. A boot script in `<head>` copies the saved choice into the meta before the first paint.',
        link: {
          label: 'MDN: <meta name="color-scheme">',
          href: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme',
        },
      },
      {
        term: 'Source detection and `@source`',
        explanation:
          'Tailwind finds class names by scanning files as plain text, and it skips `node_modules` and git-ignored files. Workspace packages are linked into `node_modules`, so their classes are invisible until the app stylesheet registers their folders with `@source`. For the same reason a class name must appear whole in the source, never assembled from pieces.',
        link: {
          label: 'Tailwind: detecting classes',
          href: 'https://tailwindcss.com/docs/detecting-classes-in-source-files',
        },
      },
      {
        term: 'Contrast for text',
        explanation:
          'WCAG asks for at least 4.5:1 between normal text and its background, and 3:1 for large text and graphics. A red or green that works as a fill or a dot is often too light as text on white, so text uses separate `-ink` tokens that are darker in the light scheme.',
        link: {
          label: 'WCAG 2.2: contrast (minimum)',
          href: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
        },
      },
    ],
    decisions: [
      {
        question: 'How are styles written?',
        options: [
          {
            name: 'Tailwind CSS v4 utilities',
            pros: [
              'Styles sit on the element they style; no class names to invent',
              'Only used utilities are generated',
              'Configuration in CSS, next to the tokens',
            ],
            cons: ['Long `className` strings', 'Class names must appear whole in the source or they are not generated'],
          },
          {
            name: 'Keep the hand-written stylesheet',
            pros: ['Plain CSS, no tool'],
            cons: ['Selectors and components drift apart, and dead rules stay'],
          },
          {
            name: 'CSS Modules per component',
            pros: ['Scoped class names'],
            cons: ['Still a second file per component and a naming scheme to maintain'],
          },
        ],
        chosen: 'Tailwind CSS v4 utilities',
        why: 'Reconstruction: `4c636c0` replaces the stylesheet with Tailwind v4 utility classes and records what it keeps (the tokens), not why it switched.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '4c636c0' },
          { kind: 'doc', ref: 'https://tailwindcss.com/docs/installation/using-vite' },
        ],
      },
      {
        question: 'Where do theme colours live?',
        options: [
          {
            name: 'Semantic CSS variables on :root, mapped to utilities',
            pros: [
              'One place swaps a theme; components never mention dark mode',
              'The calendar colour, which is data, flows through `--c` the same way',
            ],
            cons: ['Utilities read `var(...)`, so values resolve at runtime'],
          },
          {
            name: 'Tailwind `dark:` variants on every class',
            pros: ['Explicit on each element'],
            cons: ['Every coloured element needs two classes', 'A third theme means touching every component'],
          },
        ],
        chosen: 'Semantic CSS variables on :root, mapped to utilities',
        why: '`4c636c0`: "the color tokens stay as CSS variables so light and dark themes still swap them in one place". The header of `theme.css` gives the same reason: the tokens live on `:root` "so the scheme swaps them without a `dark:` variant on every class".',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '4c636c0' },
          { kind: 'file', ref: 'packages/ui/src/theme.css', note: 'lines 1-3' },
        ],
      },
      {
        question: 'How does each token carry its dark value?',
        options: [
          {
            name: 'light-dark() in one declaration',
            pros: ['Light and dark value side by side', 'A pinned theme only changes `color-scheme`'],
            cons: [
              'Needs `color-scheme: light dark` on the root',
              'Accepts colours only, so a shadow puts it on its colour part',
            ],
          },
          {
            name: 'A dark block per selector',
            pros: ['Works without `light-dark()` support'],
            cons: ['The dark palette was written twice: for the system preference and for the pinned theme'],
          },
        ],
        chosen: 'light-dark() in one declaration',
        why: '`186aea9`: the page "wrote the whole dark palette twice, once for the system preference and once for a theme pinned in the meta tag. It now declares both schemes, each token holds its pair through light-dark(), and the pinned theme only sets color-scheme." It was checked on a production build in both system modes and both pinned modes.',
        evidence: 'evidenced',
        sources: [{ kind: 'commit', ref: '186aea9' }],
      },
      {
        question: 'When is a pinned theme applied?',
        options: [
          {
            name: 'A boot script in <head> before the first paint',
            pros: ['No flash of the other theme', 'Works before React has loaded'],
            cons: [
              'An inline script string the type checker does not see',
              'Must not throw where storage is blocked, hence the `try`',
            ],
          },
          {
            name: 'An effect after hydration',
            pros: ['Plain React code'],
            cons: ['The first paint uses the system scheme, then flips'],
          },
          {
            name: 'On the server, from a cookie',
            pros: ['Correct HTML from the first byte'],
            cons: ['Every response depends on a cookie, which complicates caching'],
          },
        ],
        chosen: 'A boot script in <head> before the first paint',
        why: '`theme.ts`: the script "runs in <head> before the first paint, so a pinned theme never flashes the other one", and "the stylesheet reads the scheme from this <meta>". Why a meta tag replaced the `data-theme` attribute of the first stylesheet is not written.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'apps/web/src/shell/theme.ts', note: 'lines 6-10' },
          { kind: 'commit', ref: '931fbd6', note: 'adds the theme switch' },
        ],
      },
    ],
    steps: [
      {
        title: 'Install Tailwind through Vite',
        detail:
          'Add `tailwindcss` and `@tailwindcss/vite`, put `tailwindcss()` in the Vite plugins, and start the stylesheet with `@import "tailwindcss"`. There is no JavaScript config: everything below happens in CSS.',
        files: [
          { path: 'vite.config.ts', at: '4c636c0', lines: [3, 19], note: 'The Tailwind plugin next to the others.' },
          { path: 'src/styles.css', at: '4c636c0', lines: [1, 1], note: 'The import that pulls in Tailwind.' },
          { path: 'package.json', at: '4c636c0', lines: [19, 29], note: 'The new dependencies.' },
        ],
        commit: '4c636c0',
      },
      {
        title: 'Keep the tokens as variables',
        detail:
          'The palette stays semantic: `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--today`, `--focus`. Light values sit on `:root`; at this point the dark values are still repeated for `prefers-color-scheme: dark` and for `[data-theme="dark"]`, exactly as in the first stylesheet.',
        files: [
          { path: 'src/styles.css', at: '1370abc', lines: [1, 26], note: 'The tokens of the hand-written stylesheet.' },
          { path: 'src/styles.css', at: '4c636c0', lines: [3, 46], note: 'The same tokens above the Tailwind theme.' },
        ],
      },
      {
        title: 'Turn tokens into utilities',
        detail:
          '`@theme` with `--color-*: initial` removes the default palette, and `--breakpoint-*: initial` replaces the breakpoints with `md` at 701 px and `lg` at 961 px; two font stacks become `font-sans` and `font-display`. `@theme inline` maps `--color-surface: var(--surface)` and the other roles, and `--color-cal: var(--c)` gives `bg-cal` and `border-cal` for the calendar colour.',
        files: [
          {
            path: 'src/styles.css',
            at: '4c636c0',
            lines: [48, 70],
            note: 'The theme reset and the token-to-utility map.',
          },
          { path: 'packages/ui/src/theme.css', lines: [34, 59], note: 'The same map today, with the text tokens.' },
        ],
      },
      {
        title: 'Rewrite components with utilities',
        detail:
          'Each class of the old stylesheet becomes utilities on the element. Repeated combinations become small components (`Button`, `Dot`, `Segmented`) or string constants (`EVENT`, `EVENT_BUSY`). Calendar colours never become class names: `calendarColor(color)` sets `--c` inline and the classes stay static, which is what Tailwind source detection needs. Declaring `--c` on `CSSProperties` (`cf3a240`) later removed the cast.',
        files: [
          {
            path: 'src/components/ui.tsx',
            at: '4c636c0',
            lines: [3, 20],
            note: 'The colour helper, a button and a dot.',
          },
          {
            path: 'src/components/WeekGrid.tsx',
            at: '4c636c0',
            lines: [100, 108],
            note: 'An event: static classes, inline colour and position.',
          },
          {
            path: 'packages/ui/src/calendar-color.ts',
            lines: [1, 10],
            note: 'The helper today, typed without a cast.',
          },
        ],
      },
      {
        title: 'Add a theme switch that does not flash',
        detail:
          '`931fbd6` adds `<meta name="color-scheme" content="light dark">` to the head and a boot script that copies a saved choice from `localStorage` into that meta before the first paint. `setTheme` changes the same meta and saves the choice, or removes it for System. The planner command palette offers System, Light and Dark.',
        files: [
          { path: 'apps/web/src/shell/theme.ts', lines: [1, 22], note: 'The boot script and the switch.' },
          {
            path: 'apps/web/src/routes/__root.tsx',
            lines: [14, 30],
            note: 'The meta tag and the boot scripts in the head.',
          },
          { path: 'apps/web/src/routes/index.tsx', lines: [41, 43], note: 'The theme commands in the palette.' },
        ],
        commit: '931fbd6',
      },
      {
        title: 'Give each token one declaration',
        detail:
          '`186aea9` declares `color-scheme: light dark` on `:root`, narrows it to one scheme when the meta pins one, and writes every token as `light-dark(light, dark)`. The pinned theme now sets nothing but `color-scheme`. `accent-color: var(--focus)` makes native checkboxes use the focus colour.',
        files: [
          {
            path: 'packages/ui/src/theme.css',
            lines: [1, 32],
            note: 'The scheme switch and every token with both values.',
          },
        ],
        commit: '186aea9',
      },
      {
        title: 'Separate text colours from fills',
        detail:
          '`text-today` and `text-done` reused fill colours that are below 4.5:1 on a light surface. `27e6764` adds `--today-ink` and `--done-ink`, darker in the light scheme and unchanged in the dark one, and moves text to them; the stories whose accessibility check had been deferred are checked again. `6495a57` then runs every story in both themes.',
        files: [
          { path: 'packages/ui/src/theme.css', lines: [19, 24], note: 'Fill and text tokens side by side.' },
          { path: 'apps/stand/package.json', lines: [11, 11], note: 'The stand tests run once per theme.' },
        ],
        commands: ['pnpm run stand:test'],
        commit: '27e6764',
      },
      {
        title: 'Let Tailwind see the packages',
        detail:
          'Once components move into workspace packages (chapter 10) they are linked through `node_modules`, which Tailwind does not scan. The app stylesheet imports the shared theme from `@lc/ui/theme.css` and registers `@source` for `packages/ui/src` and `modules`, so their classes are generated. The Oxfmt option `sortTailwindcss.stylesheet` points at the same file.',
        files: [
          { path: 'apps/web/src/styles.css', lines: [1, 6], note: 'The theme import and the extra sources.' },
          { path: 'packages/ui/package.json', lines: [6, 10], note: 'The package exports its theme stylesheet.' },
          { path: '.oxfmtrc.json', lines: [7, 7], note: 'Class sorting reads the same stylesheet.' },
        ],
        commit: '6d9869b',
      },
      {
        title: 'Load the fonts',
        detail:
          'Golos Text for the interface and Unbounded for display numbers come from Google Fonts with `display=swap`, after a `preconnect` to both font hosts. `@theme` turns them into `font-sans` (the default) and `font-display`, each with a system fallback stack.',
        files: [
          { path: 'apps/web/src/routes/__root.tsx', lines: [20, 26], note: 'Preconnects and the font stylesheet.' },
          { path: 'packages/ui/src/theme.css', lines: [39, 40], note: 'The two font stacks.' },
        ],
      },
    ],
    checkpoint: {
      commands: ['pnpm run dev', 'pnpm run stand', 'pnpm run stand:test'],
      expect: [
        'http://localhost:3000/ru follows the system appearance: switch the OS between light and dark and the colours change without a reload.',
        'In the planner, `Ctrl/⌘ K` and a theme command pin Light or Dark; after a reload the pinned theme is there from the first paint.',
        'The stand on http://localhost:6006 shows `UI kit/Button`, `UI kit/Segmented` and the `UI kit/calendarColor` palette.',
        '`pnpm run stand:test` renders every story in headless Chromium twice, once per theme, and axe finds no violation.',
      ],
      quiz: [
        {
          question: 'Why is the token map written with `@theme inline` and not plain `@theme`?',
          options: [
            'Plain `@theme` cannot hold colours',
            'With `inline` the utility contains `var(--surface)` itself, so it resolves on the element and follows the current theme',
            '`inline` makes the CSS smaller',
            '`inline` is required in Tailwind v4 for every variable',
          ],
          answer: 1,
          explanation:
            'Without `inline` a variable that references another variable is resolved where the theme variable is defined, which may not be where the referenced value is set.',
        },
        {
          question: 'After `186aea9`, what does pinning the dark theme change?',
          options: [
            'It swaps a block of dark values onto `:root`',
            'It adds a `dark` class to `<html>`',
            'It reloads the page with another stylesheet',
            'Only `color-scheme`; every `light-dark()` token then returns its second value',
          ],
          answer: 3,
          explanation:
            'The meta content becomes `dark`, the `:has()` rule sets `color-scheme: dark`, and each token picks its dark value. No colour is written twice.',
        },
        {
          question: 'Why do the classes of `packages/ui` need an `@source` line in the app stylesheet?',
          options: [
            'Tailwind skips `node_modules`, and workspace packages are linked through it',
            'Packages are compiled before Tailwind runs',
            'Tailwind scans only `.css` files',
            'The package has its own Tailwind build',
          ],
          answer: 0,
          explanation:
            'Tailwind scans the project as text but ignores `node_modules` and git-ignored files. Without the extra sources, a utility used only in a package is never generated.',
        },
      ],
    },
    pitfalls: [
      'Duplicated dark palettes drift: a token added to the light block and forgotten in one of the two dark blocks shows the wrong colour in one mode only. `186aea9` removed the duplication with `light-dark()`.',
      'Reusing a fill colour for text fails contrast. `27e6764` split `--today-ink` and `--done-ink` from the fills; `6495a57` also stopped dimming done events and hidden chips with opacity, which lowered their text contrast.',
      'Building class names from data (`bg-${color}`) produces classes Tailwind never generates. Put the data in a CSS variable (`--c`) and keep the class static (`bg-cal`).',
      'Applying a stored theme in an effect flashes the system theme on every load. The boot script runs in `<head>` before the first paint and is wrapped in `try` for browsers that block storage.',
      'Classes used only inside a workspace package are missing from the build until the app stylesheet lists the package folder with `@source`.',
    ],
    tradeoffs: [
      'Utilities keep styles next to markup and the CSS small, but long class strings are harder to scan; Oxfmt sorts them so diffs stay stable.',
      'Removing the default palette (`--color-*: initial`) blocks off-system colours, and also means every new role must first be added as a token.',
      '`light-dark()` and `:has()` keep the theme logic to one rule each, at the cost of requiring browsers that support both.',
    ],
    links: [
      { label: 'Tailwind CSS: install with Vite', href: 'https://tailwindcss.com/docs/installation/using-vite' },
      { label: 'Tailwind CSS: theme variables', href: 'https://tailwindcss.com/docs/theme' },
      {
        label: 'Tailwind CSS: detecting classes in source files',
        href: 'https://tailwindcss.com/docs/detecting-classes-in-source-files',
      },
      {
        label: 'MDN: light-dark()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark',
      },
      {
        label: 'MDN: color-scheme',
        href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme',
      },
      {
        label: 'MDN: <meta name="color-scheme">',
        href: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme',
      },
      { label: 'MDN: :has()', href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:has' },
      {
        label: 'WCAG 2.2: contrast (minimum)',
        href: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
      },
    ],
    next: 'The same commit `4c636c0` also took every string out of the components; chapter 6 follows it into three languages.',
  },
  {
    id: 'three-languages',
    summary:
      'You move every interface string into message files for Russian, English and Spanish, compile them with Paraglide JS into typed functions, and route by URL prefix: `/ru/…`, `/en/…`, `/es/…`, with `/api/…` left alone. Dates and hours are formatted per locale with `Intl`, and two checks keep the three files complete.',
    whereWeAre:
      'Every string in the viewer is Russian and written inline in JSX, plural forms come from a hand-written `plural()` in `dates.ts`, and day and month names are Russian arrays. `4c636c0` changes all of this together with the Tailwind move; `8bc261a` changes the URL scheme five minutes later.',
    problem:
      'Inline strings cannot be translated without forking components, `plural()` knows only Russian rules, and the date names are hard-coded. The language must be known on the server for each request, so the HTML arrives translated, while the URLs that calendar apps subscribe to must not change.',
    outcomes: [
      'Set up an inlang project and Paraglide JS so that `m.key()` calls are typed and compiled.',
      'Write messages with variables and plural variants that follow the rules of each language.',
      'Route locales by URL prefix with a router `rewrite` and a server middleware, and exclude paths from localization.',
      'Format dates, weekdays, months and numbers per locale with `Intl` without shifting wall-clock times.',
      'Fail the checks on a missing translation, a missing plural form or a dynamic message lookup.',
    ],
    concepts: [
      {
        term: 'Compiled messages with Paraglide JS',
        explanation:
          'Paraglide compiles the message files into modules where each message is a function: `m.budget_of({ budget })`. The functions are typed by their variables, a missing key is a type error, and each message is a separate export, so a bundler can leave out the messages a page never calls. The current locale is read when the function runs, through `getLocale()`.',
        link: { label: 'Paraglide JS', href: 'https://paraglidejs.com' },
      },
      {
        term: 'The inlang project',
        explanation:
          '`project.inlang/settings.json` holds `baseLocale` (`ru`), the `locales`, and plugins loaded by URL: the message-format plugin reads `./messages/{locale}.json`, and the m-function matcher lets tools find `m.key()` calls in the source. Next to it, `paraglide.config.ts` holds the compiler options: output folder, strategy and URL patterns.',
        link: {
          label: 'inlang message format plugin',
          href: 'https://inlang.com/m/reootnfj/plugin-inlang-messageFormat',
        },
      },
      {
        term: 'Variants for plurals',
        explanation:
          'A message that depends on a number is an array with `declarations` (`input count`, `local countPlural = count: plural`), `selectors` and a `match` map with keys such as `countPlural=one`, `few`, `many` and `*`. Paraglide picks the key with `Intl.PluralRules`, so Russian has three forms and English two, behind the same call.',
        link: { label: 'Paraglide: variants', href: 'https://paraglidejs.com/variants' },
      },
      {
        term: 'Locale strategy',
        explanation:
          'The `strategy` array says where the locale comes from, first match wins: here `url`, then `baseLocale`. `urlPatterns` map a path without a locale to one path per locale (`/:path(.*)?` to `/ru/:path(.*)?`), and `routeStrategies` can exclude paths from all of it.',
        link: { label: 'Paraglide: strategy', href: 'https://paraglidejs.com/strategy' },
      },
      {
        term: 'URL rewrite in the router',
        explanation:
          'TanStack Router can translate URLs in both directions. `rewrite.input` runs `deLocalizeUrl`, so `/en/timeline` is matched as `/timeline`; `rewrite.output` runs `localizeUrl`, so every `Link` and `navigate` produces `/en/timeline` again. Route files never mention a locale.',
        link: {
          label: 'TanStack Router: URL rewrites',
          href: 'https://tanstack.com/router/latest/docs/framework/react/guide/url-rewrites',
        },
      },
      {
        term: 'Server middleware and the locale of a request',
        explanation:
          '`paraglideMiddleware` wraps the Start handler in `src/server.ts`. It finds the locale of each request, keeps it in `AsyncLocalStorage` so concurrent requests do not mix, and answers a page request on a URL without a locale with a `307` redirect. `server.ts` hands the Start handler the original request, not the one the middleware passes to its callback: the router does its own URL rewriting, and the middleware docs warn that the other way loops.',
        link: { label: 'Paraglide: middleware', href: 'https://paraglidejs.com/middleware' },
      },
      {
        term: 'Locale-aware dates with Intl',
        explanation:
          "`new Intl.DateTimeFormat(locale, options)` gives `Пн, 23 нояб.` in Russian and `Mon, Nov 23` in English with no month tables. Plan times are UTC-naive wall-clock numbers, so every formatter sets `timeZone: 'UTC'`; without it the numbers would be shifted by the zone of the machine.",
        link: {
          label: 'MDN: Intl.DateTimeFormat()',
          href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat',
        },
      },
      {
        term: 'Translation checks',
        explanation:
          '`check:i18n` runs `inlang check` over the source files and fails on missing or empty translations, mismatched variables, missing plural forms and unused messages. The Oxlint rule `paraglide/no-dynamic-message-access` rejects computed lookups such as `m[key]`, which no checker can follow to a message.',
      },
    ],
    decisions: [
      {
        question: 'Which i18n approach?',
        options: [
          {
            name: 'Paraglide JS',
            pros: [
              'Typed message functions: a missing key fails the type check',
              'Messages are separate exports, so a bundler can drop the ones a page never calls',
              'Ships the middleware and URL helpers that the TanStack Router docs use',
            ],
            cons: ['A compile step and a generated folder', 'A variant syntax in JSON to learn'],
          },
          {
            name: 'A runtime library with JSON catalogs',
            pros: ['A large ecosystem', 'No compile step'],
            cons: ['Keys are plain strings, so a typo shows at runtime', 'Catalogs load at runtime'],
          },
          {
            name: 'No library, one object per language',
            pros: ['Nothing to install'],
            cons: ['Plurals, variables and checks written by hand'],
          },
        ],
        chosen: 'Paraglide JS',
        why: 'Reconstruction: `4c636c0` says the strings are "rendered through Paraglide JS" but not why. The TanStack Router docs name Paraglide in their i18n rewrite example and Paraglide documents a TanStack Start setup, which fits the stack; the rest is our reading.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '4c636c0' },
          { kind: 'doc', ref: 'https://tanstack.com/router/latest/docs/framework/react/guide/url-rewrites' },
          { kind: 'doc', ref: 'https://paraglidejs.com/tanstack-start' },
        ],
      },
      {
        question: 'Which URLs carry the locale?',
        options: [
          {
            name: 'Every locale prefixed, /api excluded',
            pros: ['One rule for every language', 'Calendar subscription URLs under `/api` never change'],
            cons: ['Old unprefixed page links need a redirect (the middleware sends it)'],
          },
          {
            name: 'Base locale unprefixed, the others prefixed',
            pros: ['Russian URLs stay as they were'],
            cons: ['The catch-all Russian pattern also matches `/api`, which then stays valid only by accident'],
          },
          {
            name: 'Locale in a cookie, the same URLs for all',
            pros: ['Clean URLs'],
            cons: ['A link does not say its language', 'Caches must vary on the cookie'],
          },
        ],
        chosen: 'Every locale prefixed, /api excluded',
        why: '`8bc261a`: "Every language now has a URL prefix; unprefixed page URLs redirect to /ru. The /api endpoints stay unprefixed so calendar subscription URLs keep working." The config comment repeats it: the `.ics` and plan endpoints are language-neutral and their URLs are used as calendar subscriptions.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '8bc261a' },
          { kind: 'file', ref: 'packages/i18n/project.inlang/paraglide.config.ts', note: 'lines 17-18' },
        ],
      },
      {
        question: 'How does a language switch take effect?',
        options: [
          {
            name: 'Reload on the localized URL',
            pros: [
              'The server renders the new language, so the HTML, `<html lang>` and every formatted date agree',
              'No client-side state to reset',
            ],
            cons: ['A full page load; state that is not in the URL is lost'],
          },
          {
            name: 'Switch in place on the client',
            pros: ['Instant'],
            cons: [
              'Every component that formatted text must re-render',
              'Server and client can disagree until the next load',
            ],
          },
        ],
        chosen: 'Reload on the localized URL',
        why: '`LanguageSwitcher.tsx`: "Switching reloads the page on the localized URL, so the server renders the new language." Paraglide `setLocale` navigates to the localized URL or reloads by default, and its routing guide says that "A locale-changing URL must load a new document".',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'apps/web/src/shell/LanguageSwitcher.tsx', note: 'line 5' },
          { kind: 'doc', ref: 'https://paraglidejs.com/i18n-routing' },
        ],
      },
      {
        question: 'What gets translated?',
        options: [
          {
            name: 'The interface only; plan content and exports stay Russian',
            pros: [
              'Three message files instead of three plans',
              'Exported calendars are the same whatever language the viewer uses',
            ],
            cons: ['An English reader sees Russian event titles'],
          },
          {
            name: 'The interface and the plan content',
            pros: ['A fully English or Spanish screen'],
            cons: ['Every course, session and description in three languages, kept in step with the generator'],
          },
        ],
        chosen: 'The interface only; plan content and exports stay Russian',
        why: 'Recorded as a rule, not argued: `4c636c0` says "Plan content and exported files stay Russian", and CLAUDE.md keeps "Plan content stays Russian". The pros and cons above are our reading.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '4c636c0' },
          { kind: 'file', ref: 'CLAUDE.md', note: 'line 13' },
        ],
      },
    ],
    steps: [
      {
        title: 'Create the inlang project',
        detail:
          'Add `@inlang/paraglide-js` and `@inlang/cli`, then `project.inlang/settings.json` with `baseLocale: "ru"`, `locales: ["ru", "en", "es"]`, the message-format plugin with `pathPattern: "./messages/{locale}.json"`, and the m-function matcher. VS Code gets the inlang extension as a recommendation.',
        files: [
          { path: 'project.inlang/settings.json', at: '4c636c0', lines: [1, 16], note: 'Locales and plugins.' },
          {
            path: 'packages/i18n/project.inlang/settings.json',
            lines: [1, 12],
            note: 'The same settings today, inside the i18n package.',
          },
        ],
        commit: '4c636c0',
      },
      {
        title: 'Write the messages',
        detail:
          'Each file maps keys to text, with variables as `{name}`. Plural messages are variant arrays: Russian `in_calendars` matches `one`, `few`, `many` and `*`, English only `one` and `*`. Keys are snake_case and name the place, not the words (`budget_of`, `no_events_this_week`).',
        files: [
          { path: 'packages/i18n/messages/ru.json', lines: [1, 25], note: 'Plain messages and a Russian plural.' },
          {
            path: 'packages/i18n/messages/en.json',
            lines: [9, 23],
            note: 'The same plural in English, with two forms.',
          },
        ],
      },
      {
        title: 'Compile the messages',
        detail:
          'The Vite plugin recompiles when a message file changes, so dev picks it up without a restart; the `i18n` script runs the compiler for tools without Vite, and `prepare` and `typecheck` run it so the generated folder always exists. Since `1d67c96` the plugin writes real files (`outputStructure: \'message-modules\'`): its default output imports virtual modules that only the app dev server resolves, and the component stand failed with "Failed to fetch dynamically imported module".',
        files: [
          { path: 'vite.config.ts', at: '4c636c0', lines: [13, 13], note: 'The first plugin call.' },
          {
            path: 'package.json',
            at: '4c636c0',
            lines: [14, 17],
            note: 'The compile script and the scripts that depend on it.',
          },
          {
            path: 'apps/web/vite.config.ts',
            lines: [13, 20],
            note: 'The plugin today: project, output folder, real files.',
          },
        ],
        commands: ['pnpm run i18n'],
        commit: '1d67c96',
      },
      {
        title: 'Replace inline strings with message calls',
        detail:
          "Every string in JSX becomes a message call: the title and description in `head()`, the not-found text, the labels. `<html lang={getLocale()}>` follows the request, and links use `localizeHref('/')` so they keep the current language. Text that `plural()` built is now a variant message.",
        files: [
          {
            path: 'src/routes/__root.tsx',
            at: '4c636c0',
            lines: [1, 47],
            note: 'Localized head, not-found page and `lang` attribute.',
          },
        ],
      },
      {
        title: 'Route by URL',
        detail:
          "`strategy: ['url', 'baseLocale']` and one `urlPatterns` entry define the URLs. The router `rewrite` strips and adds the prefix, so route files stay locale-free. `src/server.ts` replaces the default server entry: it wraps the Start handler in `paraglideMiddleware` and passes the original `request` on, as Paraglide advises when the framework rewrites URLs itself.",
        files: [
          {
            path: 'project.inlang/paraglide.config.ts',
            at: '4c636c0',
            lines: [1, 18],
            note: 'The first URL scheme, with Russian unprefixed.',
          },
          { path: 'src/router.tsx', at: '4c636c0', lines: [6, 15], note: 'The two-way rewrite.' },
          { path: 'src/server.ts', at: '4c636c0', lines: [1, 8], note: 'The server entry wrapped in the middleware.' },
        ],
      },
      {
        title: 'Prefix every locale and exclude /api',
        detail:
          'In the first version Russian kept the unprefixed URLs, with a comment that this kept existing links and `/api` routes valid. `8bc261a` gives Russian `/ru` like the other languages, so unprefixed page URLs redirect, and adds `routeStrategies` with `exclude: true` for `/api/:path(.*)?`, so the feeds keep their addresses.',
        files: [
          {
            path: 'packages/i18n/project.inlang/paraglide.config.ts',
            lines: [1, 19],
            note: 'Three prefixed patterns and the excluded API.',
          },
        ],
        commit: '8bc261a',
      },
      {
        title: 'Format with Intl',
        detail:
          "One cached `Intl.DateTimeFormat` per locale and style replaces the Russian arrays. Every formatter sets `timeZone: 'UTC'` because the numbers are wall-clock times stored as UTC-naive values. Dots are removed from abbreviations, which in Russian and Spanish read like the end of a sentence, and the first letter is upper-cased. Hours go through `Intl.NumberFormat` inside the `hours_short` message, so Russian gets `1,5 ч` and English `1.5 h`.",
        files: [
          { path: 'src/lib/format.ts', at: '4c636c0', lines: [1, 36], note: 'The first locale-aware formatters.' },
          {
            path: 'packages/i18n/src/format.ts',
            lines: [1, 44],
            note: 'The same formatters today, with month styles.',
          },
        ],
      },
      {
        title: 'Switch the language with a reload',
        detail:
          'The switch is a `Segmented` control over `locales`, and each label carries its own `lang` attribute for screen readers. `setLocale(locale)` goes to the same page under the new prefix and the server renders it in that language. The planner command palette offers the same through `setLocale`.',
        files: [
          { path: 'apps/web/src/shell/LanguageSwitcher.tsx', lines: [1, 15], note: 'The switch and its reason.' },
          { path: 'apps/web/src/routes/index.tsx', lines: [44, 49], note: 'Language commands in the palette.' },
        ],
      },
      {
        title: 'Check the translations',
        detail:
          '`check:i18n` runs `inlang check` with the source files of the app and the modules, so missing and unused messages are found across the workspace. `paraglide/no-dynamic-message-access` forbids `m[key]()`. Where a value picks a message, map it explicitly, as the export dialog maps each calendar app to its message function.',
        files: [
          {
            path: 'packages/i18n/package.json',
            lines: [16, 16],
            note: 'The translation check over app and module sources.',
          },
          { path: '.oxlintrc.json', lines: [141, 141], note: 'The Paraglide lint rule.' },
          {
            path: 'modules/calendar-export/src/features/export-calendars/ui/ExportDialog.tsx',
            lines: [18, 26],
            note: 'An explicit map from a value to message functions.',
          },
        ],
        commands: ['pnpm run check:i18n'],
      },
      {
        title: 'Move i18n into a package',
        detail:
          '`6d9869b` moves the messages, the project and `format.ts` into `@lc/i18n`. Its `exports` expose `./messages`, `./runtime`, `./server` and `./format`; the generated `src/paraglide/` folder stays out of git, because the compiler writes a `.gitignore` into it. Modules import `@lc/i18n/messages`, never the generated path.',
        files: [
          {
            path: 'packages/i18n/package.json',
            lines: [1, 17],
            note: 'Public entries and scripts of the i18n package.',
          },
        ],
        commit: '6d9869b',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run i18n',
        'pnpm run check:i18n',
        'pnpm run dev',
        'curl -sI -H "Sec-Fetch-Dest: document" http://localhost:3000/',
        'curl -sI http://localhost:3000/api/plan',
      ],
      expect: [
        '`pnpm run check:i18n` finishes without errors for `ru`, `en` and `es`.',
        'http://localhost:3000/en shows the planner in English and http://localhost:3000/es in Spanish; the week dates read like `Mon, Nov 23` and `Lun, 23 nov`.',
        'The first curl answers `307` with a `Location` under `/ru`. Without the `Sec-Fetch-Dest: document` header the middleware does not treat the request as a page load and does not redirect.',
        'The `/api/plan` request answers `200` with no redirect.',
      ],
      quiz: [
        {
          question: 'Why is `/api/:path(.*)?` excluded from localization?',
          options: [
            'API routes cannot be server-rendered',
            'Calendar apps subscribe to `/api/ics/...`; a prefix or a redirect would break those URLs',
            'Paraglide cannot handle JSON responses',
            'To make the API faster',
          ],
          answer: 1,
          explanation:
            '`8bc261a` says so, and the comment in `paraglide.config.ts` repeats it: the endpoints are language-neutral and their URLs are calendar subscriptions.',
        },
        {
          question:
            'A Russian plural message has `one`, `few`, `many` and `*`; the English one has `one` and `*`. What picks the form for `count = 3`?',
          options: [
            'An `if` in the component',
            'The order of the keys in the JSON',
            'The browser language',
            '`Intl.PluralRules` for the current locale',
          ],
          answer: 3,
          explanation:
            'The `plural` function in the declaration asks `Intl.PluralRules`, which returns `few` for 3 in Russian and `other` in English; `*` is the fallback.',
        },
        {
          question: "Why does every formatter in `format.ts` pass `timeZone: 'UTC'`?",
          options: [
            'Plan times are wall-clock values stored as UTC-naive numbers; any other zone would shift them',
            'Minsk is in UTC',
            'Intl requires a zone',
            'To match the server log times',
          ],
          answer: 0,
          explanation:
            'The numbers are built with `Date.UTC` from Minsk wall-clock strings. Formatting them in UTC prints exactly that wall clock, on any machine.',
        },
      ],
    },
    pitfalls: [
      'The base locale on unprefixed URLs: the catch-all Russian pattern matched `/api` too and stayed harmless only by accident. `8bc261a` prefixed every locale and excluded `/api` explicitly.',
      "The Vite plugin default output is virtual modules that only the app dev server can resolve, so another consumer (the component stand, the type check) breaks. `1d67c96` sets `outputStructure: 'message-modules'`.",
      'Passing the request from the middleware callback on to the handler causes a redirect loop when the router rewrites URLs itself; the JSDoc of `paraglideMiddleware` says to pass the original `request`, as `server.ts` does.',
      "A formatter without `timeZone: 'UTC'` shifts every time by the offset of the machine.",
      'Abbreviated month and weekday names end with a dot in Russian and Spanish (`нояб.`, `lun.`), which reads like the end of a sentence mid-line; `format.ts` strips it.',
      'Testing the redirect with plain `curl` shows none: the middleware redirects only requests marked `Sec-Fetch-Dest: document`, as browsers mark page loads.',
    ],
    tradeoffs: [
      'A compile step and a generated folder buy typed messages that a bundler can tree-shake; the folder must exist before type checks, so `prepare`, `typecheck` and the Nx task dependencies run `i18n` first.',
      'Reloading on a language switch is simple and keeps server and client in agreement, at the cost of a page load and any state not kept in the URL.',
      'Keeping plan content in Russian keeps one plan and identical exports, at the price of mixed-language screens in English and Spanish.',
    ],
    links: [
      { label: 'Paraglide JS', href: 'https://paraglidejs.com' },
      { label: 'Paraglide: TanStack Start', href: 'https://paraglidejs.com/tanstack-start' },
      { label: 'Paraglide: strategy', href: 'https://paraglidejs.com/strategy' },
      { label: 'Paraglide: variants', href: 'https://paraglidejs.com/variants' },
      { label: 'Paraglide: middleware', href: 'https://paraglidejs.com/middleware' },
      {
        label: 'TanStack Router: URL rewrites',
        href: 'https://tanstack.com/router/latest/docs/framework/react/guide/url-rewrites',
      },
      { label: 'inlang message format plugin', href: 'https://inlang.com/m/reootnfj/plugin-inlang-messageFormat' },
      {
        label: 'MDN: Intl.DateTimeFormat()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat',
      },
    ],
    next: 'Part 1 ends with a localized, themed, checked app; chapter 7 makes edits made in the viewer survive `pnpm run plan` through an overlay file, `edits.json`.',
  },
] satisfies readonly Syllabus[]
