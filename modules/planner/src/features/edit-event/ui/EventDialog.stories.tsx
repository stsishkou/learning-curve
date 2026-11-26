import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { isSession, parseLocal, splitInHalves, type PlanChange, type PlanEvent } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { EVENT_EXPANDED_KEY } from '../model/use-event-expanded'
import { EventDialog } from './EventDialog'

const storeExpanded = (value: '1' | null) => () => {
  if (value === null) localStorage.removeItem(EVENT_EXPANDED_KEY)
  else localStorage.setItem(EVENT_EXPANDED_KEY, value)
  return () => localStorage.removeItem(EVENT_EXPANDED_KEY)
}

/** A fixed stand-in for the event on the page, for the dialog to open beside: its right edge is at 160px. */
const spot = () => {
  const el = document.createElement('div')
  el.dataset.spot = ''
  el.style.cssText = 'position:fixed;left:40px;top:40px;width:120px;height:40px'
  document.body.append(el)
  return () => el.remove()
}
const atSpot = () => document.querySelector('[data-spot]')
/** The spot's right edge and the 12px gap */
const BESIDE = '172px'

const DESKTOP = { viewport: { value: 'desktop', isRotated: false } }

function dialogOf(root: HTMLElement): HTMLDialogElement {
  const dlg = root.ownerDocument.querySelector('dialog[open]')
  if (!(dlg instanceof HTMLDialogElement)) throw new Error('no open dialog')
  return dlg
}

/**
 * How far the dialog's centre is from the middle of the area it is laid out in: the window less the scrollbar gutter
 * the page keeps (`scrollbar-gutter: stable`), which a fixed element filling the window measures. The open animation
 * scales the dialog around its centre, so the centre is right even mid-animation.
 */
function offCentre(dlg: HTMLDialogElement): number {
  const doc = dlg.ownerDocument
  const frame = doc.createElement('div')
  frame.style.cssText = 'position:fixed;inset:0;visibility:hidden'
  doc.body.append(frame)
  const middle = frame.getBoundingClientRect().width / 2
  frame.remove()
  const box = dlg.getBoundingClientRect()
  return Math.abs(box.left + box.width / 2 - middle)
}

const pick = (test: (e: PlanEvent) => boolean) => fixturePlan.events.find(test) ?? itemAt(fixturePlan.events)
const upcoming = pick((e) => isSession(e) && parseLocal(e.start) > fixtureNow)
const finished = pick((e) => isSession(e) && Boolean(e.done) && e.actual === undefined)
const MINUTE = 60_000
const plannedOf = (e: PlanEvent) => Math.round((parseLocal(e.end) - parseLocal(e.start)) / MINUTE)

const meta = {
  title: 'Planner/Features/EventDialog',
  component: EventDialog,
  parameters: {
    dialog: true,
    docs: {
      story: { inline: false, iframeHeight: 560 },
    },
  },
  args: {
    plan: fixturePlan,
    event: upcoming,
    draft: null,
    edited: false,
    canEdit: true,
    onChange: fn(async (_change: PlanChange) => {}),
    onClose: fn(),
    onDayChange: fn(),
  },
  argTypes: { plan: { control: false }, event: { control: false }, draft: { control: false } },
  beforeEach: storeExpanded(null),
} satisfies Meta<typeof EventDialog>

export default meta
type Story = StoryObj<typeof meta>

/** A study session that has not started yet. */
export const Session: Story = {}

/** Mark done asks how long the session took: one choice marks it done with that time. */
export const MarkDone: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.mark_done() }))
    await expect(args.onChange).not.toHaveBeenCalled()
    await userEvent.click(body.getByRole('button', { name: m.spent_over_plan({ time: fmtDuration(15 * MINUTE) }) }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: upcoming.uid,
      patch: { done: true, actual: plannedOf(upcoming) + 15 },
    })
  },
}

/** A session can still be marked done without a time, but only as a choice of its own. */
export const MarkDoneWithoutTime: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.mark_done() }))
    await userEvent.click(body.getByRole('button', { name: m.spent_done_without() }))
    await expect(args.onChange).toHaveBeenCalledWith({ type: 'event.patch', uid: upcoming.uid, patch: { done: true } })
  },
}

/** Marked done and changed by hand: the dialog offers to take both back. */
export const DoneAndEdited: Story = { args: { event: pick((e) => Boolean(e.done)), edited: true } }

/**
 * Marked done without a time, as the bulk actions and tools do: the card says the time is not logged instead of
 * showing the plan as the time spent, and one choice logs it.
 */
export const DoneNotLogged: Story = {
  args: { event: finished },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const missing = await body.findByText(m.spent_not_logged())
    await waitFor(() => expect(missing).toBeVisible())
    await userEvent.click(body.getByRole('button', { name: m.spent_as_planned() }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: finished.uid,
      patch: { actual: plannedOf(finished) },
    })
    await userEvent.click(body.getByRole('button', { name: m.spent_over_plan({ time: fmtDuration(30 * MINUTE) }) }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: finished.uid,
      patch: { actual: plannedOf(finished) + 30 },
    })
  },
}

/** A logged time is shown as it was logged, and steps by a quarter hour from there. */
export const DoneLogged: Story = {
  args: { event: { ...finished, actual: 75 } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const logged = await body.findByText(fmtDuration(75 * MINUTE))
    await waitFor(() => expect(logged).toBeVisible())
    await userEvent.click(body.getByRole('button', { name: m.spent_more() }))
    await expect(args.onChange).toHaveBeenCalledWith({ type: 'event.patch', uid: finished.uid, patch: { actual: 90 } })
  },
}

/** A time the stopwatch measured says so, with when it started and how long it stood paused. */
export const DoneMeasured: Story = {
  args: {
    event: { ...finished, actual: 52, measured: true, began: `${finished.start.slice(0, 10)}T14:03`, paused: 8 },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const record = `${m.spent_measured({ time: '14:03' })} · ${m.spent_paused({ time: fmtDuration(8 * MINUTE) })}`
    await waitFor(() => expect(body.getByText(record)).toBeVisible())
  },
}

/** A done session whose goal was not met says so: the rest of the module goes on in a later session. */
export const Unfinished: Story = {
  args: { event: { ...finished, actual: 75 } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('checkbox', { name: m.unfinished_label() }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'event.patch',
      uid: finished.uid,
      patch: { unfinished: true },
    })
  },
}

/** Once a session is marked unfinished, the card offers a session of the same module in the next free slot. */
export const UnfinishedAddsSession: Story = {
  args: { event: { ...finished, actual: 75, unfinished: true } },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.unfinished_add() }))
    const change = args.onChange.mock.lastCall?.[0]
    await expect(change).toMatchObject({
      type: 'event.add',
      event: { calendar: finished.calendar, title: finished.title },
    })
  },
}

export const ReadOnly: Story = { args: { canEdit: false } }

/** One repeat of a weekly event, opened on the day given in `day`. */
export const Repeating: Story = { args: { event: pick((e) => Boolean(e.rrule)), day: '2026-12-03' } }

export const AllDay: Story = { args: { event: pick((e) => Boolean(e.allDay)) } }

/** A `draft` and no `event`: the dialog starts as the form, filled with the draft. */
export const NewEvent: Story = {
  args: {
    event: null,
    draft: {
      calendar: 'pypy',
      title: '',
      start: '2026-12-04T15:00',
      end: '2026-12-04T16:00',
      description: '',
      availability: 'busy',
    },
  },
}

/**
 * A new event on a slot that is taken: the form names what is planned for the same time. It is a warning, the
 * event can still be saved. The card of a stored event shows the same line.
 */
export const Overlapping: Story = {
  args: {
    event: null,
    draft: {
      calendar: 'pypy',
      title: 'Dentist',
      start: upcoming.start,
      end: upcoming.end,
      description: '',
      availability: 'busy',
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const other = await body.findByText(new RegExp(upcoming.title.slice(0, 12)))
    // The dialog fades in: it is visible once its opening transition has begun.
    await waitFor(() => expect(other).toBeVisible())
  },
}

/** The host rejects every change: press any button that edits to see the reason in the dialog. */
export const SaveFails: Story = {
  args: {
    onChange: fn(async (_change: PlanChange) => Promise.reject(new Error('The plan is read-only on this host'))),
  },
}

/**
 * A session of an hour or more can be split in two from its card: the halves fall on the half hour, the second
 * right after the first, and the dialog closes so it can be dragged elsewhere. Labs stay one block.
 */
export const Split: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const split = await body.findByRole('button', { name: /✂|split|раздел|divid/i })
    await userEvent.click(split)
    await expect(args.onChange).toHaveBeenCalledWith(splitInHalves(upcoming))
  },
}

/**
 * Expand moves the dialog from beside its event to the middle of the window, larger, and remembers that; pressing it
 * again puts it back. Focus stays on the button, whose name stays the same: only its pressed state changes.
 */
export const Expand: Story = {
  beforeEach: spot,
  globals: DESKTOP,
  args: { anchor: atSpot },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(window.innerWidth).toBeGreaterThanOrEqual(768)
    const expand = await body.findByRole('button', { name: m.expand() })
    await expect(expand).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(dialogOf(canvasElement).style.left).toBe(BESIDE))
    await userEvent.click(expand)
    await expect(expand).toHaveAttribute('aria-pressed', 'true')
    await expect(expand).toHaveFocus()
    await waitFor(async () => {
      const dlg = dialogOf(canvasElement)
      await expect(dlg.style.left).toBe('')
      await expect(dlg.offsetWidth).toBe(760)
      await expect(offCentre(dlg)).toBeLessThanOrEqual(1)
    })
    await expect(localStorage.getItem(EVENT_EXPANDED_KEY)).toBe('1')
    await userEvent.click(expand)
    await expect(expand).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(dialogOf(canvasElement).style.left).toBe(BESIDE))
    await expect(localStorage.getItem(EVENT_EXPANDED_KEY)).toBeNull()
  },
}

/** Once expanded, the next event opens expanded. */
export const ExpandRemembered: Story = {
  beforeEach: [spot, storeExpanded('1')],
  globals: DESKTOP,
  args: { anchor: atSpot },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole('button', { name: m.expand() })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(async () => {
      const dlg = dialogOf(canvasElement)
      await expect(dlg.style.left).toBe('')
      await expect(offCentre(dlg)).toBeLessThanOrEqual(1)
    })
  },
}

/**
 * Esc closes the expanded dialog at once, and the next one still opens expanded. A scripted Escape is not trusted, so
 * the browser would not act on it: `requestClose()` makes the close request Esc makes.
 */
export const EscClosesExpanded: Story = {
  beforeEach: storeExpanded('1'),
  globals: DESKTOP,
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole('button', { name: m.expand() })).toHaveAttribute('aria-pressed', 'true')
    dialogOf(canvasElement).requestClose()
    await waitFor(() => expect(args.onClose).toHaveBeenCalledTimes(1))
    await expect(localStorage.getItem(EVENT_EXPANDED_KEY)).toBe('1')
  },
}

/** Expanding halfway through Mark done keeps the question on screen. */
export const ExpandKeepsState: Story = {
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.mark_done() }))
    await userEvent.click(body.getByRole('button', { name: m.expand() }))
    await expect(body.getByRole('button', { name: m.spent_done_without() })).toBeInTheDocument()
  },
}

/** The form for a new event stays beside its draft, which shows the event on the page while it is filled in. */
export const NewEventNeverExpands: Story = {
  beforeEach: [spot, storeExpanded('1')],
  globals: DESKTOP,
  args: { ...NewEvent.args, anchor: atSpot },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(dialogOf(canvasElement).style.left).toBe(BESIDE))
    await expect(body.queryByRole('button', { name: m.expand() })).toBeNull()
  },
}

/** On a phone the dialog already fills the width: there is no Expand, whatever was remembered. */
export const NarrowNoExpand: Story = {
  beforeEach: storeExpanded('1'),
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(window.innerWidth).toBeLessThan(768)
    await body.findByRole('button', { name: m.close() })
    await expect(body.queryByRole('button', { name: m.expand() })).toBeNull()
    await expect(dialogOf(canvasElement).offsetWidth).toBeLessThanOrEqual(560)
  },
}

/** Expanded, the event reads like a page: a larger title, the description at reading size in lines of limited length. */
export const ExpandedReading: Story = {
  beforeEach: storeExpanded('1'),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const heading = await body.findByRole('heading', { name: upcoming.title })
    await expect(getComputedStyle(heading).fontSize).toBe('22px')
    const description = dialogOf(canvasElement).querySelector('pre')
    if (!description) throw new Error('no description')
    await expect(getComputedStyle(description).fontSize).toBe('15.5px')
    await expect(getComputedStyle(description).maxWidth).not.toBe('none')
  },
}

/** A long description scrolls between the title and the buttons, which both stay in view. */
export const ExpandedLongDescription: Story = {
  beforeEach: storeExpanded('1'),
  globals: DESKTOP,
  args: {
    event: {
      ...upcoming,
      description: Array.from({ length: 60 }, (_, i) => `Line ${i + 1} of a long description`).join('\n'),
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const heading = await body.findByRole('heading', { name: upcoming.title })
    const dlg = dialogOf(canvasElement)
    await expect(dlg.scrollHeight).toBeGreaterThan(dlg.clientHeight)
    dlg.scrollTop = dlg.scrollHeight
    await waitFor(async () => {
      const frame = dlg.getBoundingClientRect()
      await expect(heading.getBoundingClientRect().top).toBeGreaterThanOrEqual(frame.top)
      await expect(body.getByRole('button', { name: m.edit() }).getBoundingClientRect().bottom).toBeLessThanOrEqual(
        frame.bottom,
      )
    })
  },
}

/** Edit keeps the expanded size and gives the description room to write in. */
export const ExpandedEdit: Story = {
  beforeEach: storeExpanded('1'),
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(await body.findByRole('button', { name: m.edit() }))
    const dlg = dialogOf(canvasElement)
    await waitFor(() => expect(dlg.offsetWidth).toBe(760))
    const field = dlg.querySelector('textarea')
    if (!field) throw new Error('no description field')
    await expect(getComputedStyle(field).minHeight).toBe('240px')
  },
}
