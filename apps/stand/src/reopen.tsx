import { Button } from '@lc/ui'
import { Fragment, useEffect, useRef, useState, type PropsWithChildren } from 'react'

/**
 * Wraps a story that starts as an open dialog. Esc or a click on the backdrop closes a native dialog for good:
 * the story's `open` arg is still true, so nothing tells the component to show it again. Once no dialog is
 * left open, a button appears that mounts the story anew.
 */
export function Reopenable({ children }: PropsWithChildren) {
  const box = useRef<HTMLDivElement>(null)
  const [closed, setClosed] = useState(false)
  const [run, setRun] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const onClose = () => setClosed(!el.querySelector('dialog[open]'))
    // `close` does not bubble, so it is caught on the way down.
    el.addEventListener('close', onClose, true)
    return () => el.removeEventListener('close', onClose, true)
  }, [])

  return (
    <div ref={box} className="contents">
      {closed && (
        <Button
          onClick={() => {
            setClosed(false)
            setRun((n) => n + 1)
          }}
        >
          Open the dialog again
        </Button>
      )}
      <Fragment key={run}>{children}</Fragment>
    </div>
  )
}
