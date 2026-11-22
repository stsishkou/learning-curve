import type { Meta, StoryObj } from '@storybook/react-vite'

import { FIELD, INPUT } from './field'

const meta = {
  title: 'UI kit/Field classes',
  parameters: {
    docs: {
      description: {
        component:
          'Form controls stay native. `FIELD` is the class string of a `<label>` that wraps its control, `INPUT` the one of the control itself: an input, a select or a textarea.',
      },
    },
  },
} satisfies Meta

export default meta

export const Form: StoryObj = {
  render: () => (
    <form className="grid max-w-[420px] gap-3">
      <label className={FIELD}>
        Title
        <input className={INPUT} defaultValue="GE Agent Dev — ADK: tools" />
      </label>
      <label className={FIELD}>
        Calendar
        <select className={INPUT} defaultValue="certs">
          <option value="certs">Gemini Certs</option>
          <option value="pypy">Practical Python</option>
        </select>
      </label>
      <label className={FIELD}>
        Starts
        <input className={INPUT} type="datetime-local" defaultValue="2026-12-02T12:00" />
      </label>
      <label className={FIELD}>
        Description
        <textarea className={INPUT} rows={3} defaultValue="Done: the agent calls its own tool." />
      </label>
    </form>
  ),
}
