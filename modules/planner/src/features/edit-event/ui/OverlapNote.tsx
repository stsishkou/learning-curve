import { m } from '@lc/i18n/messages'
import { hm } from '@lc/plan-domain'
import { TriangleAlert } from '@lc/ui'

/** Something that takes the same time: an event of the plan, or a block of the person's own calendar */
export interface Overlap {
  title: string
  /** wall-clock ms */
  s: number
  e: number
}

/** Says what else is planned for the same time. It warns and does not forbid: two things at once can be meant. */
export function OverlapNote({ overlaps }: { overlaps: Overlap[] }) {
  if (!overlaps.length) return null
  return (
    <p className="flex items-start gap-2 text-[13px]/[1.45] text-today-ink" role="status">
      <TriangleAlert size={15} aria-hidden className="mt-0.5 flex-none" />
      <span>
        {m.overlaps_with()} {overlaps.map((o) => `${o.title} ${hm(o.s)}–${hm(o.e)}`).join(', ')}
      </span>
    </p>
  )
}
