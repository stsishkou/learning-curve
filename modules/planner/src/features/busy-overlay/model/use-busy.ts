import type { BusyBlock } from '@lc/plan-domain'
import { useEffect, useRef, useState } from 'react'

/** The person's own calendar as the host offers it. Its address is a secret: the page only learns the host. */
export interface BusySource {
  /** Host of the calendar address that is set, such as `calendar.google.com`; null when none is */
  host: string | null
  /** The busy time between two Minsk wall-clock moments. Rejects with the reason when the calendar cannot be read */
  load: (from: number, to: number) => Promise<BusyBlock[]>
  /** Present where the address can be changed: sets it, or forgets it when given null. Rejects with the reason */
  save?: ((url: string | null) => Promise<void>) | undefined
}

/** The busy time of the person's own calendar for the stretch on screen, read again when the stretch changes. */
export function useBusy(source: BusySource | undefined, from: number, to: number) {
  const [blocks, setBlocks] = useState<BusyBlock[]>([])
  const [error, setError] = useState('')
  const host = source?.host ?? null
  // The host passes a new function on every render; only another calendar or stretch is a reason to read again.
  const load = useRef(source?.load)
  useEffect(() => {
    load.current = source?.load
  })
  useEffect(() => {
    if (!host || !load.current) {
      setBlocks([])
      setError('')
      return undefined
    }
    let stale = false
    const read = async (from_: number, to_: number) => {
      try {
        const found = (await load.current?.(from_, to_)) ?? []
        if (stale) return
        setBlocks(found)
        setError('')
      } catch (err) {
        if (stale) return
        setBlocks([])
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    void read(from, to)
    return () => {
      stale = true
    }
  }, [host, from, to])
  return { blocks, error }
}
