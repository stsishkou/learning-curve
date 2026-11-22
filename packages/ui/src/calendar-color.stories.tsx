import type { Meta, StoryObj } from '@storybook/react-vite'

import { calendarColor } from './calendar-color'
import { Dot } from './dot'
import { ProgressRing } from './progress-ring'

const COLORS = ['#2F5BEA', '#C98A0B', '#14897A', '#7A5AC8', '#7D8796', '#C2456E']

const meta = {
  title: 'UI kit/calendarColor',
  parameters: {
    docs: {
      description: {
        component:
          '`calendarColor(color)` returns the inline style that sets `--c`. Everything inside the element reads it: the `bg-cal`, `border-cal`, `text-cal` and `stroke-cal` utilities, `Dot` and `ProgressRing`.',
      },
    },
  },
} satisfies Meta

export default meta

export const Palette: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {COLORS.map((color) => (
        <div
          key={color}
          style={calendarColor(color)}
          className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2 shadow-card"
        >
          <Dot className="size-2.5" />
          <span className="border-l-[3px] border-cal pl-2 text-[13px] tabular-nums">{color}</span>
          <ProgressRing value={0.6} size={28} stroke={4} label="60%" />
        </div>
      ))}
    </div>
  ),
}
