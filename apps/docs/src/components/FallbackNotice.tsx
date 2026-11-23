import { Globe } from '@lc/ui'

import { useLocale } from '../app/env'
import { m } from '../paraglide/messages'

/** Says that the page is shown in English because the reader's language has no translation of it yet. */
export function FallbackNotice() {
  const locale = useLocale()
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-xl border border-focus/40 bg-focus/5 p-3 text-sm"
      data-pagefind-ignore
    >
      <Globe aria-hidden size={16} className="mt-0.5 shrink-0 text-focus" />
      {m.fallback_notice({}, { locale })}
    </p>
  )
}
