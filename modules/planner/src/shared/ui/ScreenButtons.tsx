import { m } from '@lc/i18n/messages'
import { ScreenButtons as Buttons } from '@lc/ui'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Buttons>, 'labels'> & {
  /** What Expand hides, as its tooltip */
  expandHint: string
}

/** Expand and full screen, in the page's language. */
export function ScreenButtons({ expandHint, ...props }: Props) {
  return (
    <Buttons
      {...props}
      labels={{
        expand: m.expand(),
        collapse: m.collapse(),
        expandHint,
        fullscreen: m.fullscreen(),
        fullscreenExit: m.fullscreen_exit(),
        fullscreenHint: m.fullscreen_hint(),
      }}
    />
  )
}
