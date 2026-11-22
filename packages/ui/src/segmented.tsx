interface SegmentedProps<T extends string> {
  /** Accessible name of the group; it is not shown */
  label: string
  /** The `value` of the pressed option */
  value: T
  /** The choices, left to right. `lang` marks a label written in another language than the page, such as the names in a language switch */
  options: ReadonlyArray<{ value: T; label: string; lang?: string }>
  /** Called with the option that was clicked, the pressed one included */
  onChange: (value: T) => void
}

/**
 * One choice out of a few, as a row of toggle buttons. It keeps no state: the parent passes `value` and answers
 * `onChange`.
 */

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-[10px] border border-line bg-surface"
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.lang}
          className="px-3 py-[7px] font-medium text-muted aria-pressed:bg-ink aria-pressed:text-bg"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
