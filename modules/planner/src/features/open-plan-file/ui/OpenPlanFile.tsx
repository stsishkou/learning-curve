import { m } from '@lc/i18n/messages'
import type { Plan } from '@lc/plan-domain'
import { Button } from '@lc/ui'
import { useState } from 'react'

import { PlanFileReader } from './PlanFileReader'

export interface OpenedFile {
  name: string
  plan: Plan
}

interface Props {
  /** The plan on screen and the name of its file: what the reader shows first */
  shown: OpenedFile
  /** The project plan, to compare a file from disk with */
  project: Plan
  onOpen: (file: OpenedFile) => void
}

/** Opens the reader on the plan file; from there a file from disk can be read, compared and opened for editing. */
export function OpenPlanFile({ shown, project, onOpen }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>{m.open_plan_file()}</Button>
      <PlanFileReader open={open} shown={shown} project={project} onOpen={onOpen} onClose={() => setOpen(false)} />
    </>
  )
}
