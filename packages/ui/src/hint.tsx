import { CircleHelp } from 'lucide-react'
import { useId, useSyncExternalStore, type ReactNode } from 'react'

const KEY = 'lc-help'
const listeners = new Set<() => void>()
// Storage can be blocked (a private window): the switch then works until the page is closed.
let remembered: boolean | null = null

function read(): boolean {
  if (remembered !== null) return remembered
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function toggle(): void {
  remembered = !read()
  try {
    if (remembered) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Kept in memory above.
  }
  for (const listener of listeners) listener()
}

const off = () => false

/** Whether the help marks are shown, and the switch for it. The choice is kept in the browser, for every page. */
export function useHelpMode(): [boolean, () => void] {
  return [useSyncExternalStore(subscribe, read, off), toggle]
}

interface ToggleProps {
  /** Accessible name and tooltip of the switch, e.g. "Explain the page" */
  label: string
  className?: string
}

/** The switch of the help mode: pressed while the `Hint` marks are on the page. */
export function HelpToggle({ label, className = '' }: ToggleProps) {
  const [on, flip] = useHelpMode()
  return (
    <button
      type="button"
      className={`grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-surface text-muted shadow-card transition-[background-color,color,transform] duration-150 hover:bg-surface-2 hover:text-ink aria-pressed:border-focus aria-pressed:bg-focus aria-pressed:text-surface motion-safe:active:scale-[0.96] ${className}`}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={flip}
    >
      <CircleHelp size={18} aria-hidden />
    </button>
  )
}

interface HintProps {
  /** What the mark explains: the heading of the note and the accessible name of the mark */
  title: string
  /** The explanation as plain text; each line of it is a paragraph */
  text?: string
  /** The explanation as markup, instead of `text` or after it */
  children?: ReactNode
  /** Extra classes for the mark, e.g. to place it in a corner */
  className?: string
}

/**
 * A "?" mark that opens a short explanation of the thing next to it. It renders nothing until the help mode is
 * switched on with `HelpToggle`, so a page can carry as many as it needs.
 */
export function Hint({ title, text, children, className = '' }: HintProps) {
  const [on] = useHelpMode()
  const id = useId()
  const anchor = `--hint-${id.replaceAll(/[^a-z0-9]/gi, '')}`
  if (!on) return null
  return (
    <>
      <button
        type="button"
        className={`lc-hint-mark inline-grid size-[22px] flex-none place-items-center rounded-full border border-focus bg-[color-mix(in_srgb,var(--focus)_16%,var(--surface))] text-focus transition-transform duration-150 motion-safe:hover:scale-110 ${className}`}
        style={{ anchorName: anchor }}
        aria-label={title}
        title={title}
        popoverTarget={id}
        // A mark often sits inside something clickable: opening the note must not also press that.
        onClick={(e) => e.stopPropagation()}
      >
        <CircleHelp size={14} aria-hidden />
      </button>
      <div
        id={id}
        popover="auto"
        role="note"
        className="lc-hint w-[min(340px,calc(100vw-24px))] rounded-xl border border-line bg-surface p-4 text-left text-[13.5px]/[1.5] font-normal tracking-normal whitespace-normal text-ink normal-case shadow-[0_16px_40px_rgb(10_16_30/0.25)]"
        style={{ positionAnchor: anchor }}
      >
        <b className="block text-[14px] font-semibold">{title}</b>
        <div className="mt-1.5 grid gap-1.5 text-muted [&_b]:font-semibold [&_b]:text-ink [&_li]:ml-4 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1">
          {text?.split('\n').map((line) => (
            <p key={line}>{line}</p>
          ))}
          {children}
        </div>
      </div>
    </>
  )
}
