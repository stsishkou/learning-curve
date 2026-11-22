import { m } from '@lc/i18n/messages'
import { isPlan, type Plan } from '@lc/plan-domain'
import { Button } from '@lc/ui'
import { useRef } from 'react'

interface Props {
  onOpen: (plan: Plan) => void
  /** Called with a message ready to show when the file is not a plan */
  onError: (message: string) => void
}

/** Opens a plan.json from disk without touching the project plan. */
export function OpenPlanFile({ onOpen, onError }: Props) {
  const input = useRef<HTMLInputElement>(null)

  async function read(file: File) {
    try {
      const plan: unknown = JSON.parse(await file.text())
      if (!isPlan(plan)) throw new Error(m.file_missing_fields())
      onOpen(plan)
    } catch (err) {
      onError(m.file_invalid({ reason: err instanceof Error ? err.message : String(err) }))
    }
  }

  return (
    <>
      <Button onClick={() => input.current?.click()}>{m.open_plan_file()}</Button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void read(file)
          e.target.value = ''
        }}
      />
    </>
  )
}
