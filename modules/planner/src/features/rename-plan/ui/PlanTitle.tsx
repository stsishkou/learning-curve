import { m } from '@lc/i18n/messages'
import { TITLE_MAX } from '@lc/plan-domain'
import { Pencil } from '@lc/ui'
import { useState } from 'react'

interface Props {
  title: string
  /** Present when the plan can be edited: called with the new name, already trimmed and different from the old one */
  onRename?: (title: string) => void
}

/**
 * The plan's name as the page heading. With `onRename` a click on it, or on the pencil beside it, turns it into a
 * field: Enter or leaving the field saves, Escape keeps the old name. The files the plan is downloaded as follow it.
 */
export function PlanTitle({ title, onRename }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const heading = 'text-[22px]/[1.2] font-semibold tracking-[-0.01em]'

  if (!onRename) return <h1 className={heading}>{title}</h1>

  function save() {
    const next = draft?.trim()
    setDraft(null)
    if (next && next !== title) onRename?.(next)
  }

  if (draft !== null) {
    return (
      <h1 className={heading}>
        <input
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- the field appears in answer to a click on the title
          autoFocus
          className="-mx-1.5 w-full max-w-[520px] rounded-lg border border-line bg-surface px-1.5 font-semibold"
          aria-label={m.plan_title()}
          maxLength={TITLE_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setDraft(null)
            // The page's own shortcuts must not fire while a name is typed.
            e.stopPropagation()
          }}
        />
      </h1>
    )
  }

  return (
    <h1 className={heading}>
      <button
        type="button"
        className="group -mx-1.5 inline-flex max-w-full items-center gap-2 rounded-lg px-1.5 text-left hover:bg-surface-2"
        title={m.rename_plan()}
        onClick={() => setDraft(title)}
      >
        <span className="min-w-0 truncate">{title}</span>
        <Pencil
          aria-hidden
          size={15}
          className="shrink-0 text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        />
        <span className="sr-only">{m.rename_plan()}</span>
      </button>
    </h1>
  )
}
