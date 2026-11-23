import { m } from '@lc/i18n/messages'
import { Button, Maximize, Maximize2, Minimize, Minimize2 } from '@lc/ui'

const PRESSED = 'aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

interface Props {
  /** The view takes the whole window */
  expanded: boolean
  /** What Expand hides, as its tooltip */
  expandHint: string
  onToggleExpanded: () => void
  /** Present where the browser can fill the whole screen */
  fullscreen?: { on: boolean; toggle: () => void } | undefined
  /** Sizes the two buttons to the bar they sit in */
  className?: string
}

/** Expand to the window and full screen, the same pair on every view. */
export function ScreenButtons({ expanded, expandHint, onToggleExpanded, fullscreen, className = '' }: Props) {
  return (
    <>
      {/* In full screen the view is always laid out across it: there is nothing to expand. */}
      {!fullscreen?.on && (
        <Button
          className={`flex items-center gap-1.5 ${PRESSED} ${className}`}
          aria-pressed={expanded}
          title={expandHint}
          onClick={onToggleExpanded}
        >
          {expanded ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
          {expanded ? m.collapse() : m.expand()}
        </Button>
      )}
      {fullscreen && (
        <Button
          className={`flex items-center gap-1.5 ${PRESSED} ${className}`}
          aria-pressed={fullscreen.on}
          title={m.fullscreen_hint()}
          onClick={fullscreen.toggle}
        >
          {fullscreen.on ? <Minimize size={15} aria-hidden /> : <Maximize size={15} aria-hidden />}
          {fullscreen.on ? m.fullscreen_exit() : m.fullscreen()}
        </Button>
      )}
    </>
  )
}
