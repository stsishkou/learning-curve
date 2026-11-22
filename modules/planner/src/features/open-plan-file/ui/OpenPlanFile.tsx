import { m } from '@lc/i18n/messages'
import { isPlan, type Plan } from '@lc/plan-domain'
import { Button } from '@lc/ui'
import { useRef, useState } from 'react'

import { PlanFileReview } from './PlanFileReview'

export interface OpenedFile {
  name: string
  plan: Plan
}

interface Props {
  /** The plan on screen, to compare the file with */
  current: Plan
  onOpen: (file: OpenedFile) => void
  /** Called with a message ready to show when the file is not a plan */
  onError: (message: string) => void
}

/** Picks a plan.json from disk and shows what it holds before it replaces the plan on screen. */
export function OpenPlanFile({ current, onOpen, onError }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [candidate, setCandidate] = useState<OpenedFile | null>(null)

  async function read(file: File) {
    try {
      const plan: unknown = JSON.parse(await file.text())
      if (!isPlan(plan)) throw new Error(m.file_missing_fields())
      setCandidate({ name: file.name, plan })
      onError('')
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
      <PlanFileReview
        file={candidate}
        current={current}
        onCancel={() => setCandidate(null)}
        onOpen={(file) => {
          setCandidate(null)
          onOpen(file)
        }}
      />
    </>
  )
}
