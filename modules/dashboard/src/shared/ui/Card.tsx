import type { ReactNode } from 'react'

interface Props {
  title: string
  /** One line under the title that says how to read the chart */
  hint?: string
  /** Shown opposite the title, such as a legend */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

export function Card({ title, hint, aside, className = '', children }: Props) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface p-4 md:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-[min(100%,260px)] flex-1">
          <h2 className="text-[15px]/[1.3] font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}
