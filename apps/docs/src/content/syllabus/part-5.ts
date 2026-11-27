// Chapters 11, 22, 23 and 24: modules composed at build time, where the app can run, and the step to run-time
// composition this guide itself takes. Files of the docs app are referenced on `main`, where they land with it.
import type { Syllabus } from './types'

const PIN = '7351e1e83d980dc6d650f3743612ad549c403452'

export const PART_5 = [
  {
    id: 'build-time-microfrontends',
    summary:
      'The planner page, its widgets and the export dialog leave `apps/web` for workspace packages under `modules/`, each with Feature-Sliced layers and one public entry. The app becomes a thin shell that wires modules to the URL, the server and each other through props and slots, and lint makes the boundaries hold.',
    whereWeAre:
      'The repository is an Nx + pnpm workspace (chapter 9) with the domain, the data store, the translations and the UI kit as packages (chapter 10). All the screens still live in `apps/web`: `src/routes/index.tsx` holds the planner page, the week grid, the agenda, the budget panel, the runway and every dialog, close to 300 lines in one route file.',
    problem:
      'Every new screen makes the one app bigger, and nothing stops a dialog from reaching into the router, a server function or another screen. A part of the product cannot be built, tested or shown on its own, and if one ever had to ship separately it would first have to be untangled. The product needs vertical slices with walls between them, without giving up typed routes and server rendering.',
    outcomes: [
      'tell build-time from run-time microfrontends and say what each costs',
      'turn a part of an app into a workspace package with one public entry',
      'lay out a module with Feature-Sliced Design layers and slices',
      'invert dependencies so a module receives data, callbacks and slots instead of importing them',
      'enforce package boundaries with Oxlint overrides and layer rules with Steiger',
    ],
    concepts: [
      {
        term: 'Microfrontend',
        explanation:
          'A part of a frontend owned and changed on its own: its screens, its state, its tests. It can be composed into the app when the app is built (a package the bundler includes) or when the page runs (code fetched over the network). The walls are the point; the delivery mechanism is a separate choice.',
        link: {
          label: 'Micro Frontends — martinfowler.com',
          href: 'https://martinfowler.com/articles/micro-frontends.html',
        },
      },
      {
        term: 'Build-time composition',
        explanation:
          'Each module is a package the app imports like a library. Vite bundles everything into one deployable, so TypeScript checks the props across the boundary, the router stays typed and server rendering works unchanged. The price: one release train, and a module cannot be updated without rebuilding the app.',
      },
      {
        term: 'Feature-Sliced Design (FSD)',
        explanation:
          'A layout for frontend code by responsibility: `pages` compose `widgets`, widgets compose `features` (one user action each), and everything may use `shared`. A layer imports only from layers below it; slices on one layer never import each other; every slice is reached only through its `index.ts`.',
        link: { label: 'Feature-Sliced Design', href: 'https://feature-sliced.design/' },
      },
      {
        term: 'Public entry',
        explanation:
          "A module's `src/index.ts` is the only file other packages may import, declared as `exports` in its `package.json`. Everything not re-exported there is private, so the inside can be rearranged freely. It is also the natural boundary for run-time federation later.",
      },
      {
        term: 'Slots and render props',
        explanation:
          'A module that needs something it must not import takes it as a prop: `headerAside` is a slot (a React node the app renders inside the module), `renderExport` a render prop (a function the module calls with its own data). The module stays ignorant of the router, the language switcher and other modules.',
      },
      {
        term: 'Nx project tags',
        explanation:
          'Labels in each `package.json` (`"nx": { "tags": ["type:module"] }`) that group projects. Commands can target a group (`nx run-many --projects=tag:type:module`), and boundary rules can be written per tag.',
        link: { label: 'Nx: enforce module boundaries', href: 'https://nx.dev/features/enforce-module-boundaries' },
      },
      {
        term: 'Steiger',
        explanation:
          'A linter for the Feature-Sliced structure: it checks layer order, slice isolation and public APIs inside one source folder (`steiger ./src`), which an import linter cannot see.',
        link: { label: 'Steiger', href: 'https://github.com/feature-sliced/steiger' },
      },
    ],
    decisions: [
      {
        question: 'Compose the slices of the product when the app is built, or when the page runs?',
        options: [
          {
            name: 'At build time: workspace packages',
            pros: [
              'Types checked across every boundary',
              'Typed routes and server rendering keep working',
              'No network or version skew at run time',
            ],
            cons: ['One release for everything', 'A module change rebuilds the app'],
          },
          {
            name: 'At run time: Module Federation remotes',
            pros: ['Each part deploys on its own', 'The host does not rebuild for a remote change'],
            cons: [
              'Types are a contract to maintain',
              'Shared dependencies must be negotiated',
              'Server rendering of remotes needs extra setup',
            ],
          },
          {
            name: 'iframes per part',
            pros: ['Total isolation of code and styles'],
            cons: ['No shared state or theme', 'Focus, height and history are hard', 'Every frame loads its own React'],
          },
        ],
        chosen: 'At build time: workspace packages',
        why: 'One person ships one app: independent deployment buys nothing yet, while typed props and server rendering are needed every day. The architecture document records the choice and keeps the door open: a module\'s public entry "is already the federation boundary" (chapter 23 walks through it).',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/architecture.md', note: '"Modules are microfrontends composed at build time"' },
          { kind: 'commit', ref: 'cf289bd', note: 'the split, with the reason in its body' },
        ],
      },
      {
        question: 'How does a module get what it does not own: data, navigation, persistence, other modules?',
        options: [
          {
            name: 'Props, callbacks and slots from the app',
            pros: [
              'A module is testable and storyable with plain props',
              'The app is the only place that knows about the router and the server',
            ],
            cons: ['Prop lists grow', 'The app route becomes the wiring diagram'],
          },
          {
            name: 'A shared global store',
            pros: ['No prop drilling'],
            cons: ['Hidden coupling between modules', 'Server rendering needs a store per request'],
          },
          {
            name: 'Modules import each other',
            pros: ['Least code at first'],
            cons: ['Cycles and tangled releases', 'No module can be shown alone'],
          },
        ],
        chosen: 'Props, callbacks and slots from the app',
        why: 'The architecture document states it as a rule: modules "do not know about each other, about the router, or about where data comes from. The app passes that in", and maps it to dependency inversion: modules declare callbacks (`onChange`, `onSearchChange`, `rebalance`), the app supplies them.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/architecture.md', note: 'the composition example and "How the principles map"' },
        ],
      },
      {
        question: 'What enforces the boundaries?',
        options: [
          {
            name: 'Nx enforce-module-boundaries',
            pros: ['Tag-based rules built for this'],
            cons: ['Runs through typescript-eslint, which needs the TypeScript compiler API'],
          },
          {
            name: 'Oxlint overrides per folder, plus Steiger',
            pros: ['Runs on TypeScript 7', 'Same speed as the rest of the lint', 'Steiger checks the layers inside'],
            cons: ['Rules are written per path instead of per tag'],
          },
          {
            name: 'Convention and review',
            pros: ['Nothing to configure'],
            cons: ['Breaks silently on the first hurried change'],
          },
        ],
        chosen: 'Oxlint overrides per folder, plus Steiger',
        why: 'The commit says why the Nx plugin is out: "it loads typescript-eslint, which cannot run on TypeScript 7". The tags are still set, so the plugin can replace the overrides once it supports TypeScript 7.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '60fdbe1' },
          { kind: 'file', ref: 'docs/architecture.md', note: '"Dependency rules"' },
        ],
      },
      {
        question: 'How is the inside of a module organised?',
        options: [
          {
            name: 'Feature-Sliced Design',
            pros: ['A known vocabulary: pages, widgets, features, shared', 'A linter exists for it'],
            cons: ['Many small folders with an `index.ts` each', 'Slices used once look like ceremony'],
          },
          {
            name: 'Folders by kind (components, hooks, utils)',
            pros: ['Familiar'],
            cons: ['Says nothing about what may import what', 'Everything ends up in components/'],
          },
        ],
        chosen: 'Feature-Sliced Design',
        why: 'The repository adopts FSD 2.1 and keeps even single-use slices separate because "each module is laid out for growth" (the Steiger config). The comparison with other layouts is ours.',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'steiger.config.ts', note: 'why `fsd/insignificant-slice` is off' },
          { kind: 'doc', ref: 'https://feature-sliced.design/' },
        ],
      },
    ],
    steps: [
      {
        title: 'Make a module a package',
        detail:
          'A module is a workspace package like any other: a name under `@lc/`, `exports` pointing at its TypeScript source (no build step), its dependencies listed, and the `type:module` tag. React is a peer dependency: the app provides the one copy.',
        files: [
          {
            path: 'modules/calendar-export/package.json',
            lines: [1, 35],
            note: '`exports`, the allowed dependencies, `peerDependencies` and the Nx tag',
          },
          {
            path: 'modules/calendar-export/tsconfig.json',
            note: 'extends the base config; no path aliases inside a module',
          },
        ],
        commit: 'cf289bd',
      },
      {
        title: 'Give it one public entry',
        detail:
          "Everything other packages may use is re-exported from `src/index.ts`. When the planner split out, its entry exported the page, the URL search parser and the state's types, nothing else.",
        files: [
          {
            path: 'modules/planner/src/index.ts',
            lines: [1, 7],
            at: 'cf289bd',
            note: 'the first public API of the planner module',
          },
        ],
      },
      {
        title: 'Move the UI into layers',
        detail:
          "Each block of the old route found its layer: the week grid, the agenda, the budget panel and the runway became widgets; editing an event, filtering calendars and opening a plan file became features; `useNow` went to `shared`. The page imports them only through each slice's `index.ts`.",
        files: [
          {
            path: 'modules/planner/src/pages/planner/ui/PlannerPage.tsx',
            lines: [19, 27],
            at: 'cf289bd',
            note: 'a page importing features, widgets and shared, each through its slice entry',
          },
        ],
      },
      {
        title: 'Invert the dependencies',
        detail:
          'The page declares what it needs instead of importing it: the state, the URL search and a callback to change it, a callback that saves an edit, a slot next to the title and a render prop for actions on the shown plan. The export module is no import of the planner; the app passes it in through `renderActions`.',
        files: [
          {
            path: 'modules/planner/src/pages/planner/ui/PlannerPage.tsx',
            lines: [37, 48],
            at: 'cf289bd',
            note: 'the props: data, callbacks, a slot and a render prop',
          },
        ],
      },
      {
        title: 'Compose in the app',
        detail:
          "The route file is now wiring only: it validates the search with the module's parser, loads state with a server function and connects callbacks to `navigate`, server functions and `router.invalidate()`. Compare its size at the split with what it wires at the pinned commit: the shape held while the planner grew.",
        files: [
          {
            path: 'apps/web/src/routes/index.tsx',
            lines: [1, 31],
            at: 'cf289bd',
            note: 'the shell route right after the split',
          },
          {
            path: 'apps/web/src/routes/index.tsx',
            lines: [55, 139],
            note: 'the same route at the pinned commit: more callbacks, same role',
          },
        ],
      },
      {
        title: 'Make the walls hold',
        detail:
          'Oxlint overrides restrict imports by folder: a module may import the domain, the UI kit and the translations, never another module, `@lc/plan-data`, `node:*` or TanStack Start. Steiger checks the layers inside each module, and `pnpm run lint` runs both through Nx.',
        files: [
          { path: '.oxlintrc.json', lines: [172, 195], note: 'the `modules/**` override and its three messages' },
          {
            path: 'steiger.config.ts',
            lines: [1, 12],
            note: 'the recommended FSD rules, with one switched off and why',
          },
          { path: 'package.json', lines: [18, 18], note: '`lint` runs `lint` and `lint:fsd` in every project' },
        ],
        commands: ['pnpm run lint'],
        commit: '60fdbe1',
      },
      {
        title: 'Prove the shape with a third module',
        detail:
          'The progress dashboard was added later as `@lc/dashboard`, copying the shape of `calendar-export`: a package, layers, one entry and a route in the app. The lint rule for `modules/**` needed no change.',
        files: [
          { path: 'modules/dashboard/src/index.ts', note: 'its public entry' },
          { path: 'apps/web/src/routes/dashboard.tsx', note: 'the route that renders it' },
        ],
        commit: '632e3aa',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm exec nx run-many -t typecheck --projects=tag:type:module',
        'pnpm --filter @lc/planner run lint:fsd',
        'pnpm exec nx graph',
      ],
      expect: [
        'typecheck runs for `@lc/planner`, `@lc/calendar-export` and `@lc/dashboard` only',
        'Steiger reports no problems in the planner module',
        'the project graph shows `@lc/web` depending on the three modules and no module depending on another',
        'adding `import \'@lc/planner\'` to a file in `modules/dashboard` makes `pnpm run lint` fail with "A module never imports another module or the app"',
      ],
      quiz: [
        {
          question: 'Why can the planner module not call a server function itself?',
          options: [
            'Server functions only work in route files',
            'The lint rule for `modules/**` forbids `@tanstack/react-start`: the app owns transport and passes callbacks in',
            'Server functions are slower than props',
          ],
          answer: 1,
          explanation:
            'Modules are "browser-safe and transport-free". The app decides how a change is stored and hands the module an `onChange` callback.',
        },
        {
          question:
            'How does the export dialog end up inside the planner page without either module importing the other?',
          options: [
            'Through a shared global store',
            'The planner imports it lazily',
            'The app passes it through a render prop (`renderActions`, later `renderExport`)',
          ],
          answer: 2,
          explanation: 'The page calls the render prop with its own data; the app decides what to render there.',
        },
        {
          question: 'What does build-time composition give up compared with Module Federation?',
          options: ['Typed props across modules', 'Deploying a module without rebuilding the app', 'Server rendering'],
          answer: 1,
          explanation:
            'Everything ships as one bundle; in exchange, types and server rendering work across modules as if they were one app.',
        },
      ],
    },
    pitfalls: [
      "Tailwind does not scan packages linked through `node_modules`: the app's stylesheet needs `@source` lines for `packages/ui/src` and `modules`, or classes used only inside a module are missing from the CSS.",
      'Paraglide writes its compiled messages to one folder that the app, the modules and the stand all read; the plugin is pointed at `packages/i18n/src/paraglide` explicitly (see `apps/web/vite.config.ts`).',
      'A slice that imports another slice of the same layer passes TypeScript but fails Steiger: lift the shared part a layer down or compose both one layer up.',
    ],
    tradeoffs: [
      'One release train: a fix in a module ships only with a build of the whole app.',
      'Route files grow into wiring diagrams; the planner route at the pinned commit passes more than fifteen props.',
      'Path-based lint rules are less expressive than tag rules, and a new kind of package needs a new override.',
      'FSD adds many small folders; a reader has to learn the vocabulary before the layout helps.',
    ],
    links: [
      { label: 'Feature-Sliced Design', href: 'https://feature-sliced.design/' },
      { label: 'Steiger', href: 'https://github.com/feature-sliced/steiger' },
      { label: 'pnpm workspaces', href: 'https://pnpm.io/workspaces' },
      { label: 'Nx: enforce module boundaries', href: 'https://nx.dev/features/enforce-module-boundaries' },
      { label: 'Oxlint configuration', href: 'https://oxc.rs/docs/guide/usage/linter/config.html' },
      { label: 'Micro Frontends (Cam Jackson)', href: 'https://martinfowler.com/articles/micro-frontends.html' },
    ],
    next: 'Three modules, five packages and one app: CI should check what a change touches, not everything every time.',
  },
  {
    id: 'shipping',
    summary:
      'Where each part of the project can run, what it costs and what would have to change. The planner needs a Node server with a writable disk; the docs, their federation remote and the component stand are static files. The chapter compares hosts on price, server rendering, API routes and storage, and shows the parts of the code that decide it.',
    whereWeAre:
      'The planner is complete and accessible (chapter 21). CI checks every change and builds the component stand (chapters 12 and 13). Nothing is deployed: the app runs on a laptop with `pnpm dev`, and `apps/web` already has a `start` script for its production build.',
    problem:
      'To use the planner from a phone or share the guide, both have to live somewhere. They are different kinds of software: the planner renders on the server, answers `/api/*` requests (calendar feeds, OAuth callbacks, the plan for MCP clients), writes JSON files on every edit and solves an integer program with a WebAssembly build of HiGHS. The guide is HTML, CSS and JavaScript. A host that is cheap for one can be impossible for the other.',
    outcomes: [
      'say what server rendering, API routes and a writable disk demand from a host',
      'compare long-lived servers, serverless functions, edge workers and static hosts for a given app',
      'find the cheapest host that runs the planner without code changes, and know its limits',
      'run the planner read-only where there is no writable disk',
      'deploy static outputs to GitHub Pages and live with its fixed cache headers',
    ],
    concepts: [
      {
        term: 'Server rendering handler',
        explanation:
          "TanStack Start builds the server side as a Nitro output: `node .output/server/index.mjs` starts an HTTP server that renders pages, runs server functions and serves `/api/*` routes. Any host that runs a Node process, or one of Nitro's deployment presets, can serve it; a host that only serves files cannot.",
        link: { label: 'Nitro deploy presets', href: 'https://nitro.build/deploy' },
      },
      {
        term: 'Long-lived process vs serverless function',
        explanation:
          'A long-lived process (a VM, a container that stays up) keeps memory and a disk between requests. A serverless function may start fresh for each request and is stopped afterwards: fine for reading, wrong for "write this file and read it on the next request".',
      },
      {
        term: 'Persistent volume',
        explanation:
          'A disk attached to a container that survives restarts and deploys. On Fly.io and Railway it is mounted at a path you choose; the planner finds its data there through `PLAN_DATA_DIR`. A volume belongs to one machine, so there is one instance and a short gap on each deploy.',
        link: { label: 'Railway volumes', href: 'https://docs.railway.com/reference/volumes' },
      },
      {
        term: 'Build-time vs run-time configuration',
        explanation:
          'A `VITE_*` variable is replaced in the code when it is built: changing it means building again. `process.env` on the server is read when the code runs: the same build serves every environment. URLs that differ per environment belong to the second kind.',
      },
      {
        term: 'Cache-Control and content hashes',
        explanation:
          'A file whose name contains a hash of its content can be cached forever: a new version has a new name. Files with fixed names (HTML, a manifest) must be revalidated, or browsers keep the old one for as long as `max-age` says.',
      },
      {
        term: 'CORS',
        explanation:
          'A page may load a script from another origin with a plain `<script>`, but a module loaded with `import()` or `fetch` needs the other origin to allow it with `Access-Control-Allow-Origin`. A federation remote on another host is exactly that case.',
        link: { label: 'CORS — MDN', href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS' },
      },
    ],
    decisions: [
      {
        question: 'What kind of host does the planner need?',
        options: [
          {
            name: 'A long-lived Node process with a volume (Fly.io, Railway, a VPS)',
            pros: [
              'Runs the build as it is',
              'Real files: the store, the history, the sync state',
              'Background work and cron are possible',
            ],
            cons: ['One machine per volume: no replicas, a short gap per deploy', 'You size and pay for a machine'],
          },
          {
            name: 'Serverless functions (Vercel, Netlify)',
            pros: ['$0 to start', 'Previews per branch'],
            cons: [
              'Read-only file system: edits, history and calendar tokens need another store',
              'Cron limited (once a day on Vercel Hobby)',
            ],
          },
          {
            name: 'An edge worker (Cloudflare Workers)',
            pros: ['Fast everywhere'],
            cons: [
              '10 ms of CPU per request on the free plan: no room for a solve',
              '`node:fs` is virtual; HiGHS must be imported as a module',
            ],
          },
          {
            name: 'A container scaled to zero (Cloud Run, Azure Container Apps)',
            pros: ['About $0 for one person', 'Real container'],
            cons: ['Storage only as a network mount (no file locking, last write wins)', 'Cold starts'],
          },
        ],
        chosen: 'A long-lived Node process with a volume (Fly.io, Railway, a VPS)',
        why: '`packages/plan-data/src/store.ts` (today the `fs` adapter in `packages/plan-data/src/fs/`) reads and writes files on every edit and is the only writer by design, so a host with a real disk runs the planner unchanged. Moving to serverless would need a second, database-backed implementation of the `PlanRepository` port, which `plan-data/fs` implements today. The project has not deployed the planner yet: this is the recommendation of the research, not a recorded decision.',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'docs/deployment-research.md', note: 'the full matrix with prices and limits' },
          { kind: 'file', ref: 'packages/plan-data/src/store.ts', note: 'every write goes through this file' },
          { kind: 'doc', ref: 'https://tanstack.com/start/latest/docs/framework/react/guide/hosting' },
        ],
      },
      {
        question: 'Which host is cheapest for that?',
        options: [
          {
            name: 'Fly.io, 512 MB + 1 GB volume',
            pros: ['$3.84 a month, inside the $5 of monthly usage given once a card is on file'],
            cons: ["Not on TanStack's list of partners", 'You write the Dockerfile or let `fly launch` do it'],
          },
          {
            name: 'Railway Hobby',
            pros: ['$5 flat with $5 of usage', 'Official TanStack Start partner, Nitro with zero config'],
            cons: ['A volume caps at 5 GB on Hobby'],
          },
          {
            name: 'Hetzner CX23',
            pros: ['A whole VM, real cron'],
            cons: ['€5.99 + VAT', 'You run the OS, TLS, backups and deploys'],
          },
          {
            name: 'Render Starter',
            pros: ['Simple dashboard'],
            cons: ['$7.25 with a disk', 'A disk rules out zero-downtime deploys'],
          },
        ],
        chosen: 'Fly.io, 512 MB + 1 GB volume',
        why: 'It is the cheapest option that runs the build unchanged with a real disk: effectively $0 for one person. Railway is the better value when "zero config" matters more than $5. Prices were read on 2026-11-23/24 and change; the research document lists the pages.',
        evidence: 'inferred',
        sources: [
          { kind: 'doc', ref: 'https://docs.fly.io/about/pricing' },
          { kind: 'doc', ref: 'https://railway.com/pricing' },
          { kind: 'file', ref: 'docs/deployment-research.md' },
        ],
      },
      {
        question: 'Can the planner run where there is no writable disk?',
        options: [
          {
            name: 'Read-only, as it is',
            pros: [
              'No code change: `canWrite()` is false and the editing controls disappear',
              'The plan comes from the bundled `plan.json`',
            ],
            cons: ['No edits, no history, no calendar sync', 'Not tried on a serverless host yet'],
          },
          {
            name: 'Replace the file store',
            pros: ['Full planner on serverless and edge hosts'],
            cons: ['A storage interface and a database implementation to write and migrate to'],
          },
        ],
        chosen: 'Read-only, as it is',
        why: 'The store already treats an unwritable plan file, or `PLAN_READONLY=1`, as a read-only host, and falls back to the plan bundled at build time when the file is missing. That makes a public, read-only showcase possible anywhere that runs Node. That it works unchanged on Vercel or Netlify is our reading of the code, not something the project has tested.',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'packages/plan-data/src/store.ts', note: '`canWrite()` and the `bundledPlan` fallback' },
          {
            kind: 'commit',
            ref: 'd9eac79',
            note: 're-balancing "stores nothing, so it also runs on a read-only host"',
          },
        ],
      },
      {
        question: 'Where do the docs, their remote and the component stand go?',
        options: [
          {
            name: 'GitHub Pages',
            pros: ['$0, no account beyond the repository', 'Sends `Access-Control-Allow-Origin: *` (checked live)'],
            cons: [
              'No headers of your own: `max-age=600` on everything',
              'No previews per pull request',
              'One site per repository',
            ],
          },
          {
            name: 'Cloudflare Workers static assets',
            pros: ['$0 with unlimited static requests', '`_headers` for CORS and `immutable`', 'Previews per branch'],
            cons: ['A Cloudflare account and an API token in CI'],
          },
          {
            name: 'Netlify',
            pros: ['Previews', '`_headers`'],
            cons: ['15 credits per production deploy out of 300; every project pauses when they run out'],
          },
        ],
        chosen: 'GitHub Pages',
        why: 'Nothing to sign up for and nothing to pay, and its default CORS header is enough for the planner to import the remote. Its fixed ten-minute cache is handled in the build: every chunk and the remote entry have hashed names, and the host asks for the manifest with a query that changes on every load. Cloudflare is the upgrade if per-path headers or previews become necessary.',
        evidence: 'evidenced',
        sources: [
          {
            kind: 'file',
            ref: '.github/workflows/docs.yml',
            note: 'builds the site, the remote and the stand and deploys them as one Pages artifact',
          },
          { kind: 'file', ref: 'docs/deployment-research.md', note: '"Living with max-age=600 on GitHub Pages"' },
          {
            kind: 'doc',
            ref: 'https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits',
          },
        ],
      },
    ],
    steps: [
      {
        title: 'Build the server and start it',
        detail:
          'The production build writes `.output/`: static client files and a Node server. `start` runs that server; it listens on `PORT` (3000 by default). This is what any Node host runs.',
        files: [{ path: 'apps/web/package.json', lines: [7, 10], note: '`build` and `start`' }],
        commands: ['pnpm --filter @lc/web build', 'pnpm --filter @lc/web start'],
      },
      {
        title: 'Ship the solver with the server',
        detail:
          "HiGHS loads `highs.wasm` from next to its own file with `new URL`, which the bundler's file tracer cannot follow. The config keeps the package external and copies it whole into the output, so re-balancing works in production.",
        files: [
          {
            path: 'apps/web/vite.config.ts',
            lines: [10, 23],
            note: "`ssr.external` and Nitro's `traceDeps` for highs",
          },
        ],
      },
      {
        title: 'Point the store at a volume',
        detail:
          'The store looks for `packages/plan-data/data` upwards from the working directory, which a container does not have. `PLAN_DATA_DIR` names the directory instead: mount the volume there and copy `plan.json` into it once.',
        files: [{ path: 'packages/plan-data/src/store.ts', lines: [29, 38], note: '`dataDir()` and `PLAN_DATA_DIR`' }],
      },
      {
        title: 'Decide between editing and read-only',
        detail:
          '`canWrite()` decides whether the planner shows its editing controls: false when `PLAN_READONLY=1` or when the plan file is not writable. A public demo sets the variable; a personal deployment leaves it unset and keeps the volume writable.',
        files: [{ path: 'packages/plan-data/src/store.ts', lines: [125, 134], note: '`canWrite()`' }],
      },
      {
        title: 'Know which settings are baked in',
        detail:
          'The stand link is a `VITE_*` variable: it is fixed when the planner is built. The docs remote URL is read on the server at run time instead (chapter 23), so one build of the planner can point at a staging or a production guide.',
        files: [
          { path: 'apps/web/src/shell/ShellAside.tsx', lines: [10, 14], note: '`VITE_STAND_URL`, read at build time' },
        ],
      },
      {
        title: 'Deploy the static outputs to GitHub Pages',
        detail:
          'One workflow builds the guide (pre-rendered pages and the search index), the federation remote under `remote/v1/` and the component stand under `stand/`, and uploads them as one Pages artifact. The base path comes from the repository name, because a project site lives at `https://<owner>.github.io/<repo>/`.',
        files: [{ path: '.github/workflows/docs.yml', at: 'main', note: 'build, assemble and deploy' }],
      },
      {
        title: 'Make stale caches harmless',
        detail:
          'Pages caches every file for ten minutes and lets nobody change that. Chunks carry content hashes already; the remote entry gets one too (`remoteEntry-[hash].js`), and the planner requests `mf-manifest.json` with a changing query. The only fixed name a host asks for is never served from the browser cache.',
        files: [
          {
            path: 'apps/docs/vite.remote.config.ts',
            at: 'main',
            note: "`filename: 'remoteEntry-[hash].js'` and `publicPath: 'auto'`",
          },
        ],
      },
    ],
    checkpoint: {
      commands: [
        'pnpm --filter @lc/web build',
        'PLAN_READONLY=1 pnpm --filter @lc/web start',
        'curl -sI https://pages.github.com/ | grep -i -E "cache-control|access-control"',
      ],
      expect: [
        'the server prints the address it listens on',
        'the planner opens without its editing controls: no drag, no edit dialog, no undo',
        'GitHub Pages answers with `access-control-allow-origin: *` and `cache-control: max-age=600`',
      ],
      quiz: [
        {
          question: 'Why does the planner not run unchanged on Vercel with edits enabled?',
          options: [
            'Vercel cannot render React on the server',
            'Its functions have a read-only file system, and the planner stores every edit in JSON files',
            'Vercel blocks WebAssembly',
          ],
          answer: 1,
          explanation:
            'Server rendering works there; persistence does not. The planner falls back to read-only when it cannot write.',
        },
        {
          question: "What makes GitHub Pages' fixed `max-age=600` harmless for the federation remote?",
          options: [
            'Hashed chunk and entry names, and a manifest URL with a query that changes per load',
            'A service worker',
            'Pages purges its cache on every deploy',
          ],
          answer: 0,
          explanation:
            'New content gets new file names; the one fixed name, the manifest, is fetched with a fresh query each time.',
        },
        {
          question: 'Where should a URL that differs between staging and production come from?',
          options: [
            'A `VITE_*` variable',
            'A constant in the code',
            'An environment variable read by the server at run time',
          ],
          answer: 2,
          explanation:
            'Build-time variables are frozen into the bundle; a server-read variable lets one build serve every environment.',
        },
      ],
    },
    pitfalls: [
      'A volume is attached to one machine: scaling the planner to two instances would give each its own copy of the plan.',
      'Fly.io and Railway bill usage: a machine left running at a bigger size quietly leaves the free allowance.',
      'GitHub Pages serves a project site under `/<repo>/`: every absolute link in the static build needs that base path.',
      '`data/local.json` holds secrets (calendar client secrets, the busy feed URL). It is untracked: on a server it lives on the volume, never in the image.',
    ],
    tradeoffs: [
      'One machine with one volume is simple and nearly free, but every deploy is a short outage and there is no failover.',
      'GitHub Pages costs nothing and needs no account, but gives no headers, no previews and a ten-minute cache on every file.',
      'Read-only mode makes a public demo possible anywhere, at the price of everything that writes.',
      'Prices and free tiers change; the research has a date for a reason.',
    ],
    links: [
      {
        label: 'TanStack Start: hosting',
        href: 'https://tanstack.com/start/latest/docs/framework/react/guide/hosting',
      },
      { label: 'Nitro deploy presets', href: 'https://nitro.build/deploy' },
      { label: 'Fly.io pricing', href: 'https://docs.fly.io/about/pricing' },
      { label: 'Railway pricing', href: 'https://railway.com/pricing' },
      {
        label: 'GitHub Pages limits',
        href: 'https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits',
      },
      { label: 'actions/deploy-pages', href: 'https://github.com/actions/deploy-pages' },
      {
        label: 'Cloudflare Workers static assets: headers',
        href: 'https://developers.cloudflare.com/workers/static-assets/headers/',
      },
    ],
    next: 'The guide is a separate deployable now. Next: show it inside the planner, loaded at run time, without rebuilding the planner when the guide changes.',
  },
  {
    id: 'module-federation',
    summary:
      'The planner shows this guide in a drawer, loaded at run time from wherever the guide is deployed. The guide builds a Module Federation remote; the planner loads it with the federation runtime alone, on the first click, and shares its React with it.',
    whereWeAre:
      'Modules are composed at build time (chapter 11) and the guide is a static site deployed on its own (chapter 22). The planner links to the component stand but knows nothing about the guide.',
    problem:
      'Help belongs next to the screen it explains, and the guide changes far more often than the planner. Bundling the guide into the planner would grow its JavaScript and tie every edit of a chapter to a planner release. A link only sends people away. The guide has to be part of the page while still being deployed on its own.',
    outcomes: [
      'explain hosts, remotes, containers, manifests and shared scopes',
      'build a remote with `@module-federation/vite` and read its manifest',
      'load a remote from a host with the runtime API only, on demand',
      'share React as a singleton and check what the remote actually downloaded',
      'configure the remote URL per environment without rebuilding the host',
    ],
    concepts: [
      {
        term: 'Host and remote',
        explanation:
          'A remote is a build that exposes modules (`lc_docs/help`). A host is an app that loads them at run time. The same project can be both. Here the guide is the remote and the planner, or the test harness, is the host.',
        link: { label: 'Module Federation glossary', href: 'https://module-federation.io/guide/start/glossary.html' },
      },
      {
        term: 'Container and remote entry',
        explanation:
          "The remote's build emits an entry script (the container) with two functions: `init(shareScope)` receives the host's shared modules, `get('./help')` returns a factory for an exposed module. Everything else is ordinary chunks the entry imports.",
      },
      {
        term: 'Manifest',
        explanation:
          '`mf-manifest.json` describes a remote: its name, its entry file, what it exposes, what it shares and with which versions. A host that loads the manifest instead of the entry can find a hashed entry name and check versions before running any remote code.',
        link: { label: 'Manifest fields', href: 'https://module-federation.io/guide/advanced/manifest-fields.html' },
      },
      {
        term: 'Shared scope, singleton, requiredVersion',
        explanation:
          'Dependencies both sides use can be shared: the host registers its copy, the remote takes it instead of downloading its own. `singleton` allows one copy on the page; `requiredVersion` is the range the remote accepts. React must be a singleton: two copies break hooks inside one tree.',
        link: { label: 'shared configuration', href: 'https://module-federation.io/configure/shared.html' },
      },
      {
        term: 'Runtime-only host',
        explanation:
          '`@module-federation/runtime` can create an instance (`createInstance`) and load a remote (`loadRemote`) from plain code, without a bundler plugin on the host. The host build does not change; the runtime is in a chunk that loads with the first `import()`.',
        link: { label: 'Runtime API', href: 'https://module-federation.io/guide/runtime/runtime-api.html' },
      },
      {
        term: "publicPath: 'auto'",
        explanation:
          "Where a remote's chunks live is inferred from the URL its manifest was loaded from. The same files can be served from any origin and path; nothing about the deployment is baked into the build.",
      },
    ],
    decisions: [
      {
        question: 'How does the planner show the guide?',
        options: [
          {
            name: 'A link to the site',
            pros: ['Nothing to build'],
            cons: ['Leaves the planner', 'No context of the current screen'],
          },
          {
            name: 'An iframe',
            pros: ['Complete isolation'],
            cons: [
              'Its own React and fonts',
              'Theme and language need a message protocol',
              'Focus and sizing are awkward',
            ],
          },
          {
            name: 'A Module Federation remote',
            pros: ['Shares React with the host', 'Deploys on its own', 'A typed contract instead of messages'],
            cons: ['Version skew between host and remote', 'Styles need isolating by hand'],
          },
        ],
        chosen: 'A Module Federation remote',
        why: 'The guide must deploy without the planner and still feel part of it: same theme, same language, no second React. Federation gives exactly that, provided the contract and the styles are handled deliberately (chapter 24).',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'apps/docs/README.md', note: 'two modes from one codebase' },
          { kind: 'file', ref: 'packages/docs-contract/CHANGELOG.md' },
        ],
      },
      {
        question: 'Which side gets a bundler plugin?',
        options: [
          {
            name: 'Both: `@module-federation/vite` in the planner too',
            pros: ['Type hints and dev tooling'],
            cons: [
              "Changes the planner's SSR build and its first-load script",
              'A plugin to keep in step with TanStack Start',
            ],
          },
          {
            name: 'Import maps (`hostProvidesAllShared`)',
            pros: ['No federation runtime at all'],
            cons: [
              'The map is fixed when the host is built: no per-environment URL',
              'Needs an `index.html` to inject into, which TanStack Start does not have',
            ],
          },
          {
            name: 'Plugin on the remote, runtime only in the host',
            pros: [
              'The planner build is untouched',
              'Nothing loads before the first click',
              'The URL is just a value at run time',
            ],
            cons: ['No generated types: the contract package carries them', 'Shared modules are listed by hand'],
          },
        ],
        chosen: 'Plugin on the remote, runtime only in the host',
        why: 'The requirement is "nothing added to the host\'s initial bundle" and "remote URLs configurable per environment without rebuilding the host". The runtime API meets both: it is imported inside the click handler, and the manifest URL comes from the server.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'packages/remote-host/src/load-remote.ts', note: 'the loader both hosts use' },
          { kind: 'doc', ref: 'https://module-federation.io/guide/runtime/runtime-api.html' },
        ],
      },
      {
        question: 'What do host and remote share?',
        options: [
          {
            name: 'React, ReactDOM and their entry points, as singletons',
            pros: ['One React on the page', 'The remote downloads no React'],
            cons: ['Both sides must stay within `^19.3.0`'],
          },
          {
            name: 'Nothing',
            pros: ['No version coupling'],
            cons: ['A second React (about 60 KB gzipped)', 'Two React roots that cannot share context anyway'],
          },
          {
            name: 'React and the router',
            pros: ['Smaller remote'],
            cons: ["Couples the guide to the planner's router version for no gain: they never share a tree"],
          },
        ],
        chosen: 'React, ReactDOM and their entry points, as singletons',
        why: 'React is the heavy, version-sensitive part. The router is bundled into the remote on purpose: the drawer has its own memory router and must not depend on which router version the host runs.',
        evidence: 'evidenced',
        sources: [{ kind: 'file', ref: 'apps/docs/vite.remote.config.ts', note: '`shared`' }],
      },
      {
        question: 'How does the planner learn where the remote is?',
        options: [
          {
            name: 'A `VITE_*` variable',
            pros: ['Simple'],
            cons: ['Baked into the build: a new URL means a new planner build'],
          },
          {
            name: 'An environment variable read by a server function',
            pros: ['One build, any environment', 'Unset means no docs button at all'],
            cons: ['One request before the first load (cached by the router)'],
          },
        ],
        chosen: 'An environment variable read by a server function',
        why: 'Staging and production planners can point at different guides, or none, from the same build.',
        evidence: 'evidenced',
        sources: [{ kind: 'file', ref: 'apps/web/src/server/docs.ts' }],
      },
    ],
    steps: [
      {
        title: 'Build the remote',
        detail:
          'A second Vite config builds the same sources as a federation container: it exposes `./help`, shares the React family as singletons, writes `mf-manifest.json`, hashes the entry name and infers its public path from the manifest URL. It outputs into the site under `remote/v1/`, so one deployment serves both.',
        files: [{ path: 'apps/docs/vite.remote.config.ts', at: 'main', note: 'the federation plugin options' }],
        commands: ['pnpm --filter @lc/docs build', 'cat apps/docs/dist/client/remote/v1/mf-manifest.json'],
      },
      {
        title: 'Expose one module with a small API',
        detail:
          "The exposed module exports `version` and `createDocsHost(options)`. It does not export React components: a component would tie the host to the remote's props and React internals, while a function with a typed result is a contract that survives refactoring on either side.",
        files: [
          { path: 'apps/docs/src/remote/help.tsx', at: 'main', note: '`createDocsHost` and the instance it returns' },
        ],
      },
      {
        title: 'Load it from the host on demand',
        detail:
          "The loader creates a federation instance with the host's own React modules as the shared providers, registers the remote by its manifest URL with a cache-busting query, loads `lc_docs/help`, checks the module's shape and its contract version, and gives up after a timeout. The host imports the loader with `import()` inside the click handler.",
        files: [
          {
            path: 'packages/remote-host/src/load-remote.ts',
            at: 'main',
            note: '`createInstance`, `loadRemote`, the version check and the timeout',
          },
        ],
      },
      {
        title: 'Read the URL on the server',
        detail:
          'A server function returns `DOCS_REMOTE_URL` and `DOCS_SITE_URL` from the environment. When the first is unset the planner shows no docs button, so a deployment without a guide needs no change.',
        files: [{ path: 'apps/web/src/server/docs.ts', at: 'main', note: 'the server function' }],
      },
      {
        title: 'Check what was shared',
        detail:
          "Open the network panel, click the docs button and look at what comes from the guide's origin: the manifest, the hashed entry and the guide's own chunks, but no React. The harness test asserts the same thing.",
        files: [
          {
            path: 'apps/docs-harness/tests/remote.spec.ts',
            at: 'main',
            note: 'the test that nothing loads before the click, and React is not downloaded twice',
          },
        ],
        commands: ['pnpm --filter @lc/docs-harness test'],
      },
    ],
    checkpoint: {
      commands: [
        'pnpm --filter @lc/docs build',
        'pnpm --filter @lc/docs preview',
        'pnpm --filter @lc/docs-harness dev',
      ],
      expect: [
        'the harness page loads with no request to port 4310',
        'the first click on "Docs" requests `mf-manifest.json?v=…`, then `remoteEntry-<hash>.js`, then the drawer\'s chunks',
        'no `react` or `react-dom` chunk is requested from the guide',
        "with the guide's preview stopped, the button shows a link to the site instead of the drawer",
      ],
      quiz: [
        {
          question: 'Why does the host load `mf-manifest.json` instead of the remote entry directly?',
          options: [
            'The entry name is hashed; the manifest has a fixed name and says which entry to load',
            'Browsers cannot import an entry from another origin',
            'The manifest is smaller',
          ],
          answer: 0,
          explanation:
            'Hashed names make long caching safe; the manifest is the one fixed name, fetched fresh each time.',
        },
        {
          question:
            'What happens if the remote is built with React 20 while the host provides React 19.3 as a singleton?',
          options: [
            'Both versions load side by side',
            "The runtime warns that the singleton does not satisfy `requiredVersion` and uses the host's copy",
            'The host downloads React 20',
          ],
          answer: 1,
          explanation:
            'A singleton is never duplicated. A mismatch is reported, which is why the contract major and the shared range must move together.',
        },
        {
          question: 'Why is the federation runtime imported inside the click handler?',
          options: [
            'It only works after a user gesture',
            "So nothing is added to the planner's first load",
            'Server rendering cannot import it',
          ],
          answer: 1,
          explanation:
            'A dynamic `import()` puts the runtime and the loader in their own chunk, fetched on the first click.',
        },
      ],
    },
    pitfalls: [
      "A Vite remote is an ES module: a runtime-only host must register it with `type: 'module'` or loading fails with a syntax error.",
      'Listing only `react` as shared is not enough: `react/jsx-runtime` and `react-dom/client` are separate modules and must be provided by the host too.',
      'A remote served without CORS headers fails only in production, where the origins differ.',
    ],
    tradeoffs: [
      'Run-time composition trades compile-time safety for independent deployment: the contract, its version check and the harness tests take over what the compiler did in chapter 11.',
      'The host pays a network round trip on first use, and needs a fallback for when the remote is down.',
      "Sharing React couples the remote to the host's major version; the contract changelog has to say so.",
    ],
    links: [
      { label: 'Module Federation', href: 'https://module-federation.io/guide/start/index.html' },
      { label: 'Runtime API', href: 'https://module-federation.io/guide/runtime/runtime-api.html' },
      { label: 'shared configuration', href: 'https://module-federation.io/configure/shared.html' },
      { label: '@module-federation/vite', href: 'https://github.com/module-federation/vite' },
      { label: 'Manifest fields', href: 'https://module-federation.io/guide/advanced/manifest-fields.html' },
      {
        label: 'Import maps — MDN',
        href: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap',
      },
    ],
    next: "A remote on someone else's page has to keep its styles, keys and URLs to itself: the contract and the isolation of this guide.",
  },
  {
    id: 'docs-remote',
    summary:
      'How this guide is built: one codebase that is both a pre-rendered static site in three languages and a federation remote inside the planner. A types-only contract package, shadow-DOM isolation in both directions, a memory router, locale and theme from the host, typed events, and a harness that proves it end to end.',
    whereWeAre:
      'The guide is a TanStack Start app pre-rendered to static files (chapter 22) and a federation remote the planner loads on demand (chapter 23).',
    problem:
      "Code that runs inside another app's page shares its document: its CSS can restyle the guide, the guide's CSS can restyle the host, a key typed in the guide can trigger the host's shortcuts, and a link can change the host's URL. The two sides also change at different times, so they need an agreement that says what may change without breaking the other.",
    outcomes: [
      'write a versioned, types-only contract between a host and a remote',
      'isolate a React tree in a shadow root, in both directions, including Tailwind v4 and fonts',
      "keep a remote off the host's URL, keyboard and global state",
      'take locale and theme from the host instead of reading them from the environment',
      'pre-render a multilingual static site with hreflang, a sitemap and per-language search',
      'test a remote in a host that mimics the real one',
    ],
    concepts: [
      {
        term: 'Contract package',
        explanation:
          '`@lc/docs-contract` holds only types, constants and pure helpers: the API of `lc_docs/help`, the events, the chapter catalogue. Both sides import it at build time; nothing in it runs code a host would ship. Its version follows semver, and `isCompatible` compares majors at run time.',
        link: { label: 'Semantic Versioning', href: 'https://semver.org/' },
      },
      {
        term: 'Shadow DOM',
        explanation:
          "A shadow root is a separate DOM tree attached to an element. Selectors from the page do not match inside it and selectors inside do not match outside. Inherited properties and CSS custom properties still flow in, which is how the guide wears the host's theme.",
        link: {
          label: 'Using shadow DOM — MDN',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM',
        },
      },
      {
        term: 'Constructable stylesheets',
        explanation:
          '`new CSSStyleSheet()` with `replaceSync(css)`, then `shadowRoot.adoptedStyleSheets = [sheet]`: the CSS is parsed once and attached without a `<style>` element. The remote imports its compiled Tailwind as a string (`?inline`).',
        link: {
          label: 'adoptedStyleSheets — MDN',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets',
        },
      },
      {
        term: '`@property` and shadow roots',
        explanation:
          'Registered custom properties (`@property`) only take effect at document level. Tailwind v4 declares initial values this way (`--tw-border-style`, shadows, transforms), so inside a shadow root borders and shadows silently vanish. The remote registers those rules on the document.',
        link: { label: 'tailwindcss#15005', href: 'https://github.com/tailwindlabs/tailwindcss/issues/15005' },
      },
      {
        term: 'Composed events',
        explanation:
          'Most UI events, key presses included, cross the shadow boundary and reach the document retargeted to the host element. A host shortcut bound on `document` would fire when someone types in the guide, unless the shadow root stops them.',
        link: {
          label: 'Event.composed — MDN',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Event/composed',
        },
      },
      {
        term: 'Memory history',
        explanation:
          "A router history kept in an array instead of the address bar. The drawer navigates between chapters with the same paths as the site, and the host's URL, back button and router never notice.",
        link: {
          label: 'History types — TanStack Router',
          href: 'https://tanstack.com/router/latest/docs/framework/react/guide/history-types',
        },
      },
      {
        term: 'Static pre-rendering',
        explanation:
          'TanStack Start renders every listed page at build time and writes it as `index.html`, following links it finds. The result is plain files any static host can serve, with full HTML for search engines and readers without JavaScript.',
        link: {
          label: 'Static prerendering — TanStack Start',
          href: 'https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering',
        },
      },
      {
        term: 'hreflang',
        explanation:
          '`<link rel="alternate" hreflang="ru" href="…">` on every page names the same page in each language, plus `x-default` for the language chooser. Search engines then show readers the version in their language.',
        link: {
          label: 'Localized versions — Google Search Central',
          href: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
        },
      },
    ],
    decisions: [
      {
        question: 'How do host and remote agree on an API?',
        options: [
          {
            name: 'A types-only workspace package with semver and a run-time major check',
            pros: [
              'Checked by the compiler on both sides',
              'Zero bytes in the host bundle',
              'A changelog says what changed',
            ],
            cons: ['Hosts outside the monorepo need it published'],
          },
          {
            name: 'Types generated by the federation plugin (`dts`)',
            pros: ['No package to maintain'],
            cons: ['Types of the implementation, not of an agreement', 'Generated at build, fetched at dev time'],
          },
          {
            name: 'No types: `any` at the boundary',
            pros: ['Nothing to maintain'],
            cons: ['Breaks at run time, in production'],
          },
        ],
        chosen: 'A types-only workspace package with semver and a run-time major check',
        why: "An agreement should be written on purpose and reviewed when it changes. The remote also declares itself against the contract (`const helpModule: DocsHelpModule = …`), so a drift fails the remote's own build.",
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'packages/docs-contract/src/index.ts' },
          {
            kind: 'file',
            ref: 'packages/docs-contract/CHANGELOG.md',
            note: 'the semver policy: a major goes to a new `remote/vN/` path',
          },
        ],
      },
      {
        question: 'How are styles isolated?',
        options: [
          {
            name: 'Shadow DOM with adopted stylesheets',
            pros: ['Isolation both ways, by the browser', 'Host tokens still inherit'],
            cons: [
              '`@property` and fonts must be handled at document level',
              'Portals into `document.body` would escape it',
            ],
          },
          {
            name: 'Prefixed classes or CSS Modules',
            pros: ['Simple'],
            cons: ["Protects the host from the guide, not the guide from the host's element selectors"],
          },
          {
            name: 'An iframe',
            pros: ['Total isolation'],
            cons: ['Theme, language and focus need a message protocol', 'Its own React'],
          },
        ],
        chosen: 'Shadow DOM with adopted stylesheets',
        why: 'Module Federation ships no style isolation. A shadow root isolates in both directions and still lets the host\'s custom properties through, which is what "the host controls the theme" needs. Dialogs use the native `<dialog>` in the top layer instead of portals, so nothing leaves the shadow root.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'apps/docs/src/remote/shadow.ts' },
          {
            kind: 'doc',
            ref: 'https://module-federation.io/guide/basic/css-isolate.html',
            note: '"Module Federation does not ship built-in style isolation"',
          },
        ],
      },
      {
        question: 'Who decides the language and the theme?',
        options: [
          {
            name: 'The host, through the context it passes and `update()`',
            pros: ['One source of truth', 'Works in any host'],
            cons: ['Every message call names its locale'],
          },
          {
            name: 'The remote reads the page (URL, `<html lang>`, a cookie)',
            pros: ['No API'],
            cons: ['Couples the remote to how one host stores its language'],
          },
        ],
        chosen: 'The host, through the context it passes and `update()`',
        why: "Paraglide normally finds the locale from a strategy (URL, cookie). Inside a host that strategy would read the host's URL. Every message is called with an explicit `{ locale }` from React context instead, and the site passes the `$locale` route parameter the same way.",
        evidence: 'evidenced',
        sources: [{ kind: 'file', ref: 'apps/docs/project.inlang/paraglide.config.ts' }],
      },
      {
        question: 'Which stack builds the guide?',
        options: [
          {
            name: 'TanStack Start, pre-rendered, plus a second Vite build for the remote',
            pros: ['Same React, router and tooling as the planner', 'One codebase for both modes'],
            cons: ['Two builds', 'No docs-specific features out of the box'],
          },
          {
            name: 'Astro or Starlight',
            pros: ['Made for docs'],
            cons: ['Its type checker does not run on TypeScript 7', 'A second framework to learn'],
          },
          {
            name: 'Rspress',
            pros: ['Docs features, Rspack speed'],
            cons: ['Its federation support targets Rspress hosts'],
          },
        ],
        chosen: 'TanStack Start, pre-rendered, plus a second Vite build for the remote',
        why: "The guide teaches the planner's stack, so it is built with it, and the same components render in both modes. Search (Pagefind), highlighting (Shiki at build time) and the walkthroughs are small additions.",
        evidence: 'evidenced',
        sources: [{ kind: 'file', ref: 'apps/docs/README.md', note: 'the stack and why' }],
      },
    ],
    steps: [
      {
        title: 'Write the contract',
        detail:
          'The contract names the exposed module, the context a host passes (locale, theme, tokens, feature, site URL), the targets it can open, the events it can hear and the `DocsHost` methods. A guard, `isDocsHelpModule`, checks what `loadRemote` returned without a cast.',
        files: [
          {
            path: 'packages/docs-contract/src/index.ts',
            at: 'main',
            note: 'types, `isCompatible`, `isDocsHelpModule`',
          },
          {
            path: 'packages/docs-contract/src/catalog.ts',
            at: 'main',
            note: 'parts, chapters, features and which chapter covers which slice',
          },
        ],
      },
      {
        title: 'Mount into a shadow root',
        detail:
          "`createDocsHost` creates one `<lc-docs>` element, attaches an open shadow root, adopts the compiled CSS, registers Tailwind's `@property` rules on the document, adds the font stylesheet unless the host has it, and renders a React root inside. `destroy()` removes all of it.",
        files: [
          {
            path: 'apps/docs/src/remote/help.tsx',
            at: 'main',
            note: 'the instance: state, events, `open`, `update`, `destroy`',
          },
          {
            path: 'apps/docs/src/remote/shadow.ts',
            at: 'main',
            note: 'what goes to the document and how it is removed',
          },
          {
            path: 'apps/docs/src/styles/remote.css',
            at: 'main',
            note: '`:host { all: initial }` and the token fallbacks',
          },
        ],
      },
      {
        title: 'Keep keys, URLs and focus inside',
        detail:
          "Key events are stopped at the shadow root. The drawer is a modal `<dialog>`: focus stays inside, Escape closes it and the host is inert behind it, all native. Links navigate a memory router with the site's own paths; the table of contents, whose anchors would change the host's URL, is not rendered in the drawer.",
        files: [
          { path: 'apps/docs/src/remote/router.tsx', at: 'main', note: "the memory router with the site's paths" },
          {
            path: 'apps/docs/src/remote/HelpApp.tsx',
            at: 'main',
            note: 'the `<dialog>`, the error boundary and the link to the full site',
          },
        ],
      },
      {
        title: 'Render the same components in both modes',
        detail:
          "Components read the locale, the site root and the stand URL from one React context and never from `document`, `window.location` or Paraglide's ambient locale. Layout uses container queries, because inside a drawer the viewport width says nothing about the room available.",
        files: [
          { path: 'apps/docs/src/app/env.tsx', at: 'main', note: 'the context' },
          {
            path: 'apps/docs/src/components/ChapterView.tsx',
            at: 'main',
            note: 'the chapter template, with `@container` breakpoints',
          },
        ],
      },
      {
        title: 'Pre-render three languages',
        detail:
          'The site config lists every page in every language; the build renders them, writes a sitemap with alternates, and every page names its translations in `<head>`. The root page picks a language from the browser and links to all three for crawlers. English is the source; a page not yet translated is shown in English with a notice.',
        files: [
          { path: 'apps/docs/vite.config.ts', at: 'main', note: '`pages`, `prerender` and `sitemap`' },
          { path: 'apps/docs/src/site-paths.ts', at: 'main', note: 'the list both the build and the pages use' },
          { path: 'apps/docs/src/routes/index.tsx', at: 'main', note: 'the language chooser and its redirect' },
        ],
      },
      {
        title: 'Show only real code',
        detail:
          'A code fence in a chapter names a file and lines; the MDX pipeline reads them from git at the pinned commit when the guide is built, so an excerpt cannot drift from the repository, and a wrong path fails the build.',
        files: [{ path: 'apps/docs/mdx.config.ts', at: 'main', note: '`remarkRepoCode` and the Shiki transformer' }],
      },
      {
        title: 'Prove it in a host that looks like the planner',
        detail:
          "The harness is a small Vite app with the planner's React version, UI kit tokens and shortcut hook, loading the remote with the same loader. Playwright checks that nothing loads before the click, that theme and language follow the host, that styles leak in neither direction, that typing in the guide does not trigger host shortcuts, and that a missing remote shows the fallback.",
        files: [
          { path: 'apps/docs-harness/src/main.tsx', at: 'main', note: 'the host' },
          { path: 'apps/docs-harness/tests/remote.spec.ts', at: 'main', note: 'the end-to-end checks' },
        ],
        commands: ['pnpm --filter @lc/docs-harness test'],
      },
    ],
    checkpoint: {
      commands: [
        'pnpm --filter @lc/docs build',
        'pnpm --filter @lc/docs preview',
        'pnpm --filter @lc/docs-harness test',
      ],
      expect: [
        '`dist/client` holds `ru/`, `en/` and `es/` folders, `sitemap.xml`, `pagefind/` and `remote/v1/mf-manifest.json`',
        "every page's `<head>` has four `hreflang` links",
        'all harness tests pass',
      ],
      quiz: [
        {
          question: 'Inside a shadow root, Tailwind borders disappear. Why?',
          options: [
            'Shadow roots do not support borders',
            '`@property` rules are ignored in shadow trees, so `--tw-border-style` has no initial value',
            "The host's CSS resets them",
          ],
          answer: 1,
          explanation: 'Tailwind v4 relies on registered custom properties; registering them on the document fixes it.',
        },
        {
          question: 'Why does the drawer stop key events at its shadow root?',
          options: [
            "Key events are composed: they would reach the host's document listeners, retargeted to the shadow host",
            'React needs it',
            'Dialogs require it',
          ],
          answer: 0,
          explanation:
            'The planner\'s shortcuts listen on the document; without this, typing "t" in the guide would switch the planner\'s view.',
        },
        {
          question: 'A change renames `DocsHost.open`. What version is the contract now, and where does the remote go?',
          options: ['1.1.0, same path', '2.0.0, a new `remote/v2/` next to `remote/v1/`', '1.0.1, same path'],
          answer: 1,
          explanation: 'A rename breaks hosts built against 1.x; they keep loading v1 until they upgrade.',
        },
      ],
    },
    pitfalls: [
      'Anything rendered into `document.body` (portals, toasts, tooltips from a UI library) leaves the shadow root and loses its styles.',
      'Media queries inside a shadow root still measure the viewport, not the drawer: use container queries for the layout.',
      "A hash link (`#section`) inside the remote changes the host's URL.",
      'Fonts declared with `@font-face` inside a shadow root are not loaded; fonts belong to the document.',
    ],
    tradeoffs: [
      'Shadow DOM isolates well but needs care with fonts, `@property` and anything that portals; the remote handles each by hand.',
      "Bundling a router into the remote costs bytes the host may already have, in exchange for independence from the host's router.",
      'Pre-rendering every page in three languages multiplies build time and output size; the English fallback keeps untranslated pages honest about it.',
      'A types-only contract cannot stop a host that skips the version check; the check lives in the shared loader for that reason.',
    ],
    links: [
      {
        label: 'Using shadow DOM — MDN',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM',
      },
      {
        label: 'adoptedStyleSheets — MDN',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets',
      },
      { label: '@property — MDN', href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/@property' },
      { label: '<dialog> — MDN', href: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog' },
      {
        label: 'Container queries — MDN',
        href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries',
      },
      {
        label: 'History types — TanStack Router',
        href: 'https://tanstack.com/router/latest/docs/framework/react/guide/history-types',
      },
      {
        label: 'Static prerendering — TanStack Start',
        href: 'https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering',
      },
      { label: 'Pagefind', href: 'https://pagefind.app/' },
      { label: 'Paraglide JS', href: 'https://inlang.com/m/gerre34r/library-inlang-paraglideJs' },
      { label: 'Playwright', href: 'https://playwright.dev/docs/intro' },
    ],
    next: 'This is the last chapter. The decision log and the glossary collect what the guide decided and explained along the way.',
  },
] satisfies readonly Syllabus[]

export { PIN as PART_5_PIN }
