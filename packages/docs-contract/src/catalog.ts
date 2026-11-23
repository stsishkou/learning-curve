// The table of contents every consumer shares: the docs site renders it, the federated features open it, the
// component stand links each story to the chapters behind it. Adding a chapter is a minor version of the contract.

/** The commit the guide is written against: every excerpt and link points at this tree. */
export const PINNED_COMMIT = '7351e1e83d980dc6d650f3743612ad549c403452'
export const REPOSITORY_URL = 'https://github.com/stsishkou/learning-curve'

/** Feature-Sliced slices of the root app, plus the packages and the shell, as `module/layer/slice` paths. */
export const FEATURES = [
  'web/shell',
  'plan-domain',
  'plan-data',
  'i18n',
  'ui',
  'planner/pages/planner',
  'planner/pages/timeline',
  'planner/pages/focus',
  'planner/widgets/agenda-list',
  'planner/widgets/budget-panel',
  'planner/widgets/course-progress',
  'planner/widgets/goal-ladder',
  'planner/widgets/mini-month',
  'planner/widgets/month-grid',
  'planner/widgets/now-next',
  'planner/widgets/plan-map',
  'planner/widgets/runway',
  'planner/widgets/timeline-lanes',
  'planner/widgets/week-grid',
  'planner/widgets/year-grid',
  'planner/features/backlog',
  'planner/features/busy-overlay',
  'planner/features/calendar-sync',
  'planner/features/catch-up',
  'planner/features/command-palette',
  'planner/features/edit-event',
  'planner/features/filter-calendars',
  'planner/features/history',
  'planner/features/keyboard-shortcuts',
  'planner/features/manage-calendars',
  'planner/features/open-plan-file',
  'planner/features/plan-reviews',
  'planner/features/reminders',
  'planner/features/rename-plan',
  'planner/features/reschedule',
  'planner/features/second-zone',
  'planner/features/trash',
  'planner/features/week-review',
  'calendar-export/features/export-calendars',
  'dashboard/pages/dashboard',
  'dashboard/widgets/burn-up',
  'dashboard/widgets/course-bars',
  'dashboard/widgets/pace-forecast',
  'dashboard/widgets/stat-tiles',
  'dashboard/widgets/study-streak',
  'dashboard/widgets/weekly-load',
] as const

export type FeatureId = (typeof FEATURES)[number]

export const PARTS = [
  { id: 'ground', number: 1, title: 'Ground: tooling, skeleton, shell', color: '#2f5bea' },
  { id: 'structure', number: 2, title: 'The first real feature, and the structure it forced', color: '#c98a0b' },
  { id: 'infrastructure', number: 3, title: 'Shared infrastructure', color: '#14897a' },
  { id: 'features', number: 4, title: 'More features', color: '#7a5ac8' },
  { id: 'shipping', number: 5, title: 'Hardening and shipping', color: '#c2456e' },
  { id: 'runtime', number: 6, title: 'Runtime microfrontends', color: '#7d8796' },
] as const

export type PartId = (typeof PARTS)[number]['id']

export interface ChapterEntry {
  id: string
  number: number
  part: PartId
  title: string
  /** Commits the chapter quotes, oldest first */
  commits: readonly string[]
  /** Slices of the root app the chapter builds or changes */
  features: readonly FeatureId[]
  /** Storybook story ids that show what the chapter builds */
  stories: readonly string[]
  /** Reading time, in minutes */
  minutes: number
}

export const CHAPTERS = [
  {
    id: 'scaffold',
    number: 1,
    part: 'ground',
    title: 'An empty folder becomes a TanStack Start app',
    commits: ['1370abc', '201ce64'],
    features: ['web/shell'],
    stories: [],
    minutes: 25,
  },
  {
    id: 'plan-as-code',
    number: 2,
    part: 'ground',
    title: 'The plan is code',
    commits: ['1370abc'],
    features: ['plan-domain', 'plan-data'],
    stories: [],
    minutes: 25,
  },
  {
    id: 'first-screen',
    number: 3,
    part: 'ground',
    title: 'The first screen and the first API',
    commits: ['1370abc', '7b49692'],
    features: [
      'web/shell',
      'planner/widgets/week-grid',
      'planner/widgets/agenda-list',
      'planner/widgets/budget-panel',
      'planner/widgets/runway',
      'planner/features/filter-calendars',
      'calendar-export/features/export-calendars',
    ],
    stories: [
      'planner-widgets-weekgrid--default',
      'planner-widgets-agendalist--default',
      'planner-widgets-budgetpanel--default',
      'planner-widgets-runway--default',
    ],
    minutes: 30,
  },
  {
    id: 'guardrails',
    number: 4,
    part: 'ground',
    title: 'Guardrails: types, lint, format, commits',
    commits: ['745c75f', '6aca64f', 'cf3a240', 'eb92d24', 'a372236', 'e482350'],
    features: [],
    stories: [],
    minutes: 25,
  },
  {
    id: 'tokens-and-themes',
    number: 5,
    part: 'ground',
    title: 'Tokens and two themes',
    commits: ['4c636c0', '186aea9', '27e6764'],
    features: ['ui'],
    stories: ['ui-kit-button--default', 'ui-kit-segmented--default', 'ui-kit-calendarcolor--palette'],
    minutes: 20,
  },
  {
    id: 'three-languages',
    number: 6,
    part: 'ground',
    title: 'Three languages',
    commits: ['4c636c0', '8bc261a'],
    features: ['i18n', 'web/shell'],
    stories: ['ui-kit-segmented--languages'],
    minutes: 25,
  },
  {
    id: 'edits-overlay',
    number: 7,
    part: 'structure',
    title: 'Edits that survive regeneration',
    commits: ['746a107', '89467f9'],
    features: ['plan-domain', 'plan-data', 'planner/features/edit-event'],
    stories: ['planner-features-eventdialog--session', 'planner-features-eventdialog--done-and-edited'],
    minutes: 30,
  },
  {
    id: 'direct-manipulation',
    number: 8,
    part: 'structure',
    title: 'Direct manipulation',
    commits: ['afbc8ca', 'de4b223', '89467f9'],
    features: [
      'planner/widgets/week-grid',
      'planner/widgets/month-grid',
      'planner/features/edit-event',
      'planner/features/keyboard-shortcuts',
    ],
    stories: ['planner-widgets-weekgrid--drafting', 'planner-widgets-monthgrid--default'],
    minutes: 25,
  },
  {
    id: 'workspace',
    number: 9,
    part: 'structure',
    title: 'One app becomes a workspace',
    commits: ['56f2b5e'],
    features: [],
    stories: [],
    minutes: 25,
  },
  {
    id: 'packages',
    number: 10,
    part: 'structure',
    title: 'Packages and the direction of dependencies',
    commits: ['6d9869b', 'b3a4fd5', 'e24a983'],
    features: ['plan-domain', 'plan-data', 'i18n', 'ui'],
    stories: [],
    minutes: 30,
  },
  {
    id: 'build-time-microfrontends',
    number: 11,
    part: 'structure',
    title: 'Build-time microfrontends',
    commits: ['cf289bd', '60fdbe1', '632e3aa'],
    features: [
      'web/shell',
      'planner/pages/planner',
      'calendar-export/features/export-calendars',
      'dashboard/pages/dashboard',
    ],
    stories: [
      'planner-page-plannerpage--week',
      'calendar-export-exportdialog--default',
      'dashboard-page-dashboardpage--default',
    ],
    minutes: 40,
  },
  {
    id: 'affected-ci',
    number: 12,
    part: 'structure',
    title: 'CI that checks only what changed',
    commits: ['0fc9c95', '0515c33'],
    features: [],
    stories: [],
    minutes: 15,
  },
  {
    id: 'component-stand',
    number: 13,
    part: 'infrastructure',
    title: 'A component stand',
    commits: ['983f61a', '8b71673', '6495a57', '2bf664d'],
    features: ['ui'],
    stories: ['ui-kit-button--default', 'ui-kit-modal--normal', 'ui-kit-tooltip--default'],
    minutes: 30,
  },
  {
    id: 'history',
    number: 14,
    part: 'infrastructure',
    title: 'Every change is a step',
    commits: ['972da82', '32c9733', '931fbd6'],
    features: ['planner/features/history', 'planner/features/trash', 'planner/features/manage-calendars'],
    stories: ['planner-features-historydialog--one-step-back', 'planner-features-trashdialog--default'],
    minutes: 30,
  },
  {
    id: 'dashboard-module',
    number: 15,
    part: 'features',
    title: 'A third module: the progress dashboard',
    commits: ['632e3aa', 'a9a4f72', 'cb758b9'],
    features: [
      'dashboard/pages/dashboard',
      'dashboard/widgets/burn-up',
      'dashboard/widgets/course-bars',
      'dashboard/widgets/pace-forecast',
      'dashboard/widgets/stat-tiles',
      'dashboard/widgets/study-streak',
      'dashboard/widgets/weekly-load',
    ],
    stories: ['dashboard-page-dashboardpage--default', 'dashboard-widgets-burnup--with-forecast'],
    minutes: 25,
  },
  {
    id: 'planner-grows',
    number: 16,
    part: 'features',
    title: 'The planner grows',
    commits: ['b8f20ca', 'ad44560', '3a7cf48', '5630ed9', '610a506', 'ddc347c', '928e180'],
    features: [
      'planner/pages/focus',
      'planner/features/command-palette',
      'planner/features/second-zone',
      'planner/widgets/mini-month',
      'planner/features/rename-plan',
      'planner/features/reminders',
      'planner/features/plan-reviews',
      'planner/features/catch-up',
      'planner/features/week-review',
      'planner/widgets/year-grid',
      'planner/widgets/now-next',
      'planner/widgets/goal-ladder',
      'planner/widgets/course-progress',
    ],
    stories: [
      'planner-features-commandpalette--quick-event',
      'planner-page-focuspage--default',
      'planner-features-catchupdialog--a-few-days-behind',
    ],
    minutes: 35,
  },
  {
    id: 'language-models',
    number: 17,
    part: 'features',
    title: 'Talking to language models',
    commits: ['a20dc07', '7267049', '6db86bf', 'd282b5a', 'febfff0'],
    features: ['plan-domain', 'plan-data', 'planner/features/open-plan-file'],
    stories: ['planner-features-planfilereader--ai-chat'],
    minutes: 35,
  },
  {
    id: 'calendar-sync',
    number: 18,
    part: 'features',
    title: 'Two-way calendar sync',
    commits: ['75998b8', '8958caa', '2a4c3f5', '2ed2657', 'd542fd2', '960f8ae', 'ac74d5e'],
    features: [
      'plan-domain',
      'plan-data',
      'planner/features/calendar-sync',
      'planner/features/busy-overlay',
      'calendar-export/features/export-calendars',
    ],
    stories: ['planner-features-integrationsdialog--default', 'planner-features-calendarreviewdialog--default'],
    minutes: 40,
  },
  {
    id: 'rebalancing',
    number: 19,
    part: 'features',
    title: 'Re-balancing with an integer program',
    commits: ['bdd8d04', '8e70267', '2610a28', '7173882', '2a170c2', 'd9eac79', 'd5a6fc2', 'a9b9fb0'],
    features: ['plan-domain', 'plan-data', 'planner/features/reschedule'],
    stories: ['planner-features-rescheduledialog--rebalance-by-pace', 'planner-features-rescheduledialog--shortfall'],
    minutes: 40,
  },
  {
    id: 'timeline',
    number: 20,
    part: 'features',
    title: 'The timeline',
    commits: ['e34fdc5', '5daf7e2', 'ec1c80c', '0fb5bfd', '5487601', 'c68d4a4'],
    features: ['planner/pages/timeline', 'planner/widgets/timeline-lanes', 'planner/widgets/plan-map'],
    stories: ['planner-page-timelinepage--drag-makes-a-draft', 'planner-widgets-timelinechart--default'],
    minutes: 35,
  },
  {
    id: 'polish-accessibility',
    number: 21,
    part: 'shipping',
    title: 'Polish that is accessibility',
    commits: ['af02738', '98de33a', '569ce61', 'dd4d697', '8081744', '7d6990b', '7351e1e'],
    features: ['ui', 'planner/features/keyboard-shortcuts', 'planner/features/backlog'],
    stories: ['ui-kit-hint--default', 'ui-kit-tooltip--on-keyboard-focus', 'ui-kit-iconsonly--default'],
    minutes: 30,
  },
  {
    id: 'shipping',
    number: 22,
    part: 'shipping',
    title: 'Shipping it: where the planner can run',
    commits: ['d9eac79'],
    features: ['web/shell', 'plan-data'],
    stories: [],
    minutes: 35,
  },
  {
    id: 'module-federation',
    number: 23,
    part: 'runtime',
    title: 'From build time to run time: Module Federation',
    commits: [],
    features: ['web/shell'],
    stories: [],
    minutes: 40,
  },
  {
    id: 'docs-remote',
    number: 24,
    part: 'runtime',
    title: 'This guide as a remote: contract, isolation, deploy',
    commits: [],
    features: ['web/shell'],
    stories: [],
    minutes: 40,
  },
] as const satisfies readonly ChapterEntry[]

export type Chapter = (typeof CHAPTERS)[number]
export type ChapterId = Chapter['id']

const featureSet: ReadonlySet<string> = new Set(FEATURES)
const chapterIds: ReadonlySet<string> = new Set(CHAPTERS.map((chapter) => chapter.id))

export const isFeatureId = (value: string): value is FeatureId => featureSet.has(value)
export const isChapterId = (value: string): value is ChapterId => chapterIds.has(value)

export function chapterById(id: ChapterId): Chapter {
  const chapter = CHAPTERS.find((entry) => entry.id === id)
  if (!chapter) throw new Error(`No chapter ${id}`)
  return chapter
}

/** The chapters that build or change a slice, in reading order. */
export function chaptersForFeature(feature: FeatureId): Chapter[] {
  return CHAPTERS.filter((chapter) => chapter.features.some((id: FeatureId) => id === feature))
}

/**
 * The slice a story file belongs to, read from its path: `modules/<module>/src/<layer>/<slice>/…`, or the UI kit.
 * The component stand passes `importPath` of the story on screen.
 */
export function featureOfPath(path: string): FeatureId | null {
  if (/(^|\/)packages\/ui\//.test(path)) return 'ui'
  const match = /(?:^|\/)modules\/([\w-]+)\/src\/(pages|widgets|features)\/([\w-]+)\//.exec(path)
  if (!match) return null
  const [, module, layer, slice] = match
  const id = `${module ?? ''}/${layer ?? ''}/${slice ?? ''}`
  return isFeatureId(id) ? id : null
}

/** A file of the repository at the pinned commit (or another), optionally a range of lines. */
export function sourceUrl(path: string, lines?: readonly [number, number], at: string = PINNED_COMMIT): string {
  const anchor = lines ? `#L${lines[0]}-L${lines[1]}` : ''
  return `${REPOSITORY_URL}/blob/${at}/${path}${anchor}`
}

export const commitUrl = (sha: string): string => `${REPOSITORY_URL}/commit/${sha}`
