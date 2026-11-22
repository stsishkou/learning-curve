interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string; lang?: string }>
  onChange: (value: T) => void
}

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
