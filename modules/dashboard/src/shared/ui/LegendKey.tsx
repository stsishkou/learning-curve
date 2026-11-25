interface Props {
  color: string
  label: string
  /** A stroke for a line series, a block for a filled one */
  shape?: 'line' | 'block'
}

/** One legend entry: the mark carries the color, the text stays in ink. */
export function LegendKey({ color, label, shape = 'block' }: Props) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 text-[12.5px] whitespace-nowrap text-muted"
      data-tip={label}
    >
      <span
        aria-hidden
        className={`flex-none ${shape === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-[3px]'}`}
        style={{ background: color }}
      />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  )
}
