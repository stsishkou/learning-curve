import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Button } from './button'
import { FOOT, META, Modal, TITLE } from './modal'

const meta = {
  title: 'UI kit/Modal',
  component: Modal,
  parameters: {
    dialog: true,
    docs: {
      // A modal dialog covers the whole document, so on a docs page each one gets its own frame.
      story: { inline: false, iframeHeight: 420 },
    },
  },
  args: {
    open: true,
    onClose: fn(),
    children: (
      <>
        <h3 className={TITLE}>Remove the calendar?</h3>
        <div className={META}>Its 12 events go to the trash and can be restored for 30 days.</div>
        <div className={FOOT}>
          <Button>Cancel</Button>
          <Button primary>Remove</Button>
        </div>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

/** 560 px: a question or a short form. */
export const Normal: Story = {}

/** 760 px: a list or a comparison. */
export const Wide: Story = { args: { size: 'wide' } }

/** Fills the window up to 1120 px: a document to read. */
export const Full: Story = { args: { size: 'full' } }

/** Anchored near the top, so the box does not jump while the results under a search field change height. */
export const Top: Story = {
  args: {
    top: true,
    label: 'Search',
    children: <input className="w-full bg-transparent text-[17px] outline-none" placeholder="Type to search…" />,
  },
}

/**
 * Docked to one side of a wide window with the page behind left readable: for a form whose result shows on the page
 * while it is filled in, such as a new event drawn on the calendar.
 */
export const Docked: Story = { args: { side: 'right' } }
