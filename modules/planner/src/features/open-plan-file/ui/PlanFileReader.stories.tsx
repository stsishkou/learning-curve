import type { PlanFileInfo } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { PlanFileReader } from './PlanFileReader'

const versions: PlanFileInfo[] = [
  {
    id: 'plan-a',
    name: 'Before the holidays',
    versions: [
      { id: 'v-2', at: '2026-12-01T09:30:00.000Z', note: 'Moved the labs', title: 'AI Agent Engineer', events: 151 },
      { id: 'v-1', at: '2026-11-24T18:00:00.000Z', note: '', title: 'AI Agent Engineer', events: 149 },
    ],
  },
]

/** A library that keeps nothing: enough to show the tab. */
const library = {
  list: fn(async () => versions),
  read: fn(async () => fixturePlan),
  save: fn(async () => versions[0]),
  rename: fn(async () => {}),
  remove: fn(async () => {}),
}

const meta = {
  title: 'Planner/Features/PlanFileReader',
  component: PlanFileReader,
  parameters: { dialog: true, layout: 'fullscreen', docs: { story: { inline: false, iframeHeight: 720 } } },
  args: {
    open: true,
    shown: { name: 'plan.json', plan: fixturePlan },
    project: fixturePlan,
    onOpen: fn(),
    onClose: fn(),
  },
  argTypes: { shown: { control: false }, project: { control: false } },
} satisfies Meta<typeof PlanFileReader>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {}

/** The third tab: the file as text, exactly as it is on disk. */
export const Source: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body)
    // The dialog opens in an effect, after the first render: wait for it.
    const [tabs] = await dialog.findAllByRole('group')
    await userEvent.click(within(tabs).getAllByRole('button')[2])
    await expect(dialog.getByText(/"weeklyBudgetHours"/)).toBeInTheDocument()
  },
}

/**
 * With `library` the reader lists the plan files the host keeps: each with its versions, to view, compare with the
 * one before, open for editing, rename and delete. The form on top saves the plan on screen.
 */
export const Library: Story = {
  args: { library, now: fixtureNow },
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body)
    const [tabs] = await dialog.findAllByRole('group')
    await userEvent.click(within(tabs).getAllByRole('button')[3])
    await expect(await dialog.findByText('Before the holidays')).toBeInTheDocument()
  },
}

/**
 * The last tab works with any AI chat: it gives a brief to copy and takes the answer back. A pasted update is
 * checked against the plan and shown as what it adds, removes and changes before `onApply` gets its changes.
 */
export const AiChat: Story = {
  args: { now: fixtureNow, onApply: fn(async () => {}) },
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body)
    const [tabs] = await dialog.findAllByRole('group')
    await userEvent.click(within(tabs).getAllByRole('button').at(-1)!)
    const update = {
      summary: 'One more session on Saturday.',
      changes: [
        {
          type: 'event.add',
          event: {
            calendar: 'certs',
            title: 'GE Agent Dev — Extra',
            start: '2026-12-05T12:00',
            end: '2026-12-05T13:00',
          },
        },
      ],
    }
    const [, answer] = dialog.getAllByRole('textbox')
    await userEvent.click(answer)
    await userEvent.paste(JSON.stringify(update))
    await expect(await dialog.findByText('One more session on Saturday.')).toBeInTheDocument()
    await expect(dialog.getByText('GE Agent Dev — Extra')).toBeInTheDocument()
  },
}
