import { m } from '@lc/i18n/messages'
import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Hourglass } from './Hourglass'

const MINUTE = 60_000
// Fixed so a story draws the same frame whenever it runs.
const AT = Date.UTC(2026, 10, 24, 9)

/** Turns the glass over with a button, as "Later" does on the focus page when a work block has run out. */
function Turning(props: ComponentProps<typeof Hourglass>) {
  const [turns, setTurns] = useState(0)
  return (
    <div className="grid justify-items-start gap-3">
      <Hourglass {...props} turn={`${props.turn}:${turns}`} />
      <button type="button" className="rounded border border-line px-2" onClick={() => setTurns((t) => t + 1)}>
        {m.focus_break_skip()}
      </button>
    </div>
  )
}

const meta = {
  title: 'Planner/Widgets/Hourglass',
  component: Hourglass,
  args: {
    run: 0,
    at: AT,
    length: 25 * MINUTE,
    running: false,
    tone: 'work',
    color: fixturePlan.calendars[0]?.color,
    turn: 'work:0',
    className: 'h-[176px] w-[100px]',
  },
  render: (args) => <Turning {...args} />,
} satisfies Meta<typeof Hourglass>

export default meta
type Story = StoryObj<typeof meta>

const canvasOf = (root: HTMLElement) => {
  const canvas = root.querySelector('canvas')
  if (!canvas) throw new Error('No canvas')
  return canvas
}
/** Sand is the only kind of cell drawn fully opaque in the middle column */
const sandAt = (canvas: HTMLCanvasElement, x: number, y: number) =>
  canvas.getContext('2d')?.getImageData(x, y, 1, 1).data[3] === 255
const TOP = 10
const NECK = 17
const FLOOR = 31

/**
 * A full glass at the start of a block. It is drawn one pixel per cell and scaled to the largest whole number of
 * device pixels per cell that fits its box, so every cell stays a crisp square.
 */
export const Full: Story = {
  play: async ({ canvasElement }) => {
    const canvas = canvasOf(canvasElement)
    await waitFor(() => expect(canvas.style.visibility).toBe(''))
    const { width, height } = canvas.getBoundingClientRect()
    await expect(Number.isInteger((width / 19) * window.devicePixelRatio)).toBe(true)
    await expect(height / 35).toBe(width / 19)
    await expect(height).toBeLessThanOrEqual(176)
    await expect(height + 35 / window.devicePixelRatio).toBeGreaterThan(176)
    await waitFor(() => expect(sandAt(canvas, 9, TOP)).toBe(true))
    await expect(sandAt(canvas, 9, FLOOR)).toBe(false)
  },
}

/** The block is over: the sand has run into the bottom bulb. */
export const Empty: Story = {
  args: { run: 25 * MINUTE },
  play: async ({ canvasElement }) => {
    const canvas = canvasOf(canvasElement)
    await waitFor(() => expect(sandAt(canvas, 9, FLOOR)).toBe(true))
    await expect(sandAt(canvas, 9, TOP)).toBe(false)
  },
}

/** While the block runs a stream pours through the neck and the grains land one by one. */
export const Running: Story = {
  args: { run: 10 * MINUTE, at: Date.now(), running: true },
  play: async ({ canvasElement }) => {
    const canvas = canvasOf(canvasElement)
    await waitFor(() => expect(sandAt(canvas, 9, NECK)).toBe(true))
  },
}

/** A still glass (or reduced motion) has no stream: the sand changes a grain at a time. */
export const Still: Story = {
  args: { run: 10 * MINUTE, at: Date.now(), running: true, still: true },
  play: async ({ canvasElement }) => {
    const canvas = canvasOf(canvasElement)
    await waitFor(() => expect(sandAt(canvas, 9, FLOOR)).toBe(true))
    const neck = await new Promise<boolean[]>((resolve) => {
      const seen: boolean[] = []
      const timer = setInterval(() => {
        seen.push(sandAt(canvas, 9, NECK))
        if (seen.length < 4) return
        clearInterval(timer)
        resolve(seen)
      }, 90)
    })
    await expect(neck).not.toContain(true)
  },
}

/** A rest pours in the colour of what is done. */
export const Rest: Story = { args: { tone: 'rest', run: 2 * MINUTE, length: 5 * MINUTE, turn: 'rest:0' } }

/** A new block turns the glass over; a still glass is only redrawn. */
export const TurnsOver: Story = {
  play: async ({ canvasElement }) => {
    const canvas = canvasOf(canvasElement)
    await userEvent.click(within(canvasElement).getByRole('button', { name: m.focus_break_skip() }))
    await expect(canvas.getAnimations()).toHaveLength(1)
  },
}

export const StillDoesNotTurn: Story = {
  args: { still: true },
  play: async ({ canvasElement }) => {
    const canvas = canvasOf(canvasElement)
    await userEvent.click(within(canvasElement).getByRole('button', { name: m.focus_break_skip() }))
    await expect(canvas.getAnimations()).toHaveLength(0)
  },
}

/** Fills a tall box, as in Expand and Full screen: the cells grow, still on whole device pixels. */
export const Tall: Story = { args: { className: 'h-[560px] w-[320px]' } }
