import { m } from '@lc/i18n/messages'
import type { Plan, PlanChange } from '@lc/plan-domain'
import { Button, FileText } from '@lc/ui'
import { useState } from 'react'

import type { PlanLibrary } from '../model/library'
import { PlanFileReader } from './PlanFileReader'

export interface OpenedFile {
  name: string
  plan: Plan
  /** id of the library file it came from, when it did */
  origin?: string
}

interface Props {
  /** The plan on screen and the name of its file: what the reader shows first */
  shown: OpenedFile
  /** The project plan, to compare a file from disk with */
  project: Plan
  /** Called with a file from disk or from the library the person chose to open in the planner */
  onOpen: (file: OpenedFile) => void
  /** Present when the host keeps plan files with versions */
  library?: PlanLibrary
  /** Minsk wall-clock ms; null before the clock is known */
  now?: number | null
  /** Stores the changes of an update a chat returned. Absent when the plan cannot be edited */
  onApply?: (changes: PlanChange[]) => Promise<void>
}

/** Opens the reader on the plan file; from there a file from disk can be read, compared and opened for editing. */
export function OpenPlanFile({ shown, project, onOpen, library, now, onApply }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button className="flex items-center justify-center gap-1.5" onClick={() => setOpen(true)}>
        <FileText size={16} aria-hidden /> {m.open_plan_file()}
      </Button>
      <PlanFileReader
        open={open}
        shown={shown}
        project={project}
        onOpen={onOpen}
        library={library}
        origin={shown.origin}
        now={now}
        onApply={onApply}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
