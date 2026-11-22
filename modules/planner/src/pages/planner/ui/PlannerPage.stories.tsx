import {
  applyChange,
  applyEdits,
  editedUids,
  emptyHistory,
  emptyTrash,
  historyEdits,
  historyView,
  recordChange,
  trashOf,
  travel,
  ymd,
} from '@lc/plan-domain'
import { fixtureEdited, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { fn } from 'storybook/test'

import { PlannerPage } from './PlannerPage'

/**
 * Stands in for the app: keeps the URL state in memory and stores changes with the same reducer the server uses,
 * so everything on the page works and nothing is saved.
 */
function Host(props: ComponentProps<typeof PlannerPage>) {
  const base = props.state.plan
  const [search, setSearch] = useState(props.search)
  const [history, setHistory] = useState(emptyHistory)
  const edits = historyEdits(history)
  const state = useMemo(
    () => ({
      ...props.state,
      plan: applyEdits(base, edits).plan,
      edited: [...props.state.edited, ...editedUids(edits)],
      trash: trashOf(base, edits),
      history: historyView(history),
    }),
    [props.state, base, edits, history],
  )
  return (
    <PlannerPage
      {...props}
      state={state}
      search={search}
      onSearchChange={(patch) => (setSearch((prev) => ({ ...prev, ...patch })), props.onSearchChange(patch))}
      onChange={async (change) => {
        await props.onChange(change)
        setHistory((prev) => {
          const before = historyEdits(prev)
          return recordChange(prev, applyEdits(base, before).plan, change, applyChange(base, before, change))
        })
      }}
      onTravel={async (cursor) => {
        await props.onTravel(cursor)
        setHistory((prev) => travel(prev, cursor))
      }}
    />
  )
}

const meta = {
  title: 'Planner/Page/PlannerPage',
  component: PlannerPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The whole planner as the app renders it at `/`. The host passes the plan, the URL state and its callbacks; here a small in-memory host does that, so editing, the trash and the history all work. The header slots (`headerAside`, `renderActions`) are empty: the app fills them with the language switcher and the export module.',
      },
      story: { inline: false, iframeHeight: 820 },
    },
  },
  args: {
    state: {
      plan: fixturePlan,
      canEdit: true,
      edited: fixtureEdited,
      trash: emptyTrash(),
      history: historyView(emptyHistory()),
    },
    search: { week: ymd(fixtureWeek) },
    onSearchChange: fn(),
    onChange: fn(async () => {}),
    onTravel: fn(async () => {}),
    commands: [{ id: 'host', group: 'Host', label: 'A command the host adds', run: fn() }],
  },
  argTypes: { state: { control: false } },
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof PlannerPage>

export default meta
type Story = StoryObj<typeof meta>

export const Week: Story = {}

export const Month: Story = { args: { search: { week: ymd(fixtureWeek), view: 'month' } } }

export const List: Story = { args: { search: { week: ymd(fixtureWeek), view: 'list' } } }

export const FullDayExpanded: Story = { args: { search: { week: ymd(fixtureWeek), fullDay: true, expanded: true } } }

export const ReadOnly: Story = {
  args: {
    state: {
      plan: fixturePlan,
      canEdit: false,
      edited: [],
      trash: emptyTrash(),
      history: historyView(emptyHistory()),
    },
  },
}
