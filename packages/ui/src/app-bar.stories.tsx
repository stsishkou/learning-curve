import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { expect, waitFor, within } from 'storybook/test'

import { AppBar } from './app-bar'
import { Button } from './button'
import { Maximize, Maximize2, Settings } from './icons'

const TAB =
  'rounded-[10px] px-3 py-2 text-[13.5px] font-medium whitespace-nowrap text-muted aria-[current=page]:bg-surface aria-[current=page]:text-ink'
const SECTIONS = ['Plan', 'Timeline', 'Focus', 'Progress']

const tabs = (current: string) =>
  SECTIONS.map((name) => (
    <a key={name} href={`#${name}`} className={TAB} aria-current={name === current ? 'page' : undefined}>
      {name}
    </a>
  ))

const buttons = (
  <>
    <Button className="flex items-center gap-1.5" icon={<Maximize2 size={15} aria-hidden />} label="Expand" />
    <Button className="flex items-center gap-1.5" icon={<Maximize size={15} aria-hidden />} label="Full screen" />
    <button type="button" aria-label="Settings" className="grid size-9 place-items-center rounded-[10px] border">
      <Settings size={17} aria-hidden />
    </button>
  </>
)

// A page under the bar, padded as the app's pages are.
const page = (
  <div className="mx-auto grid max-w-[1240px] gap-3 px-3 pt-3.5 md:px-5 md:pt-5">
    {Array.from({ length: 12 }, (_, i) => (
      <p key={i} className="rounded-2xl border border-line bg-surface p-6">
        Section {i + 1}
      </p>
    ))}
  </div>
)

function withPage(args: ComponentProps<typeof AppBar>) {
  return (
    <>
      <AppBar {...args} />
      {page}
    </>
  )
}

const meta = {
  title: 'UI kit/AppBar',
  component: AppBar,
  parameters: { layout: 'fullscreen' },
  args: { label: 'Sections', nav: tabs('Plan'), children: buttons },
} satisfies Meta<typeof AppBar>

export default meta
type Story = StoryObj<typeof meta>

const DESKTOP = { viewport: { value: 'desktop', isRotated: false } }
const barOf = (canvasElement: HTMLElement) => within(canvasElement).getAllByRole('banner')
// 52 px of row and its border.
const BAR_HEIGHT = 53

/**
 * The bar across the top of every page: the sections of the app, then the buttons every page has. It stays while
 * the page scrolls.
 */
export const Default: Story = {
  render: withPage,
  play: async ({ canvasElement }) => {
    const [bar] = barOf(canvasElement)
    await expect(within(canvasElement).getByRole('navigation', { name: 'Sections' })).toBeVisible()
    await expect(bar?.getBoundingClientRect().height).toBe(BAR_HEIGHT)
    window.scrollTo({ top: 400 })
    await waitFor(() => expect(bar?.getBoundingClientRect().top).toBe(0))
    window.scrollTo({ top: 0 })
  },
}

/** Its height does not depend on what is in it: a page without buttons gets the same bar. */
export const WithoutButtons: Story = {
  globals: DESKTOP,
  args: { children: null },
  render: withPage,
  play: async ({ canvasElement }) => {
    const [bar] = barOf(canvasElement)
    await expect(bar?.getBoundingClientRect().height).toBe(BAR_HEIGHT)
  },
}

/** Its row lines up with the page under it: the first tab starts where the page's content starts. */
export const LinesUpWithThePage: Story = {
  globals: DESKTOP,
  render: withPage,
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement).getByRole('link', { name: 'Plan' })
    const card = within(canvasElement).getByText('Section 1')
    await expect(tab.getBoundingClientRect().left).toBe(card.getBoundingClientRect().left)
    const settings = within(canvasElement).getByRole('button', { name: 'Settings' })
    await expect(settings.getBoundingClientRect().right).toBe(card.getBoundingClientRect().right)
  },
}

/** On a phone it keeps one row: the tabs scroll sideways under the buttons, and the page gets no wider. */
export const Phone: Story = {
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  render: withPage,
  play: async ({ canvasElement }) => {
    const [bar] = barOf(canvasElement)
    await expect(bar?.getBoundingClientRect().height).toBe(BAR_HEIGHT)
    const nav = within(canvasElement).getByRole('navigation', { name: 'Sections' })
    await expect(nav.scrollWidth).toBeGreaterThan(nav.clientWidth)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}
