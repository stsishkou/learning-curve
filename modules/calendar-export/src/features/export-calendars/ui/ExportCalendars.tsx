import { m } from '@lc/i18n/messages'
import type { Plan } from '@lc/plan-domain'
import { Button } from '@lc/ui'
import { useState } from 'react'

import { ExportDialog } from './ExportDialog'

interface Props {
  plan: Plan
  /** Calendars filtered out in the host: they start unchecked */
  hidden: ReadonlySet<string>
}

/** The "Export to calendar" button together with the dialog it opens. */
export function ExportCalendars({ plan, hidden }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button primary onClick={() => setOpen(true)}>
        {m.export_to_calendar()}
      </Button>
      <ExportDialog plan={plan} hidden={hidden} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
