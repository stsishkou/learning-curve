// The list is read from the story files themselves, so a new component appears here without being added by hand.
import type { MouseEvent } from 'react'
import { NAVIGATE_URL } from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'

import { sourceOf } from './source'

interface StoryFile {
  default: {
    title: string
    component?: { __docgenInfo?: { description?: string } }
    parameters?: { docs?: { description?: { component?: string } } }
  }
}

const files = import.meta.glob<StoryFile>(
  ['../../../../packages/ui/src/**/*.stories.tsx', '../../../../modules/*/src/**/*.stories.tsx'],
  { eager: true },
)

// The same order as the sidebar: `storySort` in `.storybook/preview.tsx`.
const SECTIONS = [
  'UI kit',
  'Planner/Page',
  'Planner/Widgets',
  'Planner/Features',
  'Dashboard/Page',
  'Dashboard/Widgets',
  'Calendar export',
]

const entries = Object.entries(files).map(([path, file]) => {
  const { title, component, parameters } = file.default
  const cut = title.lastIndexOf('/')
  const stories = Object.keys(file).filter((name) => name !== 'default' && name !== '__namedExportsOrder').length
  return {
    section: title.slice(0, cut),
    name: title.slice(cut + 1),
    // Storybook's own rule for an id: lower case, every run of other characters becomes one dash.
    href: `?path=/docs/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}--docs`,
    source: sourceOf(path),
    // oxlint-disable-next-line no-underscore-dangle -- the name the docs generator gives the field
    description: parameters?.docs?.description?.component ?? component?.__docgenInfo?.description ?? '',
    stories,
  }
})

// A plain link would load the address inside the preview frame; the manager has to do the navigation.
function open(e: MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  addons.getChannel().emit(NAVIGATE_URL, e.currentTarget.getAttribute('href'))
}

/** First sentence of a description, without the Markdown backticks. */
const summary = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/`/g, '')
    .match(/^.*?\.(?=\s|$)/)?.[0] ?? text

export function Catalog() {
  return (
    <div className="grid gap-6 font-sans text-[15px]/[1.5] text-ink">
      {SECTIONS.map((section) => {
        const rows = entries.filter((e) => e.section === section).toSorted((a, b) => a.name.localeCompare(b.name))
        return (
          <section key={section}>
            <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
              {section.replace('/', ' / ')} · {rows.length}
            </h3>
            <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
              {rows.map((row) => (
                <li
                  key={row.name}
                  className="grid gap-x-4 gap-y-0.5 border-b border-line-soft px-4 py-2.5 last:border-b-0 md:grid-cols-[190px_1fr]"
                >
                  <a href={row.href} className="font-semibold text-focus hover:underline" onClick={open}>
                    {row.name}
                  </a>
                  <span className="min-w-0">
                    <span className="block text-[14px]">{summary(row.description)}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {row.source} · {row.stories} {row.stories === 1 ? 'story' : 'stories'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
