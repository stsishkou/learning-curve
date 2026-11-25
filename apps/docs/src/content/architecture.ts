// The shape of the repository after each chapter, for the architecture map. A node appears in the chapter whose
// commit added its folder (see `git log --diff-filter=A -- <path>`) and leaves when a later one replaced it.
export type Row = 'entry' | 'module' | 'package'

export interface MapNode {
  id: string
  label: string
  /** The path in the repository, shown under the label */
  path: string
  row: Row
  /** Column, 0–4 */
  column: number
  since: number
  until?: number | undefined
}

export interface MapEdge {
  from: string
  to: string
  /** Loaded at run time over the network instead of bundled at build time */
  runtime?: boolean | undefined
}

export const NODES: readonly MapNode[] = [
  { id: 'app', label: 'learning-curve', path: 'src/', row: 'entry', column: 1, since: 1, until: 8 },
  { id: 'plan', label: 'plan content', path: 'src/lib/plan/', row: 'package', column: 0, since: 2, until: 9 },
  { id: 'web', label: 'web', path: 'apps/web', row: 'entry', column: 1, since: 9 },
  { id: 'plan-domain', label: 'plan-domain', path: 'packages/plan-domain', row: 'package', column: 0, since: 10 },
  { id: 'plan-data', label: 'plan-data', path: 'packages/plan-data', row: 'package', column: 1, since: 10 },
  { id: 'i18n', label: 'i18n', path: 'packages/i18n', row: 'package', column: 2, since: 10 },
  { id: 'ui', label: 'ui', path: 'packages/ui', row: 'package', column: 3, since: 10 },
  { id: 'planner', label: 'planner', path: 'modules/planner', row: 'module', column: 0, since: 11 },
  {
    id: 'calendar-export',
    label: 'calendar-export',
    path: 'modules/calendar-export',
    row: 'module',
    column: 1,
    since: 11,
  },
  { id: 'stand', label: 'stand', path: 'apps/stand', row: 'entry', column: 0, since: 13 },
  { id: 'dashboard', label: 'dashboard', path: 'modules/dashboard', row: 'module', column: 2, since: 15 },
  { id: 'mcp', label: 'MCP server', path: 'plan-data/scripts/mcp.ts', row: 'entry', column: 2, since: 17 },
  { id: 'docs', label: 'docs · lc_docs', path: 'apps/docs', row: 'entry', column: 3, since: 23 },
  { id: 'docs-contract', label: 'docs-contract', path: 'packages/docs-contract', row: 'package', column: 4, since: 24 },
  { id: 'harness', label: 'docs-harness', path: 'apps/docs-harness', row: 'entry', column: 4, since: 24 },
]

export const EDGES: readonly MapEdge[] = [
  { from: 'app', to: 'plan' },
  { from: 'web', to: 'planner' },
  { from: 'web', to: 'calendar-export' },
  { from: 'web', to: 'dashboard' },
  { from: 'web', to: 'plan-data' },
  { from: 'planner', to: 'plan-domain' },
  { from: 'planner', to: 'ui' },
  { from: 'planner', to: 'i18n' },
  { from: 'calendar-export', to: 'plan-domain' },
  { from: 'calendar-export', to: 'ui' },
  { from: 'dashboard', to: 'plan-domain' },
  { from: 'dashboard', to: 'ui' },
  { from: 'plan-data', to: 'plan-domain' },
  { from: 'stand', to: 'planner' },
  { from: 'stand', to: 'dashboard' },
  { from: 'mcp', to: 'plan-data' },
  { from: 'web', to: 'docs', runtime: true },
  { from: 'docs', to: 'docs-contract' },
  { from: 'docs', to: 'ui' },
  { from: 'web', to: 'docs-contract' },
  { from: 'harness', to: 'docs', runtime: true },
  { from: 'harness', to: 'docs-contract' },
]

export const visibleAt = (node: MapNode, chapter: number) =>
  node.since <= chapter && (node.until ?? Infinity) >= chapter
