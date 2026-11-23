// Colors, fonts, the shadow and the breakpoints are parsed from the stylesheet itself, so they cannot drift from
// what the components use. Radii and type sizes are not tokens there: those samples are listed by hand.
import { Button, Dot, INPUT, Kbd, calendarColor } from '@lc/ui'
import type { ReactNode } from 'react'

import css from '@lc/ui/theme.css?raw'

/** Custom properties declared in the first block that follows `marker`. */
function declarations(marker: string): [name: string, value: string][] {
  const start = css.indexOf(marker)
  if (start === -1) return []
  const open = css.indexOf('{', start)
  const body = css.slice(open + 1, css.indexOf('}', open))
  return [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].flatMap(([, name, value]): [name: string, value: string][] =>
    name !== undefined && value !== undefined ? [[name, value.trim()]] : [],
  )
}

const light = declarations(':root {')
const dark = new Map(declarations(":root:has(> head > meta[name='color-scheme'][content='dark'])"))
const theme = new Map(declarations('@theme {'))
const utilities = new Map(declarations('@theme inline {').map(([name, value]) => [value, name.replace('color-', '')]))

const Card = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-line bg-bg p-4 font-sans text-[15px]/[1.5] text-ink">{children}</div>
)

export function Colors() {
  const colors = light.filter(([, value]) => value.startsWith('#'))
  return (
    <Card>
      <div className="grid gap-2.5 md:grid-cols-2">
        {colors.map(([name, value]) => (
          <div key={name} className="flex items-center gap-3 rounded-[10px] border border-line bg-surface p-2.5">
            <span
              className="size-11 flex-none rounded-lg border border-line"
              style={{ background: `var(--${name})` }}
            />
            <span className="min-w-0 text-[13px]">
              <b className="block font-semibold">
                --{name} <span className="font-normal text-muted">· {utilities.get(`var(--${name})`)}</span>
              </b>
              <span className="text-muted tabular-nums">
                light {value} · dark {dark.get(name)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

const RADII = [
  { name: 'rounded-md', where: 'Kbd, the focus ring (6px)', sample: <Kbd>⌘ K</Kbd> },
  { name: 'rounded-lg', where: 'inputs (INPUT)', sample: <input className={INPUT} defaultValue="Text" /> },
  { name: 'rounded-[10px]', where: 'Button, Segmented, chips', sample: <Button>Button</Button> },
  {
    name: 'rounded-2xl',
    where: 'cards, Modal',
    sample: <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px]">Card</div>,
  },
  {
    name: 'rounded-full',
    where: 'Dot, round markers',
    sample: (
      <span style={calendarColor('#2F5BEA')}>
        <Dot className="size-4" />
      </span>
    ),
  },
]

export function Radii() {
  return (
    <Card>
      <div className="grid gap-2.5">
        {RADII.map((radius) => (
          <div key={radius.name} className="grid grid-cols-[150px_1fr] items-center gap-3 text-[13px]">
            <div>{radius.sample}</div>
            <div>
              <b className="font-semibold">{radius.name}</b> <span className="text-muted">· {radius.where}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function Typography() {
  return (
    <Card>
      <div className="grid gap-4">
        <div>
          <b className="font-display text-[40px] leading-none font-bold tracking-[-0.03em] tabular-nums">38</b>
          <b className="ml-3 font-display text-[22px] font-medium">План обучения · Study plan</b>
          <p className="mt-1 text-[12.5px] text-muted">font-display · {theme.get('font-display')}</p>
        </div>
        <div>
          <p className="text-[18px]/[1.3] font-semibold">Заголовок диалога · Dialog title, 18px semibold</p>
          <p>Основной текст · Body text, 15px / 1.5</p>
          <p className="text-[13.5px] text-muted">Подпись · Meta line, 13.5px muted</p>
          <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">Section label, 12px uppercase</p>
          <p className="mt-1 text-[12.5px] text-muted">font-sans · {theme.get('font-sans')}</p>
        </div>
      </div>
    </Card>
  )
}

export function Breakpoints() {
  const points = [...theme].filter(([name]) => name.startsWith('breakpoint-') && !name.endsWith('*'))
  return (
    <Card>
      <ul className="grid gap-1 text-[13px]">
        {points.map(([name, value]) => (
          <li key={name}>
            <b className="font-semibold">{name.replace('breakpoint-', '')}:</b> from {value}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function Shadow() {
  const value = light.find(([name]) => name === 'shadow')?.[1]
  return (
    <Card>
      <div className="flex items-center gap-3 text-[13px]">
        <Button>shadow-card</Button>
        <span className="text-muted">
          light {value} · dark {dark.get('shadow')}
        </span>
      </div>
    </Card>
  )
}
