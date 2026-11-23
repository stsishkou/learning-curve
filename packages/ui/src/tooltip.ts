import { useEffect } from 'react'

/** How long the pointer rests on an element before its tooltip shows */
const DELAY = 300
/** For this long after a tooltip hides, the next one shows at once: moving along a toolbar reads every button */
const WARM = 500
const GAP = 6
const EDGE = 8
const TIPPED = '[data-tip]'

const tippedFrom = (target: EventTarget | null) => (target instanceof Element ? target.closest(TIPPED) : null)

function install(): () => void {
  const tip = document.createElement('div')
  tip.className = 'lc-tip'
  tip.popover = 'manual'
  // It repeats a name or a description the control already has: a screen reader would read it twice.
  tip.setAttribute('aria-hidden', 'true')
  document.body.append(tip)
  let owner: Element | null = null
  let pending: Element | null = null
  let timer: number | undefined
  let warmUntil = 0

  function place(el: Element) {
    const box = el.getBoundingClientRect()
    const own = tip.getBoundingClientRect()
    const below = box.bottom + GAP
    const top = below + own.height > window.innerHeight - EDGE ? box.top - GAP - own.height : below
    const left = Math.min(
      Math.max(EDGE, box.left + box.width / 2 - own.width / 2),
      window.innerWidth - EDGE - own.width,
    )
    tip.style.top = `${Math.max(EDGE, top)}px`
    tip.style.left = `${Math.max(EDGE, left)}px`
  }

  function hide() {
    window.clearTimeout(timer)
    pending = null
    if (!owner) return
    owner = null
    warmUntil = performance.now() + WARM
    if (tip.matches(':popover-open')) tip.hidePopover()
  }

  function show(el: Element) {
    pending = null
    const text = el.getAttribute('data-tip') ?? ''
    if (!text || !el.isConnected) {
      hide()
      return
    }
    owner = el
    tip.textContent = text
    // Shown anew each time, so it lands on top of a dialog that opened since.
    if (tip.matches(':popover-open')) tip.hidePopover()
    try {
      tip.showPopover()
    } catch {
      // Refused while another popover is being shown or hidden: the page goes on without this tooltip.
      owner = null
      return
    }
    place(el)
  }

  function over(e: PointerEvent) {
    if (e.pointerType === 'touch') return
    const el = tippedFrom(e.target)
    if (!el || el === owner || el === pending) return
    window.clearTimeout(timer)
    pending = el
    const wait = owner || performance.now() < warmUntil ? 0 : DELAY
    timer = window.setTimeout(() => show(el), wait)
  }

  function out(e: PointerEvent) {
    const el = tippedFrom(e.target)
    if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return
    hide()
  }

  function focusIn(e: FocusEvent) {
    const el = tippedFrom(e.target)
    // A click focuses the control too: only the keyboard's focus shows the tooltip.
    if (!el || !(e.target instanceof Element) || !e.target.matches(':focus-visible')) return
    window.clearTimeout(timer)
    pending = el
    // Not at once: a menu or a dialog moves focus while it opens, and a popover cannot show in the middle of that.
    timer = window.setTimeout(() => show(el), 0)
  }

  const focusOut = (e: FocusEvent) => {
    if (owner && e.target instanceof Node && owner.contains(e.target)) hide()
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hide()
  }

  document.addEventListener('pointerover', over)
  document.addEventListener('pointerout', out)
  document.addEventListener('focusin', focusIn)
  document.addEventListener('focusout', focusOut)
  document.addEventListener('keydown', key)
  document.addEventListener('pointerdown', hide)
  document.addEventListener('scroll', hide, { capture: true, passive: true })
  window.addEventListener('resize', hide)
  return () => {
    hide()
    document.removeEventListener('pointerover', over)
    document.removeEventListener('pointerout', out)
    document.removeEventListener('focusin', focusIn)
    document.removeEventListener('focusout', focusOut)
    document.removeEventListener('keydown', key)
    document.removeEventListener('pointerdown', hide)
    document.removeEventListener('scroll', hide, { capture: true })
    window.removeEventListener('resize', hide)
    tip.remove()
  }
}

/**
 * The tooltips of the page: anything with `data-tip` shows that text under itself a moment after the pointer rests
 * on it, and at once when the keyboard reaches it. One element serves them all, in the top layer, so no scrolling
 * box clips it and it shows over dialogs. Render it once, at the root of the page.
 */
export function Tooltips() {
  useEffect(install, [])
  return null
}
