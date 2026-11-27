import { calendarICS, icsFileName, IMPORT_HOWTO } from '@lc/plan-domain/ics'
import { createFileRoute } from '@tanstack/react-router'
import JSZip from 'jszip'

import { actorOf } from '#/server/actor'
import { failed } from '#/server/respond'
import { services } from '#/server/services'

/** GET /api/ics-zip — every calendar with events as .ics, plus import instructions, in one archive. */
export const Route = createFileRoute('/api/ics-zip')({
  server: {
    handlers: {
      GET: async () => {
        const read = await services.plans.read(actorOf())
        if (!read.ok) return failed(read.error)
        const plan = read.value
        const zip = new JSZip()
        const used = plan.calendars.filter((c) => plan.events.some((e) => e.calendar === c.id))
        for (const c of used) zip.file(icsFileName(c), calendarICS(plan, c))
        zip.file('Как импортировать.txt', IMPORT_HOWTO(used.filter((c) => c.isNew).map((c) => c.name)))
        const body = await zip.generateAsync({ type: 'arraybuffer' })
        return new Response(body, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="plan-ics-${plan.meta.generated}.zip"`,
          },
        })
      },
    },
  },
})
