import { m } from '@lc/i18n/messages'
import { useEffect, useState } from 'react'

const KEY = 'learning-curve:timeline-hint'

/** The page's how-to under its title. It folds to one line and stays folded in this browser once folded. */
export function PageHint({ text }: { text: string }) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'folded') setOpen(false)
    } catch {
      // storage unavailable: the how-to shows
    }
  }, [])
  return (
    <details
      open={open}
      className="mt-1 max-w-[72ch] text-[14px] text-muted"
      onToggle={(e) => {
        const next = e.currentTarget.open
        setOpen(next)
        try {
          if (next) localStorage.removeItem(KEY)
          else localStorage.setItem(KEY, 'folded')
        } catch {
          // ignore: folded until the page is closed
        }
      }}
    >
      <summary className="w-fit cursor-pointer text-[13px] font-medium select-none hover:text-ink">
        {m.timeline_how()}
      </summary>
      <p className="mt-1">{text}</p>
    </details>
  )
}
