import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'
import { PageHeader } from './page-header'

const meta = {
  title: 'UI kit/PageHeader',
  component: PageHeader,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Every page with actions in its header uses it, so the header stays while the page scrolls. Scroll the frame:
 * on a wide one the whole header stays, on a narrow one only the bar passed as `aside`.
 */
export const Default: Story = {
  args: { children: null },
  render: () => (
    <div className="px-3 pt-3.5 md:px-5 md:pt-5">
      <PageHeader
        aside={
          <nav className="flex gap-1.5 text-[14px]" aria-label="Sections">
            <a href="#plan">Plan</a>
            <a href="#focus">Focus</a>
          </nav>
        }
        actions={<Button>Export</Button>}
      >
        <h1 className="text-[22px]/[1.2] font-semibold">Study plan</h1>
        <p className="mt-1 text-[14px] text-muted">151 events in 6 calendars</p>
      </PageHeader>
      <div className="mt-4 grid gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <p key={i} className="rounded-2xl border border-line bg-surface p-6">
            Section {i + 1}
          </p>
        ))}
      </div>
    </div>
  ),
}
