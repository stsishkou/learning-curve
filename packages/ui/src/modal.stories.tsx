import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Button } from './button'
import { FOOT, META, Modal, TITLE } from './modal'

const meta = {
  title: 'UI kit/Modal',
  component: Modal,
  parameters: {
    docs: {
      description: {
        component:
          'A native `<dialog>` opened with `showModal()`: Esc and a click on the backdrop close it. `TITLE`, `META` and `FOOT` are the class strings for its heading, the line under it and the button row.',
      },
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

export const Normal: Story = {}

export const Wide: Story = { args: { size: 'wide' } }

export const Full: Story = { args: { size: 'full' } }

export const Top: Story = {
  args: {
    top: true,
    label: 'Search',
    children: <input className="w-full bg-transparent text-[17px] outline-none" placeholder="Type to search…" />,
  },
}
