import type { Syllabus } from './types'

export const PART_2 = [
  {
    id: 'edits-overlay',
    summary:
      'You add a second data file, `edits.json`, that keeps the changes made in the viewer as patches keyed by event uid, and you apply it on top of the generated schedule every time the plan is written. A TanStack Start server function stores a change, the route loader reads the plan from disk again, and the page shows the change before the server answers. By the end every edit is one `PlanChange` value handled by one pure reducer.',
    whereWeAre:
      'The plan is code: `content.ts` and `schedule.ts` produce `src/data/plan.json` through `pnpm run plan`, and the page imports that JSON at build time through `bundled.ts`. The viewer is read-only. It can show a plan file opened from disk, but nothing done in it is kept.',
    problem:
      'You want to move a session to another day from the viewer. If the viewer wrote into `plan.json`, the next `pnpm run plan` would rebuild the file from the content and erase the move. The page also bundles `plan.json` at build time, so even a saved change would not show until the next build. There is no place to keep a manual change, no code on the server to write it, and no way for the page to read fresh data.',
    outcomes: [
      'keep hand-made changes in an overlay file and apply them again whenever the generated data is rebuilt',
      'write a TanStack Start server function with `createServerFn`, validate its input, and call it from a component',
      'load page data in a route `loader` and refresh it with `router.invalidate()` after a mutation',
      'show a change at once with an optimistic preview that reuses the function the server runs',
      'model every edit as one member of a discriminated union and apply it with a pure reducer',
    ],
    concepts: [
      {
        term: 'Generated data plus an overlay',
        explanation:
          'The schedule is a build output: `buildPlan()` computes it from the course content, so it can be thrown away and rebuilt at any time. Manual changes go into a second file that says only what differs, keyed by the id of each event (`uid`). The plan on disk is always `applyEdits(buildPlan(), edits)`, so a rebuild never loses an edit.',
      },
      {
        term: 'A patch keeps only what differs',
        explanation:
          'A patch lists only the fields that differ from the generated event. Before writing, the server deletes every field equal to the original and drops a patch that ends up empty. `edits.json` stays a readable list of real changes, and moving an event back to its planned slot leaves no trace in it.',
      },
      {
        term: 'Server functions',
        explanation:
          "A server function is a function whose body runs only on the server. `createServerFn({ method: 'POST' }).validator(parse).handler(fn)` declares one; the build replaces it in the client bundle with an RPC stub, so calling `savePlanChange({ data })` in a component sends a `fetch` request and resolves with the handler result. The validator runs on the server on every call, because the endpoint answers any HTTP client, not only your page.",
        link: {
          label: 'TanStack Start: Server Functions',
          href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-functions',
        },
      },
      {
        term: 'Route loaders',
        explanation:
          'A route `loader` returns the data a route needs before it renders, and `Route.useLoaderData()` reads it in the component. Here the loader calls the `getPlanState` server function, which reads `plan.json` from disk on each request. That replaces the build-time import, so a saved edit shows without a rebuild.',
        link: {
          label: 'TanStack Router: Data Loading',
          href: 'https://tanstack.com/router/latest/docs/framework/react/guide/data-loading',
        },
      },
      {
        term: 'Invalidation',
        explanation:
          '`router.invalidate()` marks the loaded data of the current routes as stale and runs their loaders again. After a save the page awaits the server function and then `router.invalidate()`, so the component renders what the server now has on disk. The server function also returns the new state, but the page ignores it: the loader stays the one way data enters the route.',
        link: {
          label: 'TanStack Router: Router type, invalidate',
          href: 'https://tanstack.com/router/latest/docs/framework/react/api/router/RouterType',
        },
      },
      {
        term: 'Optimistic preview',
        explanation:
          'A save takes a round trip, and a moved event would jump back to its old slot until the loader answers. The page keeps the changes still on their way in a `pending` list, applies them to the plan inside a `useMemo`, and removes each one only after `router.invalidate()` has resolved, so the preview hands over to fresh data without a gap. React 19 has a built-in hook for the same idea, `useOptimistic`; the planner does it by hand with the shared reducer.',
        link: { label: 'React: useOptimistic', href: 'https://react.dev/reference/react/useOptimistic' },
      },
      {
        term: 'A discriminated union of changes',
        explanation:
          '`PlanChange` is a union of object types that share a `type` field: `event.patch`, `event.add`, `calendar.save` and more. A `switch (change.type)` narrows each case to its own fields, and the exhaustive-switch lint rule from chapter 4 reports a case that was forgotten. The same JSON value travels from a button to the server, into the history and, later, in from a language model.',
        link: {
          label: 'TypeScript: Discriminated unions',
          href: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions',
        },
      },
      {
        term: 'One pure reducer in three places',
        explanation:
          '`applyChange(base, edits, change)` returns the next edits and touches nothing else: no file, no React, and the clock only as the `now` argument. That is why the same function runs on the server before `edits.json` is written, in the browser for the optimistic preview, and on a plan file opened from disk, whose edits never leave the browser (`docs/architecture.md`).',
      },
    ],
    decisions: [
      {
        question: 'Where do manual changes live?',
        options: [
          {
            name: 'Edit `plan.json` in place',
            pros: ['One file, nothing to merge', 'The viewer writes exactly what it shows'],
            cons: [
              '`pnpm run plan` rebuilds the file from the content and erases every manual change',
              'A content change and a manual move can no longer be told apart',
            ],
          },
          {
            name: 'An overlay file of patches by uid',
            pros: [
              'Survives every rebuild: the schedule is generated again and the patches applied again',
              'The file lists only real changes and is committed and reviewed like code (`7dec384` records one move)',
            ],
            cons: [
              'Two files must agree; a patch whose uid disappeared is an orphan',
              'Generated uids must stay stable for patches to land on the right event',
            ],
          },
          {
            name: 'A database such as SQLite',
            pros: ['Concurrent writers, transactions and queries'],
            cons: [
              'A process and a schema to run for a plan one person edits',
              'Changes are no longer plain diffs in git',
            ],
          },
        ],
        chosen: 'An overlay file of patches by uid',
        why: 'The README states the reason: everything changed in the viewer is stored in `edits.json` and applied on top of the generated schedule, "so `pnpm run plan` never loses it". `CLAUDE.md` makes it a rule: `plan.json` is generated and never hand-edited, and `store.ts` is the only code that writes either file. Rejecting a database is our reading; nothing in the repo compares the two.',
        evidence: 'evidenced',
        sources: [
          {
            kind: 'commit',
            ref: '746a107',
            note: 'edits.json holds patches by event uid, applied by the plan command and the server function',
          },
          { kind: 'file', ref: 'README.md', note: 'lines 211-212' },
          { kind: 'file', ref: 'CLAUDE.md', note: 'the rule for plan.json, edits.json and store.ts' },
        ],
      },
      {
        question: 'How does a new kind of edit reach the server?',
        options: [
          {
            name: 'One server function per edit',
            pros: ['Each endpoint is small and its input type is narrow'],
            cons: [
              'Every rule exists twice: in the handler and in whatever previews the change in the browser',
              'A new edit touches the server, the client and the route',
            ],
          },
          {
            name: 'One `PlanChange` union and one reducer behind one server function',
            pros: [
              'The same `applyChange` runs on the server, in the browser preview and on an opened file',
              'A new edit is a new union member and a new `case`; the transport stays as it is',
              'Changes are plain JSON, so they can be stored as history steps and sent by tools',
            ],
            cons: ['`parseChange` validates every member by hand', 'One large `switch` to keep readable'],
          },
        ],
        chosen: 'One `PlanChange` union and one reducer behind one server function',
        why: '`931fbd6` replaced the patch-only `saveEventEdit` with `savePlanChange` and gives the reason: the same reducer runs on the server before `edits.json` is written, in the browser for an optimistic preview, and on a plan file opened from disk. `docs/architecture.md` and `CLAUDE.md` turn it into the rule that a new kind of edit is a new member of the union, not a new server function.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '931fbd6' },
          { kind: 'file', ref: 'docs/architecture.md', note: 'lines 73-76' },
          { kind: 'file', ref: 'CLAUDE.md' },
        ],
      },
      {
        question: 'How is a change shown before the server answers?',
        options: [
          {
            name: 'Wait for the server',
            pros: ['Nothing to roll back when a save fails'],
            cons: ['A dragged event snaps back to its old slot for the whole round trip'],
          },
          {
            name: 'A list of pending changes, applied again with the shared reducer',
            pros: [
              'The preview is computed by the same `applyChange` the server runs, so it matches what will be stored',
              'Several changes in flight stack in order',
            ],
            cons: [
              'A change the browser cannot preview (a restore from the trash) appears only when the server answers',
              'The list must be cleared in `finally`, or a failed save stays on screen',
            ],
          },
          {
            name: 'React 19 `useOptimistic`',
            pros: ['Built into React; the optimistic value falls back when the Action ends'],
            cons: [
              'Ties every change to an Action or transition, while the planner changes the plan from pointer and key handlers',
            ],
          },
        ],
        chosen: 'A list of pending changes, applied again with the shared reducer',
        why: 'A code comment gives the goal: changes on their way are "shown at once so a dragged event does not jump back while saving" (`89467f9`, still in `use-plan-session.ts`), and `docs/architecture.md` names the browser preview as one of the three places `applyChange` runs. Why `useOptimistic` was not used is not recorded; the con listed for it is our reading.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '89467f9' },
          { kind: 'file', ref: 'modules/planner/src/pages/planner/model/use-plan-session.ts', note: 'lines 64-81' },
          { kind: 'file', ref: 'docs/architecture.md', note: 'lines 73-76' },
        ],
      },
      {
        question: 'How does the page get the data after a save?',
        options: [
          {
            name: 'Use the value the server function returns',
            pros: ['No second request'],
            cons: ['Two sources of data for one route: the loader and local state set by each mutation'],
          },
          {
            name: '`router.invalidate()` after the save',
            pros: [
              'The loader stays the only way data enters the route',
              'Server rendering and client navigation read the same `getPlanState`',
            ],
            cons: ['One more round trip per save', 'The whole state is read again for a one-field change'],
          },
          {
            name: 'A client cache such as TanStack Query',
            pros: ['Fine-grained cache keys, retries and mutation helpers'],
            cons: ['Another library and a second cache next to the router loader data'],
          },
        ],
        chosen: '`router.invalidate()` after the save',
        why: 'This is a reconstruction: no commit says why. The code shows the same choice from the first edit (`89467f9`) to the pinned commit: the route awaits the server function, then `router.invalidate()`, and the module contract says `onChange` "resolves once `state` is fresh". The `PlanState` the server function returns is not used.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '89467f9' },
          { kind: 'file', ref: 'apps/web/src/routes/index.tsx', note: 'lines 78-81' },
          { kind: 'doc', ref: 'https://tanstack.com/router/latest/docs/framework/react/api/router/RouterType' },
        ],
      },
    ],
    steps: [
      {
        title: 'Define the overlay format',
        detail:
          'Start with the type of the file before any code that writes it. `PlanEdits` has a `version` and `events`, a record from event uid to an `EventPatch`, which is a `Partial<Pick<PlanEvent, …>>` of the four fields the first form can change. `emptyEdits()` is the value for a missing file. Later chapters add `calendars`, `added`, `removed` and `title` to the same shape.',
        files: [
          {
            path: 'src/lib/plan/edits.ts',
            at: '746a107',
            lines: [4, 14],
            note: 'The first `EventPatch` and `PlanEdits`: four editable fields, patches keyed by uid.',
          },
          {
            path: 'packages/plan-domain/src/edits.ts',
            lines: [16, 40],
            note: 'The same type at the pinned commit, grown with calendars, created events and the trash.',
          },
        ],
        commit: '746a107',
      },
      {
        title: 'Read the file as untrusted input',
        detail:
          'The file is JSON that a person, a merge or a tool may have changed, so it is parsed, not cast. `parsePatch` takes a field only with the right type and format (times must look like `YYYY-MM-DDTHH:MM`, a title must not be blank) and returns `null` otherwise. `parseEdits` drops what it cannot read instead of failing the page. The server reuses `parsePatch` to check what the browser sends.',
        files: [
          {
            path: 'src/lib/plan/edits.ts',
            at: '746a107',
            lines: [16, 42],
            note: '`parsePatch` and `parseEdits`: type guards instead of casts.',
          },
        ],
        commit: '746a107',
      },
      {
        title: 'Apply the overlay in one pure function',
        detail:
          '`applyEdits(plan, edits)` maps over the generated events, merges a patch when `patchProblem` accepts it (the end must come after the start), and sorts the result again. Patches for uids that no longer exist come back as `orphans` instead of throwing. It also moves `meta.planEnd` when an event was moved past the generated end, so the list view still reaches it.',
        files: [
          {
            path: 'src/lib/plan/edits.ts',
            at: '746a107',
            lines: [44, 71],
            note: '`patchProblem` and the first `applyEdits`.',
          },
          {
            path: 'packages/plan-domain/src/edits.ts',
            lines: [174, 215],
            note: 'Today the same function also adds created events, applies renamed calendars and hides the trash.',
          },
        ],
        commit: '746a107',
      },
      {
        title: 'Give the files a single writer',
        detail:
          '`store.ts` is the only module that touches the disk. `readPlan` reads `plan.json` at request time and falls back to the bundled copy when the checkout is not there; `canWrite` turns editing off where the file is not writable or `PLAN_READONLY=1` is set; `writePlan` rebuilds the schedule, applies the edits and writes both files together. Its first line marks it Node-only, so components never import it.',
        files: [
          {
            path: 'src/lib/plan/store.ts',
            at: '746a107',
            lines: [1, 43],
            note: 'The first store: read the edits, read the plan, check for a writable checkout, write both files.',
          },
          {
            path: 'packages/plan-data/src/store.ts',
            lines: [136, 158],
            note: 'At the pinned commit `writePlan` also purges the trash and keeps the date when nothing changed.',
          },
        ],
        commit: '746a107',
      },
      {
        title: 'Run the same overlay in the plan command',
        detail:
          '`pnpm run plan` stops writing `buildPlan()` straight to JSON. It reads the edits and calls `writePlan`, so the command and the viewer produce the same file. It prints how many manual edits it applied and warns about orphans, which is how you notice a patch whose event disappeared.',
        files: [
          {
            path: 'scripts/build-plan.ts',
            at: '746a107',
            lines: [1, 16],
            note: 'The plan command reads `edits.json` and writes through the store.',
          },
          {
            path: 'packages/plan-data/scripts/build-plan.ts',
            lines: [10, 17],
            note: 'The same lines at the pinned commit, in the `plan-data` package.',
          },
        ],
        commands: ['pnpm run plan'],
        commit: '746a107',
      },
      {
        title: 'Expose reading and saving as server functions',
        detail:
          '`getPlanState` is a GET server function that returns the plan from disk, whether it can be edited, and which uids are edited. `saveEventEdit` is a POST server function: `.validator(parseSaveInput)` checks the uid and the patch, and the handler refuses on a read-only host, merges the patch with the stored one, deletes every field equal to the generated event and calls `writePlan`. In the client bundle the build replaces each handler with an RPC stub, so `store.ts` and `node:fs` stay on the server.',
        files: [
          {
            path: 'src/lib/plan/server.ts',
            at: '746a107',
            lines: [1, 18],
            note: '`PlanState` and the GET server function.',
          },
          {
            path: 'src/lib/plan/server.ts',
            at: '746a107',
            lines: [37, 59],
            note: '`saveEventEdit`: validator, read-only check, minimal patch, write.',
          },
        ],
        commit: '746a107',
      },
      {
        title: 'Load the plan in the route loader',
        detail:
          'The page stops importing `bundledPlan`. The route gets `loader: () => getPlanState()` and the component reads `Route.useLoaderData()`. On the first request the loader runs during server rendering; on later navigations it runs in the browser, where the server function call becomes an HTTP request. The `/api/plan` route switches to `readPlan()` for the same reason.',
        files: [
          {
            path: 'src/routes/index.tsx',
            at: '746a107',
            lines: [28, 35],
            note: 'The loader calls the server function.',
          },
          {
            path: 'src/routes/index.tsx',
            at: '746a107',
            lines: [43, 51],
            note: 'The component reads the loader data; an opened file still replaces it in the browser.',
          },
        ],
        commit: '746a107',
      },
      {
        title: 'Save from the dialog, preview at once, then invalidate',
        detail:
          'The event dialog gets a form: title, date, start and end in 15-minute steps (`step={900}`), and description. On submit the page puts the patch into `pending`, calls `saveEventEdit`, awaits `router.invalidate()`, and removes the patch in `finally`. Because `plan` is a `useMemo` of `applyEdits(base, pending)`, the edited event is on screen before the server answers, and a failed save drops the preview and shows the reason in the dialog.',
        files: [
          {
            path: 'src/routes/index.tsx',
            at: '89467f9',
            lines: [53, 58],
            note: 'The plan on screen is the loader data with the pending patches applied.',
          },
          {
            path: 'src/routes/index.tsx',
            at: '89467f9',
            lines: [78, 86],
            note: '`saveEdit`: preview, save, invalidate, then clear the preview.',
          },
          {
            path: 'src/components/EventDialog.tsx',
            at: '89467f9',
            lines: [48, 59],
            note: 'The dialog awaits the save and shows the error text when it rejects.',
          },
          {
            path: 'src/components/EventDialog.tsx',
            at: '89467f9',
            lines: [138, 155],
            note: 'The form checks the title and the time order before it sends a patch.',
          },
        ],
        commit: '89467f9',
      },
      {
        title: 'Turn every edit into one PlanChange',
        detail:
          'When more kinds of edit arrive (own calendars, own events, done marks), `931fbd6` replaces the patch-only endpoint with a union. `PlanChange` lists each edit as data, `applyChange(base, edits, change)` returns the next edits, and `savePlanChange` validates with `parseChange` and writes `applyChange(buildPlan(), readEdits(), data)`. The browser keeps a list of pending `PlanChange` values and previews them with the same reducer. Later `saveChanges` also records each change as a history step (chapter 14).',
        files: [
          {
            path: 'packages/plan-domain/src/changes.ts',
            at: '931fbd6',
            lines: [24, 34],
            note: 'The first `PlanChange` union: five kinds of edit.',
          },
          {
            path: 'apps/web/src/server/plan.ts',
            at: '931fbd6',
            lines: [17, 23],
            note: 'One server function for every change: validate, apply, write.',
          },
          {
            path: 'modules/planner/src/pages/planner/model/use-plan-session.ts',
            lines: [62, 101],
            note: 'At the pinned commit: pending changes previewed with `applyChange`, or kept in the browser for an opened file.',
          },
          {
            path: 'docs/architecture.md',
            lines: [73, 76],
            note: 'The rule: one reducer in three places, a new edit is a new union member.',
          },
        ],
        commit: '931fbd6',
      },
    ],
    checkpoint: {
      commands: ['pnpm run plan', 'pnpm run dev', 'git diff packages/plan-data/data/edits.json', 'pnpm run test'],
      expect: [
        '`pnpm run plan` prints `data/plan.json: … events, … manual edits, plan ends …` and no warning about orphans.',
        'In the dev server at http://localhost:3000, a session moved in its dialog shows in the new slot at once, and the diff of `edits.json` gains an entry under `events`, keyed by its uid, with only `start` and `end`.',
        'Running `pnpm run plan` again keeps the move in `plan.json`; moving the session back to its planned slot removes the entry.',
        '`pnpm run test` passes, including the `event.patch` test "moves an event and keeps only what differs from the original".',
      ],
      quiz: [
        {
          question: 'Why does a manual move live in `edits.json` and not in `plan.json`?',
          options: [
            '`plan.json` is too large to rewrite on every save',
            '`pnpm run plan` rebuilds `plan.json` from the content, so a change written there would be lost on the next run',
            'The browser cannot write JSON files',
            'Git ignores `plan.json`',
          ],
          answer: 1,
          explanation:
            '`plan.json` is generated output. The overlay is applied again on every rebuild, which is what lets a manual change survive regeneration.',
        },
        {
          question: 'What runs in the browser when a component calls `savePlanChange({ data: change })`?',
          options: [
            'The handler body, with `node:fs` replaced by a browser shim',
            'An RPC stub that sends a fetch request; the validator and the handler run on the server',
            'Nothing until the next page load',
            'A copy of `store.ts` in a Web Worker',
          ],
          answer: 1,
          explanation:
            'The build replaces a server function in the client bundle with a stub that calls the server over HTTP. That is also why the validator must assume any input.',
        },
        {
          question:
            'The page removes a pending change in `finally`, after `await router.invalidate()`. What goes wrong if it removed it as soon as the server function resolved?',
          options: [
            'Nothing: the server already stored it',
            'The event jumps back to its old slot for a moment: the preview is gone while the loader data is still the old plan',
            'The change is saved twice',
            'The history loses the step',
          ],
          answer: 1,
          explanation:
            'Until the loader has run again, the route still holds the plan from before the save. The preview must last until the fresh data is in.',
        },
      ],
    },
    pitfalls: [
      'Editing `plan.json` by hand: the next `pnpm run plan` or the next save rebuilds it and the edit is gone. Change `content.ts` or `schedule.ts`, or store a `PlanChange` (`CLAUDE.md`).',
      'Shifting generated uids: `buildPlan` numbers the events of each calendar in order (`certs-001@learning-curve`, `certs-002@learning-curve`), so inserting a session in `content.ts` renumbers the ones after it and their patches land on other sessions. `applyEdits` only catches uids that disappeared (`orphans`, warned by `pnpm run plan`); read `edits.json` after a content change.',
      'A date that changes on every save: each save stamped today into `meta.generated`, so the tracked `plan.json` showed a diff whenever the plan was edited. `1adeacd` keeps the stored date when nothing else changed (`dated` in `store.ts`).',
      'Trusting the request: a server function is an HTTP endpoint any client can call. Validate in `.validator` (`parseChange` throws `PlanChangeError`, whose message is safe to show) and check `canWrite()` before writing.',
      'Clearing the optimistic preview too early: remove a pending change only after `router.invalidate()` resolves, or the event flashes back to its old slot.',
    ],
    tradeoffs: [
      'JSON files in the repository need no database and every change is a readable diff, but there is one writer per checkout; a host shared by several people would need real storage and locking.',
      'Each save rebuilds the whole schedule and rewrites both files: simple and always consistent for a few hundred events, wasteful for a large calendar.',
      '`router.invalidate()` reads the whole state again after each change, one extra request in exchange for a single path by which data enters the page.',
      'A read-only host (`PLAN_READONLY=1`, or a checkout it cannot write) still serves the plan, from the bundled copy if the file is missing, but hides every editing control.',
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
      {
        label: 'TanStack Router: Router type',
        href: 'https://tanstack.com/router/latest/docs/framework/react/api/router/RouterType',
      },
      { label: 'React: useOptimistic', href: 'https://react.dev/reference/react/useOptimistic' },
      {
        label: 'TypeScript: Discriminated unions',
        href: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions',
      },
    ],
    next: 'Editing through a form works, but moving a session should feel like moving it: chapter 8 adds dragging, resizing and keyboard moves on the week grid, each ending in one `PlanChange`.',
  },
  {
    id: 'direct-manipulation',
    summary:
      'You make the week grid an editor: drag an event to another day or time, pull its top or bottom edge to resize it, pick it up with a long press on a phone, or move it with `Alt` and the arrow keys. Every gesture snaps to half an hour, previews locally, and ends in one `PlanChange` sent along the path from chapter 7.',
    whereWeAre:
      'Edits are stored in `edits.json` through a server function, the page previews pending changes, and the event dialog has a form for the title, the date and the times. The week grid only draws events; changing a time means opening the dialog and typing.',
    problem:
      'A planner is used by moving blocks around. Typing a date and two times for every small shift is slow, and on a narrow screen the seven columns do not even fit. The grid has to turn pointer movement into wall-clock times, keep the click that opens an event working, stay usable with a finger that also scrolls, and give the same moves to the keyboard.',
    outcomes: [
      'build drag and resize with Pointer Events and pointer capture, without a library',
      'convert pixels to snapped wall-clock times and keep the preview apart from the stored change',
      'tell a click from a drag and stop the click a drag leaves behind',
      'support touch with a long press and a non-passive `touchmove` listener, and the keyboard with `Alt` + arrows',
      'decide whether a move changes one repeat or the whole series, and express both as `PlanChange` values',
    ],
    concepts: [
      {
        term: 'Pointer Events',
        explanation:
          'One event family covers mouse, pen and touch: `pointerdown`, `pointermove`, `pointerup` and `pointercancel`, with `pointerType` naming the device and `button` the button. The grid starts a gesture only for the primary button (`e.button === 0`) and treats `pointerType === "touch"` apart, because a finger also scrolls. `pointercancel` arrives when the browser takes the gesture over, for a pan for example, so it ends the drag without storing anything.',
        link: { label: 'MDN: Pointer events', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events' },
      },
      {
        term: 'Pointer capture',
        explanation:
          '`element.setPointerCapture(pointerId)` sends every later event of that pointer to the element until it is released, even when the pointer leaves it. That keeps a drag alive when the cursor runs ahead of the block. The price is that the event target no longer says what is under the pointer, so the month view asks `document.elementFromPoint(x, y)` for the day cell.',
        link: {
          label: 'MDN: Element.setPointerCapture()',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture',
        },
      },
      {
        term: 'Drag threshold and the click after a drag',
        explanation:
          'A press becomes a drag only after the pointer travels `DRAG_THRESHOLD`, 5 px; below that it is a click that opens the event. After a real drag the browser still fires `click` on the block, so a `suppressClick` ref swallows the next click, and a 50 ms timer clears the flag in case no click comes.',
      },
      {
        term: 'Pixels to snapped wall-clock time',
        explanation:
          'The grid draws `hourHeight` px per hour, starting at hour `minH`. `timeAt(column, y)` turns a pointer position into ms past midnight; a move is `snap(timeAt(now) - t0)`, rounded to `SNAP`, half an hour, and `clamp` keeps it inside the hours drawn. Days shift by whole column widths, `Math.round(dx / columnWidth)`. All of it uses the wall-clock helpers of `@lc/plan-domain`, never `new Date(localString)`.',
      },
      {
        term: 'Refs for the gesture, state for the picture',
        explanation:
          'What the gesture needs between events (where it started, the mode, whether it moved) lives in a ref, because changing it must not render. What the person sees, the block at its new slot, lives in the `drag` state, and the block renders from `drag` or from the occurrence. Values that a frame loop reads, such as the current first hour, are copied into a ref in `useLayoutEffect`, so a long drag never reads an old render.',
        link: { label: 'React: useRef', href: 'https://react.dev/reference/react/useRef' },
      },
      {
        term: 'Touch: long press and a non-passive listener',
        explanation:
          'On a phone the same finger scrolls the grid, so a touch press arms the drag only after resting `LONG_PRESS`, 350 ms; moving earlier releases it and the page scrolls. Once armed, a native `touchmove` listener added with `{ passive: false }` calls `preventDefault()` to stop the scroll; in a passive listener that call does nothing. The CSS alternative, `touch-action: none`, blocks panning from the first touch, which suits small handles but not a grid a finger must scroll.',
        link: {
          label: 'MDN: addEventListener, the passive option',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener',
        },
      },
      {
        term: 'A keyboard path for every gesture',
        explanation:
          'Each event block is a `<button>`, so it takes focus. `Alt` + left or right moves it a day, `Alt` + up or down half an hour, `Alt` + `Shift` + up or down changes its length, and `Delete` removes it. The new slot goes through the same `onMove` as a drag. The moved block is drawn again, and a detached repeat even comes back as a new event, so the grid gives the focus back for three seconds by finding the block by `data-key` or `data-slot`.',
        link: {
          label: 'MDN: KeyboardEvent.altKey',
          href: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/altKey',
        },
      },
      {
        term: 'An occurrence and its series',
        explanation:
          'A weekly event, the gym on Tuesday and Thursday, is one `PlanEvent` with an `rrule`; the grid shows its occurrences. A drag moves one occurrence, so `moveOccurrence` turns the new slot into `event.detach` for a repeat (skip that day in the series and add a single event) and into `event.patch` built by `movePatch` for anything else. The event card keeps buttons and a form that change the whole series.',
      },
    ],
    decisions: [
      {
        question: 'What drives drag and resize on the grid?',
        options: [
          {
            name: 'Pointer Events written by hand',
            pros: [
              'One code path for mouse, pen and touch',
              'Full control over snapping, edge resizing, the live time label and auto-scroll',
              'No dependency',
            ],
            cons: [
              'Click suppression, capture, cancel and focus all have to be handled',
              '`WeekGrid.tsx` grows to about 880 lines with many refs',
            ],
          },
          {
            name: 'The HTML Drag and Drop API',
            pros: ['Built into the browser and carries data between unrelated components'],
            cons: [
              'The browser draws the drag image; a live block that snaps and shows its times is not what it is built for',
              'Pulling an edge to resize is not a drag-and-drop gesture',
            ],
          },
          {
            name: 'A drag library such as dnd-kit',
            pros: ['Sensors, collision detection and accessibility helpers ready-made'],
            cons: [
              'A dependency and its model of draggables and droppables for one grid',
              'Time snapping, resizing and the hour geometry still have to be written',
            ],
          },
        ],
        chosen: 'Pointer Events written by hand',
        why: 'This is a reconstruction; no commit compares the options. The code uses each browser API for one job: Pointer Events to move and resize events inside the grid (`afbc8ca`), and the HTML Drag and Drop API only to carry a missed session from the backlog onto the grid (`onDragOver` and `onDrop`, `185abdc`), where data crosses from one component to another.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: 'afbc8ca' },
          { kind: 'commit', ref: '185abdc' },
          { kind: 'file', ref: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx' },
        ],
      },
      {
        question: 'How does a finger move an event on a touch screen?',
        options: [
          {
            name: 'It does not: touch keeps using the dialog form',
            pros: ['Scrolling is never mistaken for a drag'],
            cons: ['No direct manipulation on a phone'],
          },
          {
            name: 'Long press to pick up, then drag',
            pros: ['A quick swipe still scrolls', 'A short vibration confirms the pick-up'],
            cons: [
              'Slower and hidden: the README has to say "rest a finger on the event first"',
              'Needs a non-passive `touchmove` listener to stop the scroll once armed',
            ],
          },
          {
            name: '`touch-action: none` on every event, drag at once',
            pros: ['Immediate, no timer'],
            cons: ['A finger that lands on an event can no longer scroll the grid, and events cover much of it'],
          },
        ],
        chosen: 'Long press to pick up, then drag',
        why: 'The first version left touch out on purpose: "Repeating events and touch input keep using the dialog form" (`afbc8ca`). `972da82` adds "a long press drags on a touch screen", and the code says why it waits: "A finger scrolls the grid; it picks an event up only after resting on it." The edges stay mouse-only because "The edges are too thin for a finger".',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: 'afbc8ca' },
          { kind: 'commit', ref: '972da82' },
          {
            kind: 'file',
            ref: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            note: 'lines 413-415 and 438-443',
          },
        ],
      },
      {
        question: 'What does dragging one repeat of a weekly series change?',
        options: [
          {
            name: 'The whole series',
            pros: ['One patch on one event; the rule stays readable'],
            cons: [
              'Every other repeat moves too',
              'A drop on a weekday that already has a repeat merges the two for good',
            ],
          },
          {
            name: 'Only that repeat, with `event.detach`',
            pros: [
              'What the person sees moving is what changes',
              'The series stays whole; the day is added to its `skip` list',
            ],
            cons: [
              'A new single event appears beside the series',
              'The keyboard focus has to find the new event by its slot',
            ],
          },
          {
            name: 'An override stored on the series, like `RECURRENCE-ID` in iCalendar',
            pros: ['One event keeps all its exceptions'],
            cons: ['Every reader of the plan (grid, export, sync, budget) must understand overrides'],
          },
        ],
        chosen: 'Only that repeat, with `event.detach`',
        why: '`b559a6e` records the bug and the fix: "Dragging a repeat rewrote the rule of the whole series, so every other repeat moved with it, and a drop on a weekday that already had a repeat merged the two for good. A new change, event.detach, skips that day in the series and adds an event of its own in the new slot." The override option is our comparison, not in the history.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: 'b559a6e' },
          { kind: 'file', ref: 'packages/plan-domain/src/occurrence-changes.ts' },
        ],
      },
    ],
    steps: [
      {
        title: 'Lay the grid out so it can be measured and scrolled',
        detail:
          'Each day is a column with `data-day="YYYY-MM-DD"`, and an event block is placed absolutely from its start and length at `hourHeight` px per hour. On a narrow screen the days scroll sideways while the hour column stays put (`sticky left-0`), columns snap into place (`snap-x`, `snap-start`), and the grid opens at today (`de4b223`). The pinned version keeps the geometry in a ref, refreshed in `useLayoutEffect`, and converts a pointer y into ms with `timeAt`.',
        files: [
          {
            path: 'src/components/WeekGrid.tsx',
            at: 'de4b223',
            lines: [26, 28],
            note: 'The `PINNED` class that keeps the hour column in place.',
          },
          {
            path: 'src/components/WeekGrid.tsx',
            at: 'de4b223',
            lines: [69, 74],
            note: 'On a narrow screen, scroll the days to today.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [284, 291],
            note: 'The geometry ref and `timeAt`, which every drag reads.',
          },
        ],
        commit: 'de4b223',
      },
      {
        title: 'Lay overlapping events side by side',
        detail:
          'Before events can be dragged onto each other, two events at the same time must both stay visible. `layoutLanes` sorts a day by start, groups events that overlap, and gives each a lane and the number of lanes in its group; the block takes `lane / lanes` of the column width. It is pure, so it lives in the domain.',
        files: [
          {
            path: 'packages/plan-domain/src/occurrences.ts',
            lines: [55, 90],
            note: '`layoutLanes`: one pass over the sorted events, a new group whenever one starts after the group ends.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [757, 760],
            note: 'The lane becomes `left` and `width` of the block.',
          },
        ],
        commit: 'afbc8ca',
      },
      {
        title: 'Start a gesture on pointerdown',
        detail:
          "`pointerDown` ignores anything but the primary button, finds the day column with `closest('[data-day]')`, stops the event from reaching the column (where a press starts drawing a new event), and records a `Press` in a ref: the start point, `t0` (the time under the pointer), the distance to the top and the bottom of the block, and the column width. For a mouse or a pen it captures the pointer and begins at once.",
        files: [
          {
            path: 'src/components/WeekGrid.tsx',
            at: 'afbc8ca',
            lines: [72, 84],
            note: 'The first version: no repeats and no touch, capture and start.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [408, 444],
            note: 'At the pinned commit: drag modes, the measured block, and a long-press timer for touch.',
          },
        ],
        commit: 'afbc8ca',
      },
      {
        title: 'Move and resize with snapping',
        detail:
          '`pointerMove` waits until the pointer has travelled 5 px, then stores the position and calls `placeDrag`. In `move` mode the start moves by the snapped vertical shift and the day by whole column widths, clamped to the hours and days shown; `resize` moves only the end and `resize-start` only the start, never below half an hour. The new slot goes into the `drag` state, and the block renders at that slot with `translateX(shiftX)`. Thin spans at the top and the bottom of each block start the two resize modes.',
        files: [
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [446, 472],
            note: '`placeDrag`: snap, clamp, and shift by whole days.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [484, 500],
            note: '`pointerMove`: the threshold, then the first move starts the edge pull.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [811, 824],
            note: 'The two resize handles inside each block.',
          },
        ],
        commit: 'afbc8ca',
      },
      {
        title: 'Commit once on pointerup and swallow the click',
        detail:
          '`pointerUp` releases the press and, when the pointer moved, sets `suppressClick` so the browser click that follows does not open the dialog. It calls `onMove` once, and only when the slot changed: a drag is one change and one history step, not a request per frame. A `handlers` helper wires `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `keydown` and `click` onto every block the same way.',
        files: [
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [502, 518],
            note: '`release` and `pointerUp`.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [548, 560],
            note: 'The handlers every block gets, including the click that checks `suppressClick`.',
          },
        ],
        commit: 'afbc8ca',
      },
      {
        title: 'Turn a slot into a PlanChange',
        detail:
          'The grid reports wall-clock ms; the page turns them into data. `moveOccurrence` returns `event.patch` with `movePatch` for a single event (an all-day one keeps its length and changes day) and `event.detach` for one repeat of a series. In the reducer, `event.detach` adds the day to the series `skip` list and pushes a copy without the rule. The page passes `onMove` only when the plan can be edited, so a read-only host gets a grid that cannot be dragged.',
        files: [
          {
            path: 'packages/plan-domain/src/occurrence-changes.ts',
            lines: [14, 20],
            note: '`moveOccurrence`: one repeat leaves its series, anything else is patched.',
          },
          {
            path: 'packages/plan-domain/src/changes.ts',
            lines: [400, 419],
            note: 'The `event.detach` case of `applyChange`.',
          },
          {
            path: 'modules/planner/src/pages/planner/ui/PlannerPage.tsx',
            lines: [471, 490],
            note: 'The page wires `onMove` and `onRemove` only when `canEdit`.',
          },
        ],
        commit: 'b559a6e',
      },
      {
        title: 'Pick events up with a long press on touch',
        detail:
          'A touch press starts unarmed: a 350 ms timer arms it, vibrates for 8 ms where the device can, and begins the drag. Moving more than 5 px before that releases the press so the grid scrolls. While armed, a native `touchmove` listener registered with `{ passive: false }` calls `preventDefault()` so the finger moves the event, not the page. A finger never resizes: a press on an edge becomes `move`, and `TOUCH_QUIET` stops text selection and the system menu during the press.',
        files: [
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [397, 406],
            note: 'The non-passive `touchmove` listener, added and removed in an effect.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [413, 415],
            note: 'A finger always moves: the edges are too thin for it.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [438, 443],
            note: 'The long-press timer that arms the drag.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [123, 124],
            note: '`TOUCH_QUIET`: no text selection, no callout.',
          },
        ],
        commit: '972da82',
      },
      {
        title: 'Give every gesture a keyboard equivalent',
        detail:
          '`keyDown` on a focused block maps `Alt` + arrows to a day or half an hour, `Alt` + `Shift` + up or down to the length, and `Delete` or `Backspace` to `onRemove`. It refuses a move that would cross midnight or leave less than half an hour, and records `refocus` so an effect can put the focus back on the block once it is drawn again. The event card offers the same steps as buttons (`EventNudge`), which step over weekdays a series already uses.',
        files: [
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [520, 546],
            note: '`keyDown`: the keyboard moves.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [380, 395],
            note: 'The effect that finds the moved block by key or by slot and focuses it.',
          },
          {
            path: 'modules/planner/src/features/edit-event/ui/EventNudge.tsx',
            lines: [30, 51],
            note: 'The same steps as buttons in the event card.',
          },
        ],
        commit: '972da82',
      },
      {
        title: 'Let a drag reach the hidden hours',
        detail:
          'The compact grid shows only the hours around the week events, and a drag used to stop at the last one. `useEdgePull` runs a `requestAnimationFrame` loop while a block is held near the top or the bottom edge: it scrolls hidden hours in first and, once nothing is left to scroll and the block has stayed there 200 ms, asks the grid for one more hour. Each frame places the block again against the hours as they are now, which is why `placeDrag` reads the geometry ref instead of render variables.',
        files: [
          {
            path: 'modules/planner/src/widgets/week-grid/model/use-edge-pull.ts',
            lines: [44, 98],
            note: 'The frame loop: scroll first, then stretch the day.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [293, 300],
            note: 'The grid wires the hook and grows its hours in `stretch`.',
          },
          {
            path: 'modules/planner/src/widgets/week-grid/ui/WeekGrid.tsx',
            lines: [474, 482],
            note: '`pullOfDrag`: which edge of the block leads.',
          },
        ],
        commit: '0d7ab0e',
      },
      {
        title: 'Drag across days in the month view',
        detail:
          'The month grid has no hours, so a drag changes only the day. It captures the pointer like the week grid, which means the target stays the pressed button; `pointerMove` asks `document.elementFromPoint` for the cell under the pointer and reads its `data-month-day`. On release the shift in days goes through the same `moveOccurrence`.',
        files: [
          {
            path: 'modules/planner/src/widgets/month-grid/ui/MonthGrid.tsx',
            lines: [50, 70],
            note: 'Find the day under the pointer, then report the shift on release.',
          },
          {
            path: 'modules/planner/src/widgets/month-grid/ui/MonthGrid.tsx',
            lines: [129, 139],
            note: 'Capture on pointerdown; no drag for touch here.',
          },
        ],
        commit: '972da82',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run dev',
        'git diff packages/plan-data/data/edits.json',
        'pnpm exec nx run @lc/plan-domain:test',
        'pnpm run stand',
      ],
      expect: [
        'Dragging a session down in the week view moves it in half-hour steps while the pointer moves, and stores one change: `edits.json` shows the new `start` and `end` under its uid.',
        'Dragging one gym repeat to another day leaves the other repeats in place: `edits.json` gets a `skip` day for `personal-001@learning-curve` and a new event in `added`.',
        'With an event focused, `Alt` + down moves it half an hour later and the focus stays on it.',
        'The `@lc/plan-domain` tests pass, including "event.detach moves one repeat and leaves the series".',
        'In the stand at http://localhost:6006 the week grid stories `Drafting`, `DropIn` and `PastTheHours` render.',
      ],
      quiz: [
        {
          question: 'Why does the month grid call `document.elementFromPoint` during a drag?',
          options: [
            'It is faster than reading the event target',
            'With the pointer captured, events keep targeting the pressed button, so the target cannot say which day cell is under the pointer',
            'Pointer events carry no coordinates',
            'React does not pass a target to pointer handlers',
          ],
          answer: 1,
          explanation:
            'Pointer capture retargets every later event of the pointer to the capturing element. The cell under the pointer has to be looked up by coordinates.',
        },
        {
          question: 'With `hourHeight` 56, a person drags an event 40 px down. Where does its start land?',
          options: [
            '42 minutes later',
            '30 minutes later: the shift is rounded to the nearest half hour',
            'An hour later: shifts always round up',
            'Nowhere: shifts under an hour are ignored',
          ],
          answer: 1,
          explanation:
            '40 px is 40 / 56 of an hour, about 43 minutes. `snap` rounds to the nearest multiple of `SNAP`, 30 minutes.',
        },
        {
          question: 'Why is a drag stored as one `PlanChange` on `pointerup` and not on every `pointermove`?',
          options: [
            'Pointer handlers cannot call async functions',
            'Each stored change is a server write and a history step; between frames the preview is local `drag` state',
            'React batches state updates only on pointerup',
            'The server refuses more than one change per second',
          ],
          answer: 1,
          explanation:
            'The preview lives in component state and costs nothing to update. Storing once keeps one undo step per gesture and one request per drop.',
        },
      ],
    },
    pitfalls: [
      'The click after a drag opens the dialog: the browser fires `click` after `pointerup` even when the pointer moved. Swallow it with a flag and clear the flag on a timer in case the click never comes (`afbc8ca`).',
      'Dragging a repeat moved the whole series and could merge two repeats on one weekday for good; `b559a6e` fixed it with `event.detach`.',
      'Focus lost after a keyboard move: the block is drawn again, and a detached repeat comes back as a new event with a new key, so `b559a6e` looks it up by `data-key` and then by `data-slot`.',
      'Acting while the press is still ending: a dialog opened on `pointerup` is closed at once by the click that follows, which lands outside it. The grid opens the new-event form after a 50 ms timeout (`drawEnd`), and the timeline fixed the same bug in `065947b`.',
      'A drag that stops at the last visible hour: before `0d7ab0e` the compact grid clamped every drag to its own hours; the edge pull now scrolls and then stretches the day.',
      'A passive listener cannot stop scrolling: `preventDefault()` in a passive `touchmove` listener does nothing, so the grid adds its own listener with `{ passive: false }` in an effect and removes it on cleanup.',
    ],
    tradeoffs: [
      'Half-hour snapping lands drags on clean times; a start at a quarter hour needs the form, whose time inputs step by 15 minutes (`step={900}`).',
      'A long press keeps scrolling natural on a phone but is slower and has to be explained; the resize edges are mouse-only and a finger changes the length in the event card.',
      'Hand-written gestures add no dependency and fit the hour geometry exactly, at the cost of one large component with many refs that only a browser can test (the stand stories, chapter 13).',
      'Detaching a moved repeat keeps every reader of the plan simple, but a series moved often collects single events beside it.',
    ],
    links: [
      { label: 'MDN: Pointer events', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events' },
      {
        label: 'MDN: Element.setPointerCapture()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture',
      },
      {
        label: 'MDN: Document.elementFromPoint()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint',
      },
      {
        label: 'MDN: EventTarget.addEventListener()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener',
      },
      { label: 'MDN: touch-action', href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action' },
      {
        label: 'MDN: Window.requestAnimationFrame()',
        href: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame',
      },
      { label: 'MDN: CSS scroll snap', href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_snap' },
      { label: 'React: useRef', href: 'https://react.dev/reference/react/useRef' },
    ],
    next: 'The planner now edits the plan in several ways, and all of it still lives in one app folder: chapter 9 turns the repository into an Nx and pnpm workspace so the code can be split.',
  },
  {
    id: 'workspace',
    summary:
      'You turn a single-package repository into a pnpm workspace run by Nx. The app moves to `apps/web` with its own `package.json`, the root keeps only shared tooling, and every root script delegates to Nx, which knows the projects, the order of their tasks, and when a result can be replayed from cache.',
    whereWeAre:
      'One `package.json` at the root holds the TanStack Start app, its dependencies, the plan script and the tooling (TypeScript, Oxlint, Oxfmt, commitlint). All source is under `src/`, the data under `src/data/`. `pnpm run check` runs the typecheck, lint, the format check and the translation check one after another, in full, every time.',
    problem:
      'The next step splits the code into packages with clear owners (chapter 10) and modules (chapter 11). With one `package.json` there is nowhere to put them: no way for one package to depend on another, no scripts per package, and no runner that knows which package depends on which. Every check also runs on everything, so each new package makes `check` slower.',
    outcomes: [
      'declare a pnpm workspace and make packages depend on each other with `workspace:*`',
      'explain what Nx adds on top: projects, targets, the project graph and the task graph',
      'configure `targetDefaults` with `cache`, `inputs`, `outputs` and `dependsOn` in `nx.json`',
      'run a target in one project with `nx run`, in all with `nx run-many`, and replay cached results',
      'keep generated files and long-running tasks correct with `^` dependencies, `continuous` and `parallelism: false`',
    ],
    concepts: [
      {
        term: 'pnpm workspace',
        explanation:
          'A workspace is one repository with several packages, each a folder with its own `package.json`, installed together with one lockfile. `pnpm-workspace.yaml` lists the folders by glob: `apps/*`, `modules/*`, `packages/*`. pnpm links each package into the `node_modules` of the packages that depend on it, so an import of `@lc/plan-domain` resolves to the folder in the repository.',
        link: { label: 'pnpm: Workspace', href: 'https://pnpm.io/workspaces' },
      },
      {
        term: 'The workspace protocol',
        explanation:
          '`"@lc/plan-domain": "workspace:*"` tells pnpm to resolve that name only inside the workspace, never from the registry. pnpm links only what a package lists, so a package cannot import a sibling it did not declare; `docs/architecture.md` counts this as the first of the three things that enforce the dependency rules.',
        link: { label: 'pnpm: Workspace protocol', href: 'https://pnpm.io/workspaces' },
      },
      {
        term: 'Nx projects and targets',
        explanation:
          'Nx sees every workspace package as a project and every script in its `package.json` as a target: `typecheck`, `lint`, `build`, `i18n`. Settings that are not scripts go into an `nx` field of the same `package.json` (tags, per-target overrides), so no `project.json` is needed. `nx run @lc/web:build` runs one target; `nx run-many -t typecheck` runs it in every project that has it.',
        link: { label: 'Nx: Project configuration', href: 'https://nx.dev/docs/reference/project-configuration' },
      },
      {
        term: 'Project graph and task graph',
        explanation:
          'From the `workspace:*` dependencies Nx builds a project graph: `@lc/web` depends on `@lc/plan-data`, which depends on `@lc/plan-domain`. For each command it derives a task graph: `"dependsOn": ["^build"]` means build what this project depends on first, `"dependsOn": ["i18n"]` means run my own `i18n` first. `pnpm run graph` opens the project graph in a browser.',
        link: {
          label: 'Nx tutorial: Configuring tasks',
          href: 'https://nx.dev/docs/getting-started/tutorials/configuring-tasks',
        },
      },
      {
        term: 'Computation hash and cache',
        explanation:
          'Before it runs a cacheable task, Nx hashes its inputs: the files the `inputs` list names, the inputs of dependencies where it says `^`, the command and the environment. When an earlier run had the same hash, Nx restores the terminal output and the declared `outputs` instead of running it. A task with too few inputs replays an old success, and a task with side effects, such as `plan`, which writes data files, must not be cached.',
        link: { label: 'Nx tutorial: Caching tasks', href: 'https://nx.dev/docs/getting-started/tutorials/caching' },
      },
      {
        term: 'Named inputs',
        explanation:
          '`namedInputs` give file sets a name. Here `default` is every file of the project plus `sharedGlobals` (`tsconfig.base.json` and the lockfile), `lintConfig` is `.oxlintrc.json`, and `production` is `default` without stories and Markdown. `{projectRoot}` and `{workspaceRoot}` anchor paths, `!` excludes, and `^default` in a target means the `default` files of the projects it depends on.',
        link: { label: 'Nx: Inputs reference', href: 'https://nx.dev/docs/reference/inputs' },
      },
      {
        term: 'targetDefaults',
        explanation:
          '`targetDefaults` configure a target by its name once for every project: `typecheck` is cached, depends on `i18n` here and in dependencies, and hashes `default` and `^default`. A project overrides only what differs, in its own `nx` field, as the stand does with `parallelism: false` on `build`.',
        link: { label: 'Nx: nx.json reference', href: 'https://nx.dev/docs/reference/nx-json' },
      },
      {
        term: 'Continuous tasks',
        explanation:
          '`dev` and `start` never exit. With `"continuous": true` Nx starts them and does not wait for them to finish before the tasks that depend on them. `start` still depends on `build`, so `pnpm start` builds first and then serves.',
        link: { label: 'Nx: Project configuration', href: 'https://nx.dev/docs/reference/project-configuration' },
      },
    ],
    decisions: [
      {
        question: 'Which task runner sits on top of the pnpm workspace?',
        options: [
          {
            name: 'Plain `pnpm -r` and `pnpm --filter`',
            pros: ['Nothing to install; runs a script in every package in dependency order'],
            cons: ['No cache: every run repeats every task', 'No notion of affected projects for CI'],
          },
          {
            name: 'Turborepo',
            pros: [
              'A task cache and dependency-aware pipelines over the same `package.json` scripts',
              'A small configuration file',
            ],
            cons: [
              'Projects are picked with its own filters, not with the Nx tags and `nx run-many --projects=tag:…` that `docs/architecture.md` refers to',
            ],
          },
          {
            name: 'Nx',
            pros: [
              'A cache keyed by declared inputs, `run-many` and `affected`',
              'Tags and `nx graph` over the same projects',
              'Runs any project with a `package.json` or `project.json`, so a Python service could join later',
            ],
            cons: [
              'Its own configuration (`nx.json`, `nx` fields) and a background daemon',
              'Its TypeScript and boundary plugins need the TypeScript compiler API, which TypeScript 7 lacks, so they are not used',
            ],
          },
        ],
        chosen: 'Nx',
        why: 'The repo records what Nx is used for, not a comparison. `56f2b5e` says the root "delegates every script to Nx, which caches typecheck, lint, i18n and build", and `docs/architecture.md` notes that Nx runs any project with a `package.json` or a `project.json`, so a future backend in `apps/api` "takes part in `nx affected` like the TypeScript ones". Why not Turborepo or plain pnpm is our reconstruction.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '56f2b5e' },
          { kind: 'file', ref: 'docs/architecture.md', note: 'lines 21-23 and 48-50' },
        ],
      },
      {
        question: 'How is the repository divided into top-level folders?',
        options: [
          {
            name: '`apps/`, `modules/` and `packages/`',
            pros: [
              'The folder says the role: deployable, product slice, shared code',
              'Each role maps to a tag and to a row of the dependency rules',
            ],
            cons: [
              'Three globs to keep in `pnpm-workspace.yaml`',
              'Not the `apps/` and `libs/` layout of the Nx examples',
            ],
          },
          {
            name: '`apps/` and `libs/`',
            pros: ['The layout most Nx examples use'],
            cons: ['Product slices and shared code end up side by side in one folder'],
          },
          {
            name: 'Everything under `packages/`',
            pros: ['One glob'],
            cons: ['The role is visible only in names and tags'],
          },
        ],
        chosen: '`apps/`, `modules/` and `packages/`',
        why: '`docs/architecture.md` states the rule the layout encodes: "Everything deployable lives in `apps/`, every vertical slice of the product is a module in `modules/`, and code shared between them is a package in `packages/`", and its dependency table gives each role a tag. `56f2b5e` created the three roots before any module or package existed.',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/architecture.md', note: 'lines 3-5 and 33-39' },
          { kind: 'commit', ref: '56f2b5e' },
        ],
      },
      {
        question: 'Where are the targets configured?',
        options: [
          {
            name: 'Scripts in each `package.json`, shared settings in `targetDefaults`',
            pros: ['Each package still runs with plain pnpm', 'Cache and order are set once per target name'],
            cons: ['What a target does (the script) and how Nx treats it (`nx.json`) live in two files'],
          },
          {
            name: 'A `project.json` per project with Nx executors',
            pros: ['Executors with typed options'],
            cons: ['Every target configured per project', 'Commands no longer run without Nx'],
          },
          {
            name: 'Targets inferred by Nx plugins from tool configs',
            pros: ['Almost no configuration'],
            cons: ['The TypeScript plugin needs the compiler API, which TypeScript 7 does not have'],
          },
        ],
        chosen: 'Scripts in each `package.json`, shared settings in `targetDefaults`',
        why: 'Reconstruction; no commit compares these. `56f2b5e` puts each command in its package (`"typecheck": "tsc --noEmit"`) and the cache settings in `targetDefaults`, and `CLAUDE.md` notes that the Nx TypeScript plugin does not run on TypeScript 7, which rules out inferring type-check targets.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '56f2b5e' },
          { kind: 'file', ref: 'CLAUDE.md', note: 'TypeScript 7 has no compiler API' },
        ],
      },
    ],
    steps: [
      {
        title: 'Declare the workspace',
        detail:
          '`pnpm-workspace.yaml` lists the three roots, even though only `apps/web` exists yet. `allowBuilds` names the dependencies allowed to run install scripts: pnpm refuses those it does not list, and the workspace commit adds `nx` beside `esbuild`.',
        files: [
          {
            path: 'pnpm-workspace.yaml',
            at: '56f2b5e',
            lines: [1, 8],
            note: 'Three globs and the two dependencies allowed to run install scripts.',
          },
        ],
        commit: '56f2b5e',
      },
      {
        title: 'Move the app into `apps/web`',
        detail:
          'Source, messages, the Inlang project and the plan script move into `apps/web` as plain renames, so their history follows them. The app gets the name `@lc/web`, its own dependencies, and scripts that run inside its folder: `dev`, `build`, `plan`, `i18n`, `typecheck`, `lint`, `check:i18n`. Paths in those scripts stay relative to the package.',
        files: [
          {
            path: 'apps/web/package.json',
            at: '56f2b5e',
            lines: [1, 19],
            note: 'The first project: its name and its scripts.',
          },
        ],
        commit: '56f2b5e',
      },
      {
        title: 'Keep shared tooling at the root and delegate the scripts',
        detail:
          'The root `package.json` keeps only tools every project uses (commitlint, Husky, Nx, Oxfmt, Oxlint, TypeScript) and turns each script into an Nx call: `nx run @lc/web:dev`, `nx run-many -t typecheck`, `nx affected -t …`. Formatting stays a plain `oxfmt` call at the root; it also checks files that belong to no project.',
        files: [
          {
            path: 'package.json',
            at: '56f2b5e',
            lines: [6, 33],
            note: 'Root scripts as Nx calls, and the shared dev dependencies.',
          },
        ],
        commit: '56f2b5e',
      },
      {
        title: 'Share one compiler configuration',
        detail:
          '`tsconfig.json` becomes `tsconfig.base.json` with the strict settings. Each project extends it and sets only what is its own: `include`, `types` and, for the app, its `#/*` path alias.',
        files: [
          {
            path: 'tsconfig.base.json',
            at: '56f2b5e',
            lines: [1, 20],
            note: 'The shared compiler options.',
          },
          {
            path: 'apps/web/tsconfig.json',
            at: '56f2b5e',
            lines: [1, 8],
            note: 'A project tsconfig extends the base.',
          },
        ],
        commit: '56f2b5e',
      },
      {
        title: 'Name the file sets',
        detail:
          '`default` is everything in a project plus the shared globals, the base tsconfig and the lockfile, so a change there invalidates every task. `lintConfig` adds the Oxlint config to lint only. `production` came later (`8fda5fe`): `default` without stories and Markdown, so a story edit no longer invalidates the build.',
        files: [
          { path: 'nx.json', lines: [3, 9], note: '`defaultBase` and the named inputs at the pinned commit.' },
          { path: 'nx.json', at: '56f2b5e', lines: [4, 8], note: 'The first named inputs.' },
        ],
        commit: '56f2b5e',
      },
      {
        title: 'Configure each target once',
        detail:
          'Every target that only reads files is `cache: true`. `typecheck`, `lint`, `build` and `test` depend on `^i18n` and `i18n` because Paraglide generates the message modules that `@lc/i18n` exports, and `tsc` fails without them. `build` depends on `^build` and lists its `outputs` so a cache hit can restore `.output` and `dist`. `check:i18n` also hashes the sources of apps and modules, which its script hands to `inlang check` (`cf289bd`).',
        files: [
          { path: 'nx.json', lines: [10, 44], note: 'All `targetDefaults` at the pinned commit.' },
          {
            path: 'nx.json',
            at: 'cf289bd',
            lines: [13, 16],
            note: 'The inputs of `check:i18n` widened to the files it reads.',
          },
        ],
        commit: '56f2b5e',
      },
      {
        title: 'Mark the servers as continuous',
        detail:
          '`dev` and `start` never exit. Marked `continuous`, they can be depended on without Nx waiting for an exit that never comes; `start` depends on `build`, so `pnpm start` always serves a fresh build.',
        files: [{ path: 'nx.json', lines: [45, 51], note: 'The two long-running targets.' }],
        commit: '56f2b5e',
      },
      {
        title: 'Keep Nx state out of git',
        detail:
          'Nx keeps the project graph and other state in `.nx/workspace-data` inside the repository; the workspace commit ignores it, and `.nx/cache` with it. The current Nx docs place the default local cache under `~/.nx/<id>/cache`, outside the repository, so the `.nx/cache` line may only matter for older setups.',
        files: [
          { path: '.gitignore', at: '56f2b5e', lines: [15, 16], note: 'The two Nx folders added to `.gitignore`.' },
        ],
        commit: '56f2b5e',
      },
      {
        title: 'Read the log per project',
        detail:
          'With many projects, interleaved output is hard to read. `--output-style=stream` prefixes every line with its project, so a failing typecheck names the package it failed in (`0fc9c95` for `build`, `check` and `affected`, `1e4f57c` for `plan`). `pnpm run graph` shows the projects and their edges.',
        files: [{ path: 'package.json', lines: [6, 27], note: 'The root scripts at the pinned commit.' }],
        commands: ['pnpm run check', 'pnpm run graph'],
        commit: '0fc9c95',
      },
      {
        title: 'Override a target when it cannot run beside others',
        detail:
          'Nx runs independent tasks in parallel. The web build rewrites `packages/i18n/src/paraglide` through the Paraglide plugin, and a stand build running beside it read the files half-written (`dcdb5fe`). The stand sets `parallelism: false` on its `build` in its own `nx` field; everything else keeps the defaults.',
        files: [
          {
            path: 'apps/stand/package.json',
            lines: [41, 61],
            note: 'Tags and per-target overrides in the `nx` field.',
          },
          {
            path: 'docs/component-stand.md',
            lines: [100, 103],
            note: 'Why the stand build does not run in parallel.',
          },
        ],
        commit: 'dcdb5fe',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run typecheck',
        'pnpm run typecheck',
        'pnpm exec nx show projects',
        'pnpm exec nx run @lc/planner:typecheck --skip-nx-cache',
        'pnpm run graph',
      ],
      expect: [
        'The first `pnpm run typecheck` runs `i18n` where needed and then `typecheck` in every project that has the script.',
        'The second run finishes almost at once, and Nx reports that it read the output from the cache for those tasks.',
        '`nx show projects` includes, at the pinned commit, `@lc/web`, `@lc/stand`, `@lc/planner`, `@lc/calendar-export`, `@lc/dashboard`, `@lc/plan-domain`, `@lc/plan-data`, `@lc/i18n` and `@lc/ui`.',
        '`--skip-nx-cache` makes the planner typecheck run again.',
        '`pnpm run graph` opens a page where `@lc/web` points at the modules and packages it depends on.',
      ],
      quiz: [
        {
          question:
            'In `nx.json`, `typecheck` has `"dependsOn": ["^i18n", "i18n"]`. What does Nx do before `nx run @lc/planner:typecheck`?',
          options: [
            'Nothing: `dependsOn` only affects caching',
            'It runs `i18n` in the projects the planner depends on, here `@lc/i18n`, and in the planner itself if it had the target, so the compiled messages exist before `tsc` reads them',
            'It runs `typecheck` in `@lc/i18n` first',
            'It recompiles the messages only when git shows them changed',
          ],
          answer: 1,
          explanation:
            '`^` means the same target in dependencies; a name without `^` means the project itself. Nx caches `i18n`, so this costs nothing when the messages did not change.',
        },
        {
          question: 'Why does `build` hash `production` and `^production` instead of `default`?',
          options: [
            '`production` is faster to hash',
            'Stories and Markdown do not change the build output, so editing a story should not invalidate the build cache',
            'Nx requires an input called `production` for builds',
            'To skip type errors in stories',
          ],
          answer: 1,
          explanation:
            '`8fda5fe`: "a story edit no longer invalidates the build". Inputs should list what can change the output, and nothing else.',
        },
        {
          question: 'What does `"@lc/plan-domain": "workspace:*"` guarantee?',
          options: [
            'The latest version from npm',
            'The name resolves to the package folder in this workspace, never to the registry',
            'Nx builds the package before every install',
            'The package is published together with the app',
          ],
          answer: 1,
          explanation:
            'The workspace protocol makes pnpm link the local package. When a package is published, pnpm replaces `workspace:*` with the real version.',
        },
      ],
    },
    pitfalls: [
      'Generated files read by other projects: `@lc/i18n` exports files that Paraglide generates, and a typecheck that runs before them fails. Hence `dependsOn: ["^i18n", "i18n"]`, and `nx run-many -t i18n` in the `prepare` script after install.',
      'Inputs that miss files a task reads: `check:i18n` scans the sources of apps and modules for message use, so `cf289bd` added `{workspaceRoot}/apps/*/src/**/*` and `{workspaceRoot}/modules/*/src/**/*` to its inputs. Without them a cached success could hide a missing message.',
      'Inputs that include files a task does not need: with `default`, editing a story invalidated the build; `8fda5fe` added the `production` input.',
      'Two tasks that touch the same folder: the web build rewrites `packages/i18n/src/paraglide`, and a stand build beside it failed on half-written files (`dcdb5fe`), fixed with `parallelism: false`.',
      'Caching a task with side effects: `plan` writes `plan.json` and `edits.json` and has no `targetDefaults` entry, so it is never cached. With `cache: true` a second `pnpm run plan` could replay old output without writing anything.',
      'Install scripts blocked: pnpm refuses the install scripts of dependencies not listed in `allowBuilds`; `56f2b5e` lists `nx` beside `esbuild`.',
    ],
    tradeoffs: [
      'Nx brings a cache and a graph, and with them a daemon, `nx.json`, and a second place where a task is described.',
      'Scripts in `package.json` keep each package runnable with pnpm alone, while settings only Nx reads live in a separate `nx` field.',
      'Shared tooling at the root means one version of Oxlint, Oxfmt and TypeScript for all projects; no project can move ahead alone.',
      'Parallel tasks are faster until two of them share files, as the stand build showed.',
    ],
    links: [
      { label: 'pnpm: Workspace', href: 'https://pnpm.io/workspaces' },
      { label: 'pnpm: Build settings (allowBuilds)', href: 'https://pnpm.io/settings/build' },
      { label: 'Nx: Project configuration', href: 'https://nx.dev/docs/reference/project-configuration' },
      { label: 'Nx: nx.json reference', href: 'https://nx.dev/docs/reference/nx-json' },
      { label: 'Nx: Inputs reference', href: 'https://nx.dev/docs/reference/inputs' },
      { label: 'Nx tutorial: Caching tasks', href: 'https://nx.dev/docs/getting-started/tutorials/caching' },
      {
        label: 'Nx tutorial: Configuring tasks',
        href: 'https://nx.dev/docs/getting-started/tutorials/configuring-tasks',
      },
    ],
    next: 'The workspace has a single project. Chapter 10 extracts the plan domain, the data store, the translations and the UI kit into packages, and decides which way dependencies may point.',
  },
  {
    id: 'packages',
    summary:
      'You split the app into four packages with one job each: `@lc/plan-domain` (pure rules), `@lc/plan-data` (the files on disk and the plan command), `@lc/i18n` (messages and formatting) and `@lc/ui` (the UI kit). They are consumed as TypeScript source through their `exports`, shared versions move to the pnpm catalog, and the pure domain gets Vitest tests on an in-memory fixture.',
    whereWeAre:
      'The repository is an Nx and pnpm workspace with one project, `apps/web`. Inside it `src/lib/plan` mixes pure rules (`schedule.ts`, `edits.ts`, `dates.ts`) with Node file access (`store.ts`), `src/components/ui.tsx` holds the buttons, and the messages sit beside the app.',
    problem:
      'Nothing stops a component from importing `store.ts` and pulling `node:fs` toward the browser bundle, or the schedule rules from depending on React. The rules cannot be tested without the app, and the modules of chapter 11 will need the domain and the UI kit without the app. Every new `package.json` would also pin its own React version.',
    outcomes: [
      'create an internal package whose `exports` point at TypeScript source, with no build step',
      'draw package boundaries by reason to change and keep dependencies pointing one way',
      'keep a package framework-free with `"types": []` and inject heavy dependencies instead of importing them',
      'share dependency versions through a pnpm catalog',
      'test a pure package with Vitest, a fixed fixture and a compile-time list of examples',
    ],
    concepts: [
      {
        term: 'Internal packages as source',
        explanation:
          'An internal package never goes to npm, so it needs no `dist`. `"exports": { ".": "./src/index.ts" }` points the package name at its TypeScript entry; Vite transpiles it like app code and `tsc` follows `exports` under `moduleResolution: "bundler"`. An edit shows in the dev server at once, with no watcher rebuilding packages.',
        link: {
          label: 'TypeScript: Modules reference, package.json exports',
          href: 'https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports',
        },
      },
      {
        term: '`exports` as the public API',
        explanation:
          'Once a package has `exports`, only the listed subpaths can be imported: `@lc/plan-domain` and `@lc/plan-domain/fixtures`, not `@lc/plan-domain/src/edits`. `src/index.ts` re-exports what other packages may use, so the files behind it can move freely.',
        link: { label: 'Node.js: Package entry points', href: 'https://nodejs.org/api/packages.html#exports' },
      },
      {
        term: 'The direction of dependencies',
        explanation:
          'Dependencies point from what changes often to what changes rarely: app to modules to domain, app to data to domain, and `ui` and `i18n` import nothing from the plan. `docs/architecture.md` lists for each tag what it may import; the domain imports nothing from the workspace.',
      },
      {
        term: 'A framework-free domain',
        explanation:
          '`packages/plan-domain/tsconfig.json` sets `"types": []`, so no `@types` package is in scope: code that touches `process` or `Buffer` fails the typecheck. The domain imports neither React nor `node:*`, which is why it runs in the browser, on the server and in tests alike.',
        link: { label: 'TypeScript: tsconfig types', href: 'https://www.typescriptlang.org/tsconfig/#types' },
      },
      {
        term: 'Injecting what is heavy or impure',
        explanation:
          'When a rule needs a heavy library, the domain asks for a function instead of importing it. `planRebalance(plan, request, now, busy, solve)` takes the solver as `solve`; `@lc/plan-data` passes the HiGHS one and tests pass a fake. The clock is injected the same way, as `now`.',
      },
      {
        term: 'pnpm catalog',
        explanation:
          '`catalog:` in `pnpm-workspace.yaml` defines one version for each shared dependency; a package writes `"react": "catalog:"` and gets that version. Upgrading React is one line, and two packages cannot drift apart.',
        link: { label: 'pnpm: Catalogs', href: 'https://pnpm.io/catalogs' },
      },
      {
        term: 'Vitest on a pure package',
        explanation:
          'Vitest runs `*.test.ts` files with the same transforms as Vite, so tests import the TypeScript source directly. `vitest run` runs once and exits, which is what the `test` target needs; `plan-domain` has no Vitest config file at all.',
        link: { label: 'Vitest: Getting started', href: 'https://vitest.dev/guide/' },
      },
      {
        term: 'Exhaustive examples through a mapped type',
        explanation:
          "`EXAMPLES: { [K in PlanChange['type']]: Extract<PlanChange, { type: K }> }` needs one entry for every kind of change, so a new kind does not compile until it has an example. `test.each(Object.values(EXAMPLES))` then checks that each one survives a trip through JSON, applies to the generated plan and passes the preview.",
        link: {
          label: 'TypeScript: Mapped types',
          href: 'https://www.typescriptlang.org/docs/handbook/2/mapped-types.html',
        },
      },
    ],
    decisions: [
      {
        question: 'How do apps consume a workspace package?',
        options: [
          {
            name: 'TypeScript source through `exports`',
            pros: [
              'No build step or watcher; edits reach the dev server at once',
              'Go to definition lands in the real source',
            ],
            cons: [
              'Every consumer compiles the sources with its own `tsconfig`, so path aliases inside packages break',
              'Not publishable as is',
            ],
          },
          {
            name: 'A built `dist` with declaration files',
            pros: ['Consumers depend on a compiled contract', 'Ready to publish'],
            cons: ['A build per package before the app can start, and stale `dist` folders when one is forgotten'],
          },
          {
            name: 'TypeScript project references',
            pros: ['Incremental type checks across packages'],
            cons: ['Every package must emit declarations; more tsconfig plumbing'],
          },
        ],
        chosen: 'TypeScript source through `exports`',
        why: '`CLAUDE.md` records the rule and its consequence: packages are consumed as TypeScript source, "no build step, `exports` point at `src`", and path aliases are banned inside packages because "the app type-checks their sources with its own tsconfig". The comparison with built packages and project references is our reconstruction.',
        evidence: 'inferred',
        sources: [
          { kind: 'file', ref: 'CLAUDE.md' },
          { kind: 'file', ref: 'packages/plan-domain/package.json', note: 'lines 6-9' },
        ],
      },
      {
        question: 'Where are the package boundaries?',
        options: [
          {
            name: 'By reason to change: domain, data, i18n, ui',
            pros: [
              'Rules, storage, look and words change independently',
              'The domain can be tested and reused without React or Node',
            ],
            cons: ['Four packages to set up before any module exists'],
          },
          {
            name: 'One shared `core` package',
            pros: ['One `package.json`, one entry'],
            cons: ['Node file access and browser code in one package; a component can reach `fs` by accident'],
          },
          {
            name: 'By feature, each screen with its own rules',
            pros: ['Everything for a screen in one place'],
            cons: [
              'Rules shared by several screens, such as the schedule and the edits, would be copied or imported sideways',
            ],
          },
        ],
        chosen: 'By reason to change: domain, data, i18n, ui',
        why: '`6d9869b` names each package and its job, and `docs/architecture.md` gives the principle: "one reason to change per package: rules of the plan (`plan-domain`), where it is stored (`plan-data`), how it looks (`ui`), what it says (`i18n`)".',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '6d9869b' },
          { kind: 'file', ref: 'docs/architecture.md', note: 'lines 100-109' },
        ],
      },
      {
        question: 'How does the domain use a heavy library such as the HiGHS solver?',
        options: [
          {
            name: 'Import it in `plan-domain`',
            pros: ['Direct and short'],
            cons: ['A WebAssembly solver inside the package the browser imports', 'Tests need the real solver'],
          },
          {
            name: 'Inject it as a function argument',
            pros: ['The domain imports no solver, and tests pass a fake `solve`', 'The browser never loads HiGHS'],
            cons: ['Every caller must supply the function'],
          },
          {
            name: 'Run the whole re-balance in `plan-data`',
            pros: ['No injection needed'],
            cons: ['The rules of a re-balance move out of the domain into the Node package'],
          },
        ],
        chosen: 'Inject it as a function argument',
        why: '`docs/architecture.md`: the library is "taken as an injected function. `planRebalance` asks for a `solve`, so the domain imports no solver, and its tests pass a fake one", and, under dependency inversion, "The domain depends on nothing: even the solver is passed in."',
        evidence: 'evidenced',
        sources: [
          { kind: 'file', ref: 'docs/architecture.md', note: 'lines 108-109 and 139-145' },
          { kind: 'commit', ref: '2a170c2' },
        ],
      },
      {
        question: 'How are shared dependency versions kept in step?',
        options: [
          {
            name: 'A pnpm catalog',
            pros: ['One line per dependency in `pnpm-workspace.yaml`', 'Built into pnpm'],
            cons: ['A package that needs another version has to leave the catalog for a plain range'],
          },
          {
            name: 'Exact versions in every `package.json`',
            pros: ['Each file stands on its own'],
            cons: ['An upgrade touches every package, and drift is easy'],
          },
          {
            name: 'A checker such as syncpack',
            pros: ['Works with any package manager'],
            cons: ['Another tool to run; it fixes drift after the fact'],
          },
        ],
        chosen: 'A pnpm catalog',
        why: 'The comment in `pnpm-workspace.yaml` says what the catalog is for: "One version of each shared dependency for the whole workspace: packages reference these as `catalog:`", and `6d9869b` moves the shared versions there.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '6d9869b' },
          { kind: 'file', ref: 'pnpm-workspace.yaml', note: 'line 6' },
        ],
      },
    ],
    steps: [
      {
        title: 'Extract the framework-free domain',
        detail:
          '`content.ts`, `dates.ts`, `edits.ts`, `ics.ts`, `occurrences.ts`, `schedule.ts` and `types.ts` move from `apps/web/src/lib/plan` to `packages/plan-domain/src` with `git mv`. The package is `@lc/plan-domain`, its only entry is `src/index.ts`, and its tsconfig sets `"types": []` so nothing from Node or Vite is in scope.',
        files: [
          {
            path: 'packages/plan-domain/package.json',
            at: '6d9869b',
            lines: [1, 19],
            note: 'Name, `exports` pointing at source, scripts and tags.',
          },
          {
            path: 'packages/plan-domain/tsconfig.json',
            at: '6d9869b',
            lines: [1, 7],
            note: '`"types": []`: no global types in the domain.',
          },
        ],
        commit: '6d9869b',
      },
      {
        title: 'Give it one public entry',
        detail:
          '`src/index.ts` re-exports, by name, what other packages may use: date helpers, `applyEdits` and `parsePatch`, the `.ics` builders, `layoutLanes` and `occurrences`, `buildPlan`, and the types. Anything not listed stays private to the package.',
        files: [
          {
            path: 'packages/plan-domain/src/index.ts',
            at: '6d9869b',
            lines: [1, 34],
            note: 'The first public API of the domain.',
          },
        ],
        commit: '6d9869b',
      },
      {
        title: 'Move storage and the plan command into `plan-data`',
        detail:
          '`@lc/plan-data` depends on the domain with `workspace:*` and owns `data/plan.json`, `data/edits.json`, the plan script and `store.ts`. Nx runs `plan` inside `packages/plan-data` while the server runs from `apps/web` or a built `.output`, so `dataDir()` walks up from the working directory until it finds `packages/plan-data/data`, "so every package and the built server find it".',
        files: [
          {
            path: 'packages/plan-data/package.json',
            at: '6d9869b',
            lines: [1, 27],
            note: 'A Node package that depends on the domain.',
          },
          {
            path: 'packages/plan-data/src/store.ts',
            at: '6d9869b',
            lines: [1, 22],
            note: 'Imports by package name, and the upward search for the data folder.',
          },
          {
            path: 'packages/plan-data/src/bundled.ts',
            at: '6d9869b',
            lines: [1, 11],
            note: 'The copy of the plan built into the server, for hosts without the checkout.',
          },
        ],
        commit: '6d9869b',
      },
      {
        title: 'Move the translations and the UI kit',
        detail:
          '`@lc/i18n` exports the compiled Paraglide modules (`./messages`, `./runtime`, `./server`) and `./format`. `@lc/ui` exports its components and `./theme.css`, and declares React as a peer dependency, so the app supplies the one React at runtime; React is also a dev dependency for its own typecheck.',
        files: [
          {
            path: 'packages/i18n/package.json',
            at: '6d9869b',
            lines: [6, 16],
            note: 'Subpath exports pointing at generated files and at `format.ts`.',
          },
          {
            path: 'packages/ui/package.json',
            at: '6d9869b',
            lines: [6, 20],
            note: 'The UI kit with React as a peer dependency.',
          },
        ],
        commit: '6d9869b',
      },
      {
        title: 'Point the app at the packages',
        detail:
          'The app lists each package with `workspace:*` and imports it by name. Its server function now takes `canWrite`, `readEdits`, `readPlan` and `writePlan` from `@lc/plan-data` and the rules from `@lc/plan-domain`; the file moves from `src/lib/plan/server.ts` to `src/server/plan.ts`.',
        files: [
          {
            path: 'apps/web/package.json',
            at: '6d9869b',
            lines: [13, 27],
            note: 'Workspace dependencies and catalog versions side by side.',
          },
          {
            path: 'apps/web/src/server/plan.ts',
            at: '6d9869b',
            lines: [1, 3],
            note: 'Imports by package name, never by relative path into another package.',
          },
        ],
        commit: '6d9869b',
      },
      {
        title: 'Share versions through the catalog',
        detail:
          'Versions used by more than one package move to `catalog:` in `pnpm-workspace.yaml`, and each `package.json` writes `"catalog:"` instead of a number. The catalog grows as packages arrive: seven entries in `6d9869b`, thirty-one at the pinned commit.',
        files: [
          {
            path: 'pnpm-workspace.yaml',
            at: '6d9869b',
            lines: [6, 14],
            note: 'The first catalog.',
          },
          { path: 'pnpm-workspace.yaml', lines: [6, 38], note: 'The catalog at the pinned commit.' },
        ],
        commit: '6d9869b',
      },
      {
        title: 'Tag each project by kind',
        detail:
          'Each `package.json` gets `nx.tags`: `type:domain`, `type:data`, `type:shared`, later `type:module` and `type:app`. The tags let `nx run-many --projects=tag:type:module` select a kind of project, and they name the rows of the dependency table. Making lint refuse a wrong import is chapter 11.',
        files: [
          { path: 'packages/plan-domain/package.json', lines: [19, 24], note: 'The tags of the domain.' },
          {
            path: 'docs/architecture.md',
            lines: [25, 50],
            note: 'The dependency rules per tag and what enforces them.',
          },
        ],
        commit: '6d9869b',
      },
      {
        title: 'Inject heavy dependencies',
        detail:
          'The rule stays in the domain and the library stays out of it. `planRebalance` takes `solve: Solve` as its last argument; `plan-data` passes `solveLp`, which runs HiGHS, and queues one request at a time. The browser bundle never sees HiGHS, and the domain tests pass a fake solver.',
        files: [
          {
            path: 'packages/plan-domain/src/rebalance/index.ts',
            lines: [75, 87],
            note: '`planRebalance` asks for `solve`.',
          },
          {
            path: 'packages/plan-data/src/rebalance.ts',
            lines: [33, 39],
            note: 'The data package supplies the real solver.',
          },
          {
            path: 'docs/architecture.md',
            lines: [139, 151],
            note: 'The pattern for work that needs a heavy library.',
          },
        ],
        commit: '2a170c2',
      },
      {
        title: 'Add a fixture for tests and stories',
        detail:
          'Tests and stories need a plan that does not change when someone edits `edits.json`. `fixtures.ts` builds the real schedule in memory with a fixed generation date and a fixed "now", marks the sessions before it done, and puts a few things in the trash. It is a second entry, `@lc/plan-domain/fixtures`, so it never reaches the main API. `itemAt` was added with `noUncheckedIndexedAccess` (`a372236`): a list that is too short fails by name.',
        files: [
          {
            path: 'packages/plan-domain/package.json',
            at: 'b3a4fd5',
            lines: [6, 9],
            note: 'The `./fixtures` subpath.',
          },
          {
            path: 'packages/plan-domain/src/fixtures.ts',
            lines: [1, 33],
            note: '`itemAt`, the generated plan at a fixed date, and the plan with past sessions done.',
          },
        ],
        commit: 'b3a4fd5',
      },
      {
        title: 'Test every kind of change',
        detail:
          '`plan-domain` gets a `test` script, `vitest run`, and Vitest from the catalog. `e24a983` covers every member of `PlanChange`: the `EXAMPLES` table is typed so that a new kind fails to compile until it has an example, and `test.each` runs each example through JSON, `applyChange` and the update preview. The history tests pin down that a change after an undo drops the undone steps.',
        files: [
          {
            path: 'packages/plan-domain/package.json',
            lines: [10, 18],
            note: 'The `test` script and its dev dependencies.',
          },
          {
            path: 'packages/plan-domain/src/changes.test.ts',
            lines: [56, 117],
            note: 'The typed table of examples and the tests run over it.',
          },
          {
            path: 'packages/plan-domain/src/history.test.ts',
            lines: [30, 35],
            note: 'A change after an undo cannot be redone.',
          },
        ],
        commands: ['pnpm run test', 'pnpm exec nx run @lc/plan-domain:test'],
        commit: 'e24a983',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run test',
        'pnpm exec nx run @lc/plan-domain:typecheck',
        'pnpm exec nx run @lc/plan-domain:test',
        'pnpm run graph',
      ],
      expect: [
        '`pnpm run test` runs Vitest in `@lc/plan-domain` and `@lc/plan-data` and passes, with one "survives a trip through JSON" test per kind of change.',
        'The domain typecheck passes with `"types": []`; adding `process.env` anywhere in `packages/plan-domain/src` makes it fail.',
        'In the graph, `@lc/plan-domain` depends on no workspace package and `@lc/plan-data` depends only on it.',
        'Adding a member to `PlanChange` without an entry in `EXAMPLES` makes the typecheck of `changes.test.ts` fail.',
      ],
      quiz: [
        {
          question: 'Why does `@lc/plan-domain` set `"types": []` in its tsconfig?',
          options: [
            'To make the typecheck faster',
            'So no global types such as those of Node are in scope: code that uses `process` or `Buffer` does not compile in the domain',
            'Because the package exports no types',
            'To allow `any` in the domain',
          ],
          answer: 1,
          explanation:
            'With no `@types` packages loaded, Node globals are unknown names. The tsconfig itself keeps the domain framework-free.',
        },
        {
          question: 'A module imports `@lc/plan-domain/src/edits`. What happens?',
          options: [
            'It works, because the file exists',
            'It fails: `exports` lists only `.` and `./fixtures`, so no other subpath can be imported, and lint forbids deep imports too',
            'pnpm copies the file into the module',
            'Vite rewrites the import to the public entry',
          ],
          answer: 1,
          explanation:
            'When a package defines `exports`, every subpath it does not list is closed to importers. Use the public entry.',
        },
        {
          question: 'Why does `planRebalance` take `solve` as an argument?',
          options: [
            'Because the solver differs per language',
            'So the domain imports no solver: `plan-data` passes HiGHS on the server, tests pass a fake, and the browser never loads it',
            'To run it in a Web Worker',
            'Because TypeScript cannot import WebAssembly',
          ],
          answer: 1,
          explanation:
            'Dependency inversion: the domain declares what it needs as a function type, and the outer package supplies it.',
        },
      ],
    },
    pitfalls: [
      'Path aliases inside a package: the app type-checks package sources with its own tsconfig, where the alias does not exist. Inside a package use relative imports; across packages use the package name (`CLAUDE.md`).',
      'A data folder found from the wrong directory: `pnpm run plan` runs inside `packages/plan-data`, the dev server inside `apps/web`. `dataDir()` walks up to `packages/plan-data/data`, and `PLAN_DATA_DIR` overrides it.',
      'Exports that point at generated files: `@lc/i18n` exports `./src/paraglide/messages.js`, which exists only after `i18n` ran. Tasks that read it depend on `^i18n`, and `1d67c96` made the Vite plugin write real files instead of stubs that only its own dev server could resolve.',
      'Fixtures that read the live database change whenever the plan is edited; `fixtures.ts` builds the plan in memory from `buildPlan(DEFAULT_CONFIG, "2026-11-22")` with a fixed now.',
      'Indexing an array in a test gives `T | undefined` under `noUncheckedIndexedAccess` (`a372236`); `itemAt` throws with the index and the length instead of failing later on `undefined`.',
    ],
    tradeoffs: [
      'Source packages skip builds, but every consumer compiles them with its own settings, so all packages share `tsconfig.base.json` and none can be published as is.',
      'Four small packages cost four `package.json` and `tsconfig.json` files before any feature gains from them.',
      'Injected dependencies keep the domain pure and testable with fakes, at the price of longer signatures: `planRebalance` takes five arguments.',
      'One catalog version per dependency prevents drift but makes every package upgrade together.',
    ],
    links: [
      { label: 'Node.js: Package entry points (exports)', href: 'https://nodejs.org/api/packages.html#exports' },
      {
        label: 'TypeScript: Modules reference, package.json exports',
        href: 'https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports',
      },
      { label: 'TypeScript: tsconfig types', href: 'https://www.typescriptlang.org/tsconfig/#types' },
      { label: 'pnpm: Workspace', href: 'https://pnpm.io/workspaces' },
      { label: 'pnpm: Catalogs', href: 'https://pnpm.io/catalogs' },
      { label: 'Vitest: Getting started', href: 'https://vitest.dev/guide/' },
      { label: 'Vitest: test.each', href: 'https://vitest.dev/api/#test-each' },
      { label: 'TypeScript: Mapped types', href: 'https://www.typescriptlang.org/docs/handbook/2/mapped-types.html' },
    ],
    next: 'The shared code now lives in packages, but the viewer is still one block inside the app: chapter 11 splits it into modules with Feature-Sliced layers and makes lint refuse imports that break the rules.',
  },
  {
    id: 'affected-ci',
    summary:
      'You add a GitHub Actions workflow that installs the workspace, checks formatting, and runs the typecheck, lint, the Feature-Sliced check, the translation check and the build only for what a change affects, with `nx affected` and base and head commits from `nrwl/nx-set-shas`. A later fix makes it run on the branch where the work actually lands.',
    whereWeAre:
      'Seven projects (the app, two modules, four packages) and lint rules for their boundaries (chapter 11). `pnpm run check` and `pnpm run affected` exist, but they run only when someone remembers to run them, and nothing checks a push.',
    problem:
      'A change in `@lc/plan-domain` can break the typecheck of the planner, the app and the data package, and nobody notices until the next local `check`. Running every check on every push gets slower with each project. CI has to catch breakage on every push and pull request, but spend its time only where a change can have an effect.',
    outcomes: [
      'read and write a GitHub Actions workflow: triggers, concurrency, jobs and steps',
      'explain how `nx affected` picks tasks from a base commit, a head commit and the declared inputs',
      'set the base with `nrwl/nx-set-shas`, and know why the checkout needs the full history',
      'install a pnpm workspace in CI reproducibly, with a cached store',
      'spot checks that silently fall outside `affected`',
    ],
    concepts: [
      {
        term: 'Workflow anatomy',
        explanation:
          'A workflow is a YAML file under `.github/workflows/`. `on` says which events start it (here `pull_request` and pushes to `main` and `develop`), each job runs on a fresh virtual machine (`runs-on: ubuntu-latest`), and each step either runs a shell command (`run`) or uses a published action (`uses: owner/repo@version`) configured with `with`.',
        link: {
          label: 'GitHub Docs: Workflow syntax',
          href: 'https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions',
        },
      },
      {
        term: 'Concurrency',
        explanation:
          '`concurrency.group` puts runs with the same key in one queue; with `cancel-in-progress: true` a new run cancels the one in progress. The key `ci-${{ github.ref }}` is the branch for a push and the pull request ref for a pull request, so a second push to the same branch stops the stale run.',
        link: {
          label: 'GitHub Docs: Control the concurrency of workflows and jobs',
          href: 'https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs',
        },
      },
      {
        term: 'Base, head and affected',
        explanation:
          '`nx affected` compares two commits, `head` (what is checked out) and `base` (the last state known to be good), lists the changed files, and selects every task whose inputs match them. In Nx 24, with no `affected.legacy` setting, selection is per task: a change to `plan-domain` selects the `typecheck` of the projects that depend on it, through `^default` in their inputs, but not their `lint:fsd`, whose inputs are their own files and `steiger.config.ts`.',
        link: {
          label: 'Nx: Run only tasks affected by a change',
          href: 'https://nx.dev/docs/features/ci-features/affected',
        },
      },
      {
        term: 'Full history in the checkout',
        explanation:
          '`actions/checkout` fetches a single commit by default. The base commit is older, so without `fetch-depth: 0` there is nothing to compare with; the workflow says so in a comment on that line.',
        link: { label: 'actions/checkout', href: 'https://github.com/actions/checkout' },
      },
      {
        term: 'nx-set-shas',
        explanation:
          'The action asks the GitHub API for the last successful run of this workflow on a branch and exports that commit as `NX_BASE` and the current one as `NX_HEAD`, which `nx affected` reads. For a pull request it compares with the commit the branch started from. `main-branch-name` says which branch to look on; when no green run exists it falls back to `HEAD~1` with a warning.',
        link: { label: 'nrwl/nx-set-shas', href: 'https://github.com/nrwl/nx-set-shas' },
      },
      {
        term: 'Expressions and contexts',
        explanation:
          "`${{ github.event_name == 'push' && github.ref_name || github.base_ref }}` picks a branch name: on a push the pushed branch, so a push to `develop` is compared with the last green run on `develop`; on a pull request `github.base_ref`, the branch it targets. `&&` gives its right side when the left is true and `||` falls back otherwise, which works because a branch name is never empty.",
        link: {
          label: 'GitHub Docs: Contexts',
          href: 'https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/accessing-contextual-information-about-workflow-runs',
        },
      },
      {
        term: 'A reproducible install with a cached store',
        explanation:
          '`pnpm/action-setup` installs the pnpm version named in `packageManager` (`pnpm@12.21.0`), and `actions/setup-node` with `cache: pnpm` restores the pnpm store, which is why pnpm must be installed first. `pnpm install --frozen-lockfile` fails when `pnpm-lock.yaml` does not match the manifests instead of rewriting it.',
        link: { label: 'actions/setup-node', href: 'https://github.com/actions/setup-node' },
      },
      {
        term: 'Checks outside affected',
        explanation:
          'Not everything is an Nx target. `pnpm exec oxfmt --check` formats the whole repository from the root, and `pnpm run stand:test` renders every story in headless Chromium on every run. Each run also starts on a fresh machine with no Nx cache, so the selection of tasks is the only saving.',
      },
    ],
    decisions: [
      {
        question: 'What does CI run on each push?',
        options: [
          {
            name: 'Everything: `pnpm run check` and `pnpm run build`',
            pros: ['Cannot miss a task because of a wrong input'],
            cons: ['Time grows with every project, even for a one-line change'],
          },
          {
            name: '`nx affected` for the checks and the build, plus whole-repo format and story tests',
            pros: ['Only the tasks a change can affect run', 'The same command runs locally (`pnpm run affected`)'],
            cons: ['Correctness rests on the declared inputs', 'Needs the full history and a known-good base'],
          },
          {
            name: 'Affected plus a remote cache such as Nx Cloud',
            pros: ['Even affected tasks replay when another machine already ran them'],
            cons: ['An external service and a token for a personal project'],
          },
        ],
        chosen: '`nx affected` for the checks and the build, plus whole-repo format and story tests',
        why: '`0fc9c95` names it "an affected-only CI", and `docs/architecture.md` gives the effect it is for: CI "runs `nx affected`, so only the projects a change touches are type-checked, linted and built". The story tests run outside it because, per `8b71673`, the run "takes about five seconds, so CI runs it as well". Leaving out a remote cache is our reading.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '0fc9c95' },
          { kind: 'commit', ref: '8b71673' },
          { kind: 'file', ref: 'docs/architecture.md', note: 'lines 156-159' },
        ],
      },
      {
        question: 'Which commit is the base for a push?',
        options: [
          {
            name: 'The last green run on `main`',
            pros: ['One reference for every branch'],
            cons: ['Here `main` stays at its first commit, so pushes elsewhere never ran the workflow at all'],
          },
          {
            name: 'The last green run of the pushed branch',
            pros: ['A push checks everything since its own branch last passed'],
            cons: ['A branch with no green run yet falls back to `HEAD~1`'],
          },
          {
            name: 'The previous commit, `HEAD~1`',
            pros: ['No API call'],
            cons: ['A push of several commits, or a push after a red run, checks only the last commit'],
          },
        ],
        chosen: 'The last green run of the pushed branch',
        why: '`0515c33`: "All work lands on develop while main stays at its first commit, so the workflow never ran on this code. Pushes to develop now run it, and nx affected compares each push with the last green run of its own branch." The comment on `main-branch-name` adds that a pull request compares with its target.',
        evidence: 'evidenced',
        sources: [
          { kind: 'commit', ref: '0515c33' },
          { kind: 'file', ref: '.github/workflows/ci.yml', note: 'lines 27-30' },
        ],
      },
      {
        question: 'Where does the format check run?',
        options: [
          {
            name: 'One `oxfmt --check` over the repository',
            pros: ['Covers files outside every project: root configs, docs, the workflow', 'One fast process'],
            cons: ['Not selected by affected: runs in full every time'],
          },
          {
            name: 'A `format` target per project under Nx',
            pros: ['Cached and affected like the other checks'],
            cons: ['Root files belong to no project and would go unchecked'],
          },
        ],
        chosen: 'One `oxfmt --check` over the repository',
        why: 'Reconstruction. Since `56f2b5e` the root scripts keep Oxfmt out of Nx (`check` is `nx run-many … && oxfmt --check`), and the workflow copies that with a separate `pnpm exec oxfmt --check` step before `pnpm run affected`.',
        evidence: 'inferred',
        sources: [
          { kind: 'commit', ref: '56f2b5e' },
          { kind: 'file', ref: 'package.json', note: 'line 23' },
        ],
      },
    ],
    steps: [
      {
        title: 'Choose the triggers',
        detail:
          'The workflow runs for every pull request and for pushes to the long-lived branches. The first version listened to pushes on `main` only; `0515c33` added `develop`, where the work lands, with a comment saying that `main` moves only by release.',
        files: [
          {
            path: '.github/workflows/ci.yml',
            at: '0fc9c95',
            lines: [1, 6],
            note: 'The first triggers: pull requests and `main`.',
          },
          { path: '.github/workflows/ci.yml', lines: [3, 7], note: 'At the pinned commit: `main` and `develop`.' },
        ],
        commit: '0fc9c95',
      },
      {
        title: 'Cancel stale runs',
        detail:
          'One concurrency group per ref, with `cancel-in-progress: true`: when a branch is pushed again, the run for the older push stops. A pull request has its own ref, so its runs do not cancel the runs of the branch it targets.',
        files: [{ path: '.github/workflows/ci.yml', lines: [9, 11], note: 'The concurrency group.' }],
        commit: '0fc9c95',
      },
      {
        title: 'Check out the full history',
        detail:
          '`fetch-depth: 0` fetches every commit, so the base that `nx affected` compares with is in the clone. The comment on the line says exactly that.',
        files: [{ path: '.github/workflows/ci.yml', lines: [17, 20], note: 'Checkout with the whole history.' }],
        commit: '0fc9c95',
      },
      {
        title: 'Install pnpm and Node with a cached store',
        detail:
          '`pnpm/action-setup@v4` reads the version from `packageManager` in the root `package.json`, so CI and local machines use the same pnpm. `actions/setup-node@v4` installs Node 26, the version `engines` asks for, and caches the pnpm store; it comes after pnpm because the cache needs pnpm present.',
        files: [
          { path: '.github/workflows/ci.yml', lines: [21, 25], note: 'pnpm first, then Node with `cache: pnpm`.' },
          { path: 'package.json', lines: [41, 44], note: '`engines` and `packageManager`.' },
        ],
        commit: '0fc9c95',
      },
      {
        title: 'Install exactly what the lockfile says',
        detail:
          '`pnpm install --frozen-lockfile` refuses to touch `pnpm-lock.yaml`: a `package.json` changed without its lockfile fails here instead of installing something nobody reviewed. pnpm turns this on by default in CI; the flag states it anyway.',
        files: [{ path: '.github/workflows/ci.yml', lines: [26, 26], note: 'The install step.' }],
        commit: '0fc9c95',
      },
      {
        title: 'Set the base and head commits',
        detail:
          '`nrwl/nx-set-shas@v4` finds the last green run and exports `NX_BASE` and `NX_HEAD`, which `nx affected` reads without flags. `0515c33` added `main-branch-name` with an expression: on a push, the pushed branch; on a pull request, its target.',
        files: [
          {
            path: '.github/workflows/ci.yml',
            at: '0fc9c95',
            lines: [26, 26],
            note: 'The first version: the default branch, `main`.',
          },
          {
            path: '.github/workflows/ci.yml',
            lines: [27, 30],
            note: 'At the pinned commit: compare with the last green run of the same branch, or with the target of a pull request.',
          },
        ],
        commit: '0515c33',
      },
      {
        title: 'Check the formatting of the whole repository',
        detail:
          'Oxfmt runs once from the root, before the Nx tasks, and fails on any file it would change. It is the same check `pnpm run check` ends with.',
        files: [
          { path: '.github/workflows/ci.yml', lines: [31, 31], note: 'The format step.' },
          { path: 'package.json', lines: [20, 23], note: '`fmt`, `fmt:check` and `check` in the root scripts.' },
        ],
        commit: '0fc9c95',
      },
      {
        title: 'Run the affected checks',
        detail:
          '`pnpm run affected` is `nx affected -t typecheck lint lint:fsd check:i18n build --output-style=stream`. Nx compares `NX_BASE` with `NX_HEAD` and runs each of those targets only where a changed file is among its inputs, in dependency order. A change to `pnpm-lock.yaml` or `tsconfig.base.json` is in `sharedGlobals`, so it selects every task.',
        files: [
          { path: '.github/workflows/ci.yml', lines: [32, 32], note: 'The affected step.' },
          { path: 'package.json', lines: [24, 24], note: 'The targets `affected` runs.' },
          {
            path: 'nx.json',
            lines: [3, 9],
            note: '`defaultBase` for local runs, and the inputs that decide what is affected.',
          },
        ],
        commit: '0fc9c95',
      },
      {
        title: 'Run the story tests',
        detail:
          'The component stand (chapter 13) renders every story in headless Chromium and fails on a broken render, a failing interaction or an accessibility violation. CI installs Chromium for the stand package and runs the tests on every push, not through affected.',
        files: [
          { path: '.github/workflows/ci.yml', lines: [33, 34], note: 'Install the browser, then run the stories.' },
          { path: 'package.json', lines: [12, 12], note: 'The `stand:test` script.' },
          {
            path: 'apps/stand/package.json',
            lines: [6, 12],
            note: 'The stand runs Vitest twice, in the light and the dark theme.',
          },
        ],
        commit: '8b71673',
      },
    ],
    checkpoint: {
      commands: [
        'pnpm run affected',
        'pnpm exec nx show projects --affected --base=HEAD~1 --head=HEAD',
        'pnpm exec nx affected -t typecheck --base=HEAD~1 --head=HEAD',
        'pnpm exec oxfmt --check',
      ],
      expect: [
        'Locally `pnpm run affected` compares with `defaultBase`, which is `main`, still the first commit of this repository: nearly every task is selected. In CI `nx-set-shas` sets `NX_BASE` instead.',
        'After a commit that only changes `packages/plan-domain/src/changes.ts`, the typecheck runs in `@lc/plan-domain` and in the projects that depend on it, and not in `@lc/ui` or `@lc/i18n`.',
        '`oxfmt --check` exits with 0 on a formatted tree and lists the files it would change otherwise.',
        'On GitHub a push to `develop` starts one CI run, and a second push before it ends cancels the first.',
      ],
      quiz: [
        {
          question: 'Why does the checkout step set `fetch-depth: 0`?',
          options: [
            'To make the checkout faster',
            '`nx affected` needs the base commit, which a one-commit clone does not contain',
            'pnpm needs the git tags to install',
            'Oxfmt reads the history to find changed files',
          ],
          answer: 1,
          explanation:
            'The default checkout fetches only the commit being tested. With no base commit in the clone there is nothing to compare with.',
        },
        {
          question: 'A pull request targets `develop`. What does `main-branch-name` evaluate to?',
          options: [
            '`main`',
            'The name of the pull request branch',
            '`develop`, from `github.base_ref`',
            'An empty string',
          ],
          answer: 2,
          explanation:
            'The event is not a push, so the `&&` part is false and `||` falls back to `github.base_ref`, the target of the pull request.',
        },
        {
          question: 'Which statement about the CI at the pinned commit is true?',
          options: [
            'It runs the Vitest unit tests of `plan-domain` on every push',
            'Its affected targets are typecheck, lint, lint:fsd, check:i18n and build; `test` is not among them',
            'It restores the Nx cache from the previous run',
            'It runs only for pushes to `main`',
          ],
          answer: 1,
          explanation:
            'The root `affected` script lists five targets and no `test`, and no workflow step runs `pnpm run test`. The unit tests run only locally.',
        },
      ],
    },
    pitfalls: [
      'A workflow that never runs: it listened only to pushes to `main` while all work landed on `develop`; `0515c33` added `develop`.',
      'A shallow clone: with the default `fetch-depth` of 1 the base commit is missing and there is nothing to compare with. Keep `fetch-depth: 0`.',
      'Unit tests left out: the root `affected` script lists `typecheck lint lint:fsd check:i18n build`, so the Vitest suites of `plan-domain` and `plan-data` do not run in CI at the pinned commit. Add `test` to the list to cover them.',
      'A task with too narrow inputs is skipped: task-based affected selects a task of a dependent project only through inputs such as `^default`, so a new target whose inputs list only its own files will not run when a dependency changes.',
      'A lockfile change selects everything: `pnpm-lock.yaml` is in `sharedGlobals`, part of `default`, and Nx treats a lockfile change as affecting every task.',
      'Different bases locally and in CI: locally `defaultBase` is `main`, the first commit here, so `pnpm run affected` checks almost everything. Pass `--base` to compare with something closer.',
    ],
    tradeoffs: [
      'Affected saves time in proportion to how local a change is, and trusts the declared inputs completely.',
      'No cache survives between CI runs, so every selected task really runs; a remote cache would add a service and a secret.',
      'The format check and the story tests run in full every time, a few seconds each, in exchange for not depending on inputs.',
      '`cancel-in-progress` saves minutes, but a cancelled run is not green, so the next push compares with an older base and checks more.',
    ],
    links: [
      {
        label: 'GitHub Docs: Workflow syntax',
        href: 'https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions',
      },
      {
        label: 'GitHub Docs: Concurrency',
        href: 'https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs',
      },
      {
        label: 'GitHub Docs: Contexts',
        href: 'https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/accessing-contextual-information-about-workflow-runs',
      },
      { label: 'actions/checkout', href: 'https://github.com/actions/checkout' },
      { label: 'pnpm/action-setup', href: 'https://github.com/pnpm/action-setup' },
      { label: 'actions/setup-node', href: 'https://github.com/actions/setup-node' },
      { label: 'nrwl/nx-set-shas', href: 'https://github.com/nrwl/nx-set-shas' },
      { label: 'Nx: Run only tasks affected by a change', href: 'https://nx.dev/docs/features/ci-features/affected' },
    ],
    next: 'CI checks types, lint and the build, but not how the components look or behave: chapter 13 adds a component stand where every story is rendered and tested in a browser.',
  },
] satisfies readonly Syllabus[]
