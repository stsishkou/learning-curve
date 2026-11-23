import { Children, type ReactNode, isValidElement, useEffect, useRef, useState } from 'react'

import { useLocale } from '../app/env'
import { m } from '../paraglide/messages'

interface StepProps {
  /** Lines of the file, as numbered in the code block: `12-20` */
  lines: string
  title?: string | undefined
  children: ReactNode
}

/** One stop of a walkthrough. Only meaningful inside <Walkthrough>, which reads its props. */
export function WalkStep({ title, children }: StepProps) {
  return (
    <>
      {title && <h4 className="font-semibold">{title}</h4>}
      {children}
    </>
  )
}

const bounds = (lines: string): readonly [number, number] => {
  const [from = 0, to = from] = lines.split('-').map(Number)
  return [from, to]
}

/**
 * A file read from top to bottom: the code stays in view while the steps scroll past, and the step in the middle of
 * the screen lights up its lines. Children: one code block (a fence with `file=`), then <WalkStep>s.
 */
export function Walkthrough({ children }: { children: ReactNode }) {
  const locale = useLocale()
  const all = Children.toArray(children)
  const steps = all.flatMap((child) => (isValidElement<StepProps>(child) && child.type === WalkStep ? [child] : []))
  const code = all.filter((child) => !(isValidElement(child) && child.type === WalkStep))
  const [active, setActive] = useState(0)
  const codeRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = stepRefs.current.indexOf(entry.target instanceof HTMLLIElement ? entry.target : null)
          if (index >= 0) setActive(index)
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    for (const step of stepRefs.current) if (step) observer.observe(step)
    return () => observer.disconnect()
  }, [steps.length])

  const activeLines = steps.at(active)?.props.lines
  useEffect(() => {
    const container = codeRef.current
    if (!container || !activeLines) return
    const [from, to] = bounds(activeLines)
    let first: HTMLElement | null = null
    for (const line of container.querySelectorAll<HTMLElement>('[data-line]')) {
      const number = Number(line.dataset['line'])
      const inside = number >= from && number <= to
      line.toggleAttribute('data-focus', inside)
      if (inside && !first) first = line
    }
    const pre = container.querySelector('pre')
    if (pre && first) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      pre.scrollTo({ top: Math.max(0, first.offsetTop - 24), behavior: reduce ? 'auto' : 'smooth' })
    }
  }, [activeLines])

  return (
    <section
      className="lc-walk my-6 grid gap-4 @4xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
      aria-label={m.walkthrough_label({}, { locale })}
    >
      <div
        ref={codeRef}
        className="lc-walk-code sticky top-[calc(var(--lc-sticky-top,0px)+0.5rem)] z-10 self-start"
        data-active
      >
        {code}
      </div>
      <ol className="flex flex-col gap-[30vh] pb-[20vh] @4xl:pt-[10vh]">
        {steps.map((step, index) => (
          <li
            key={step.props.lines}
            ref={(element) => {
              stepRefs.current[index] = element
            }}
            className={`lc-card flex flex-col gap-2 p-4 transition-opacity motion-reduce:transition-none ${index === active ? '' : 'opacity-60'}`}
            aria-current={index === active ? 'step' : undefined}
          >
            <span className="text-xs text-muted">
              {m.walkthrough_step({ current: index + 1, total: steps.length }, { locale })} ·{' '}
              {m.lines({ from: bounds(step.props.lines)[0], to: bounds(step.props.lines)[1] }, { locale })}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  )
}
