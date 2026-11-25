import { useLocale } from '../app/env'
import type { Evidence } from '../content/syllabus/types'
import { m } from '../paraglide/messages'

/** Whether the repository records a reason or the guide reconstructed it. The difference is never left implicit. */
export function EvidenceTag({ evidence }: { evidence: Evidence }) {
  const locale = useLocale()
  const evidenced = evidence === 'evidenced'
  const label = evidenced ? m.evidence_evidenced({}, { locale }) : m.evidence_inferred({}, { locale })
  const hint = evidenced ? m.evidence_evidenced_hint({}, { locale }) : m.evidence_inferred_hint({}, { locale })
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide uppercase ${
        evidenced ? 'border-done/40 text-done-ink' : 'border-dashed border-muted/60 text-muted'
      }`}
      title={hint}
      data-evidence={evidence}
    >
      {label}
      <span className="sr-only">: {hint}</span>
    </span>
  )
}
