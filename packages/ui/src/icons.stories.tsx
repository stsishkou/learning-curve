import type { Meta, StoryObj } from '@storybook/react-vite'

import * as icons from './icons'

const meta = {
  title: 'UI kit/Icons',
  parameters: {
    docs: {
      description: {
        component:
          'The icons the workspace uses, from Lucide, re-exported by `@lc/ui`: `import { Trash2 } from "@lc/ui"`. Only signs most people know on sight belong in the list (`packages/ui/src/icons.ts`); add an icon there before using it. Give it a `size` (14 to 18 in the app) and `aria-hidden`, and keep a text label or an `aria-label` on the control.',
      },
    },
  },
} satisfies Meta

export default meta

/** Every icon of the list with the name to import it by. */
export const All: StoryObj = {
  render: () => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
      {Object.entries(icons).map(([name, Icon]) => (
        <li
          key={name}
          className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2 text-[12.5px] shadow-card"
        >
          <Icon size={18} aria-hidden />
          {name}
        </li>
      ))}
    </ul>
  ),
}
