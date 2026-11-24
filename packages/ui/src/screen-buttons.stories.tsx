import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { useFullscreen } from './fullscreen'
import { ScreenButtons } from './screen-buttons'
import { fakeFullscreen } from './testing'

const LABELS = {
  expand: 'Expand',
  collapse: 'Collapse',
  expandHint: 'The view across the whole window: no header',
  fullscreen: 'Full screen',
  fullscreenExit: 'Exit full screen',
  fullscreenHint: "The view across the whole screen, without the browser's bars",
}

const meta = {
  title: 'UI kit/ScreenButtons',
  component: ScreenButtons,
  args: { expanded: false, labels: LABELS, onToggleExpanded: fn() },
} satisfies Meta<typeof ScreenButtons>

export default meta
type Story = StoryObj<typeof meta>

function Screen({ onToggleExpanded }: { onToggleExpanded: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const fullscreen = useFullscreen()
  return (
    <div className="flex gap-2">
      <ScreenButtons
        labels={LABELS}
        expanded={expanded}
        onToggleExpanded={() => {
          onToggleExpanded()
          setExpanded(!expanded)
        }}
        fullscreen={fullscreen.supported ? fullscreen : undefined}
      />
    </div>
  )
}

/**
 * The pair every view offers: Expand gives the view the whole window, Full screen the whole screen. Each shows
 * whether it is on; in full screen Expand goes, since the view is already laid out across it.
 */
export const Default: Story = {
  beforeEach: () => fakeFullscreen().restore,
  render: (args) => <Screen {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Expand' }))
    await expect(args.onToggleExpanded).toHaveBeenCalledOnce()
    await expect(canvas.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('button', { name: 'Full screen' }))
    await expect(canvas.queryByRole('button', { name: 'Collapse' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Exit full screen' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('button', { name: 'Exit full screen' }))
    await expect(canvas.getByRole('button', { name: 'Collapse' })).toBeVisible()
  },
}

/** Where the browser cannot fill the screen (an iPhone), only Expand is offered. */
export const NoFullScreen: Story = {}
