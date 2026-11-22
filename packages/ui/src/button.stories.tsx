import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Button } from './button'

// The generated table has only the props `button.tsx` declares itself. The native ones come from
// `ComponentProps<'button'>`, which the docs generator cannot expand, so the common ones are listed by hand.
const native = (summary: string, description: string) => ({
  description,
  table: { category: 'Native <button> attributes', type: { summary } },
})

const meta = {
  title: 'UI kit/Button',
  component: Button,
  args: { children: 'Save', onClick: fn() },
  argTypes: {
    children: { control: 'text', ...native('ReactNode', 'The label') },
    className: {
      control: 'text',
      ...native('string', "Utility classes added after the kit's own, for a size or a color of a state"),
    },
    disabled: { control: 'boolean', ...native('boolean', 'Dims the button and stops clicks') },
    type: {
      control: 'inline-radio',
      options: ['button', 'submit', 'reset'],
      ...native("'button' | 'submit' | 'reset'", '`button` unless set, where a native button would submit its form'),
    },
    title: { control: 'text', ...native('string', 'The tooltip') },
    onClick: native('(event: MouseEvent<HTMLButtonElement>) => void', 'Any other handler is passed on as well'),
    'aria-label': { control: 'text', ...native('string', 'The accessible name, when the label is an icon') },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** One per dialog or toolbar: the action the person most likely came for. */
export const Primary: Story = { args: { primary: true } }

export const Disabled: Story = { args: { disabled: true } }

/** There is no `size` prop: a smaller button is the same component with padding and text utilities. */
export const Sizes: Story = {
  name: 'With utility classes',
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} />
      <Button {...args} className="px-2.5 py-1 text-[13px]" />
      <Button {...args} primary className="px-2.5 py-1 text-[13px]" />
    </div>
  ),
}
