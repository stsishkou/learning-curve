import { CHAPTERS } from '@lc/docs-contract'
import { useId, useState } from 'react'

import { useLocale } from '../app/env'
import { EDGES, type MapNode, NODES, type Row, visibleAt } from '../content/architecture'
import { chapterTitle } from '../content/titles'
import { m } from '../paraglide/messages'

const WIDTH = 960
const NODE_W = 172
const NODE_H = 52
const ROW_Y: Record<Row, number> = { entry: 24, module: 150, package: 276 }
const ROW_COLUMNS: Record<Row, number> = { entry: 5, module: 3, package: 5 }

function position(node: MapNode) {
  const columns = ROW_COLUMNS[node.row]
  const slot = WIDTH / columns
  return { x: slot * node.column + (slot - NODE_W) / 2, y: ROW_Y[node.row] }
}

/**
 * The repository as boxes and arrows after a chosen chapter: entry points on top, modules in the middle, shared
 * packages below. Arrows are imports resolved at build time; dashed ones are loaded at run time over the network.
 */
export function ArchitectureMap({ initialChapter = CHAPTERS.length }: { initialChapter?: number | undefined }) {
  const locale = useLocale()
  const [chapter, setChapter] = useState(initialChapter)
  const sliderId = useId()
  const titleId = useId()
  const nodes = NODES.filter((node) => visibleAt(node, chapter))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges = EDGES.flatMap((edge) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    return from && to ? [{ ...edge, from, to }] : []
  })
  const shown = CHAPTERS.find((entry) => entry.number === chapter)
  const title = shown ? chapterTitle(shown.id, locale) : ''
  return (
    <figure className="lc-card flex flex-col gap-3 p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={titleId} className="font-semibold">
          {m.map_title({ number: chapter }, { locale })}
        </span>
        <span className="text-sm text-muted">{title}</span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} 352`} className="h-auto w-full" role="img" aria-labelledby={titleId}>
        <defs>
          <marker
            id={`${sliderId}-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10z" className="fill-muted" />
          </marker>
        </defs>
        {edges.map(({ from, to, runtime }) => {
          const a = position(from)
          const b = position(to)
          const x1 = a.x + NODE_W / 2
          const y1 = a.y + NODE_H
          const x2 = b.x + NODE_W / 2
          const y2 = b.y
          const middle = (y1 + y2) / 2
          return (
            <path
              key={`${from.id}-${to.id}`}
              d={`M${x1} ${y1} C${x1} ${middle} ${x2} ${middle} ${x2} ${y2 - 2}`}
              className={`fill-none ${runtime ? 'stroke-focus [stroke-dasharray:6_5]' : 'stroke-line'}`}
              strokeWidth={runtime ? 2 : 1.5}
              markerEnd={`url(#${sliderId}-arrow)`}
            />
          )
        })}
        {nodes.map((node) => {
          const { x, y } = position(node)
          const fresh = node.since === chapter
          return (
            <g key={node.id} className="motion-safe:animate-[lc-fade-in_300ms_ease-out]">
              <title>{`${node.label} — ${node.path}`}</title>
              <rect
                x={x}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={12}
                className={`fill-surface ${fresh ? 'stroke-focus' : 'stroke-line'}`}
                strokeWidth={fresh ? 2.5 : 1.5}
              />
              <text x={x + NODE_W / 2} y={y + 22} textAnchor="middle" className="fill-ink text-[15px] font-semibold">
                {node.label}
              </text>
              <text x={x + NODE_W / 2} y={y + 40} textAnchor="middle" className="fill-muted font-mono text-[11px]">
                {node.path}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-3">
        <label htmlFor={sliderId} className="shrink-0 text-sm text-muted">
          {m.map_slider({}, { locale })}
        </label>
        <input
          id={sliderId}
          type="range"
          className="w-full"
          min={1}
          max={CHAPTERS.length}
          value={chapter}
          aria-valuetext={`${chapter}. ${title}`}
          onChange={(event) => setChapter(Number(event.target.value))}
        />
        <output htmlFor={sliderId} className="w-6 shrink-0 text-right font-semibold tabular-nums">
          {chapter}
        </output>
      </div>
      <ul className="sr-only">
        {nodes.map((node) => (
          <li key={node.id}>
            {node.label} ({node.path}){node.since === chapter ? ` — ${m.map_new({}, { locale })}` : ''}
          </li>
        ))}
      </ul>
    </figure>
  )
}
