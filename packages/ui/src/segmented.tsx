interface SegmentedProps<T extends string> {
  /** Accessible name of the group; it is not shown */
  label: string
  /** The `value` of the pressed option */
  value: T
  /** The choices, left to right. `lang` marks a label written in another language than the page, such as the names in a language switch */
  options: readonly { value: T; label: string; lang?: string }[]
  /** Called with the option that was clicked, the pressed one included */
  onChange: (value: T) => void
  /** Takes the whole width of its container and shares it between the options, for a narrow card */
  fill?: boolean
}

/**
 * One choice out of a few, as a row of toggle buttons on a track; the chosen one is raised, not filled, so it is
 * never mistaken for the primary button next to it. It keeps no state: the parent passes `value` and answers
 * `onChange`.
 */

export function Segmented<T extends string>({ label, value, options, onChange, fill = false }: SegmentedProps<T>) {
  return (
    <div
      className={`gap-0.5 rounded-[10px] border border-line bg-surface-2 p-[3px] ${fill ? 'flex' : 'inline-flex'}`}
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.lang}
          className={`${fill ? 'min-w-0 flex-auto truncate px-1.5' : 'px-3'} rounded-[7px] py-1 font-medium text-muted transition-colors duration-150 hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(10_16_30/0.12)]`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
