import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

interface Grab {
  id: string
  pointer: number
  from: number
  startY: number
}

/** What a row's drag handle needs */
export interface HandleProps {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onPointerMove: (e: PointerEvent<HTMLElement>) => void
  onPointerUp: (e: PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void
  onLostPointerCapture: (e: PointerEvent<HTMLElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
}

export interface Reorder {
  /** The row being dragged */
  dragged: string | null
  /** How far it follows the pointer, in px */
  offset: number
  /** Where the drop line goes, in px from the top of the list; null while a drop would change nothing */
  marker: number | null
  handle: (id: string) => HandleProps
}

/** The rows of the list: its children that name an id. */
const rowsOf = (list: HTMLElement) =>
  [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.id !== undefined)

/** `ids` with `id` moved to stand before the row at `to`, or last when `to` is past the end. */
export function moved(ids: readonly string[], id: string, to: number): string[] {
  const from = ids.indexOf(id)
  const rest = ids.filter((other) => other !== id)
  rest.splice(to > from ? to - 1 : to, 0, id)
  return rest
}

/**
 * Reorders the rows of a vertical list: a row is dragged by its handle and dropped where the line shows, or moved one
 * place with ↑ and ↓ on the handle; Escape puts a dragged row back. The rows stay where they are while the pointer
 * moves, so `onMove` is called once, with the new order. Layout positions, not the element under the pointer, tell
 * where a drop lands: the pointer is captured by the handle, and the dragged row is drawn away from its place.
 */
export function useReorder(
  ids: readonly string[],
  list: RefObject<HTMLElement | null>,
  onMove: (next: string[], id: string) => void,
): Reorder {
  const grab = useRef<Grab | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [target, setTarget] = useState<number | null>(null)
  const [marker, setMarker] = useState<number | null>(null)

  const end = () => {
    grab.current = null
    setDragged(null)
    setOffset(0)
    setTarget(null)
    setMarker(null)
  }

  /** The drop spot for a pointer at `clientY`: before the first row whose middle is below it, or after the last. */
  const follow = (clientY: number, from: number) => {
    const el = list.current
    if (!el) return
    const rows = rowsOf(el)
    const box = el.getBoundingClientRect()
    const y = Math.min(Math.max(clientY - box.top - el.clientTop + el.scrollTop, 0), el.scrollHeight)
    const found = rows.findIndex((row) => row.offsetTop + row.offsetHeight / 2 > y)
    const to = found === -1 ? rows.length : found
    setTarget(to)
    const before = rows[to - 1]
    const after = rows[to]
    const changes = to !== from && to !== from + 1
    setMarker(
      !changes
        ? null
        : before && after
          ? (before.offsetTop + before.offsetHeight + after.offsetTop) / 2
          : after
            ? after.offsetTop - 3
            : before
              ? before.offsetTop + before.offsetHeight + 3
              : null,
    )
  }

  const handle = (id: string): HandleProps => ({
    onPointerDown: (e) => {
      if (e.button !== 0 || grab.current) return
      e.currentTarget.setPointerCapture(e.pointerId)
      grab.current = { id, pointer: e.pointerId, from: ids.indexOf(id), startY: e.clientY }
      setDragged(id)
    },
    onPointerMove: (e) => {
      const now = grab.current
      if (!now || e.pointerId !== now.pointer) return
      setOffset(e.clientY - now.startY)
      follow(e.clientY, now.from)
    },
    onPointerUp: (e) => {
      const now = grab.current
      if (!now || e.pointerId !== now.pointer) return
      const next = target === null ? null : moved(ids, now.id, target)
      end()
      if (next && next.join() !== ids.join()) onMove(next, now.id)
    },
    onPointerCancel: (e) => {
      if (grab.current?.pointer === e.pointerId) end()
    },
    onLostPointerCapture: (e) => {
      if (grab.current?.pointer === e.pointerId) end()
    },
    onKeyDown: (e) => {
      if (grab.current) {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          end()
        }
        return
      }
      const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
      const from = ids.indexOf(id)
      const to = from + step
      if (!step || to < 0 || to >= ids.length) return
      e.preventDefault()
      onMove(moved(ids, id, step > 0 ? to + 1 : to), id)
    },
  })

  return { dragged, offset, marker, handle }
}
