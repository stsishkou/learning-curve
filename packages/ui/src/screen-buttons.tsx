import { Button } from './button'
import { Maximize, Maximize2, Minimize, Minimize2 } from './icons'

const PRESSED = 'aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

/** What the two buttons say, in the page's language */
export interface ScreenLabels {
  expand: string
  collapse: string
  /** What Expand hides, as its tooltip */
  expandHint: string
  fullscreen: string
  fullscreenExit: string
  fullscreenHint: string
}

interface Props {
  /** The view takes the whole window */
  expanded: boolean
  onToggleExpanded: () => void
  /** Present where the browser can fill the whole screen */
  fullscreen?: { on: boolean; toggle: () => void } | undefined
  labels: ScreenLabels
  /** Sizes the two buttons to the bar they sit in */
  className?: string | undefined
}

/** Expand to the window and full screen, the same pair on every view. */
export function ScreenButtons({ expanded, onToggleExpanded, fullscreen, labels, className = '' }: Props) {
  return (
    <>
      {/* In full screen the view is always laid out across it: there is nothing to expand. */}
      {!fullscreen?.on && (
        <Button
          className={`flex items-center gap-1.5 ${PRESSED} ${className}`}
          aria-pressed={expanded}
          icon={expanded ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
          label={expanded ? labels.collapse : labels.expand}
          data-tip={labels.expandHint}
          onClick={onToggleExpanded}
        />
      )}
      {fullscreen && (
        <Button
          className={`flex items-center gap-1.5 ${PRESSED} ${className}`}
          aria-pressed={fullscreen.on}
          icon={fullscreen.on ? <Minimize size={15} aria-hidden /> : <Maximize size={15} aria-hidden />}
          label={fullscreen.on ? labels.fullscreenExit : labels.fullscreen}
          data-tip={labels.fullscreenHint}
          onClick={fullscreen.toggle}
        />
      )}
    </>
  )
}
