import { m } from '@lc/i18n/messages'

const DOT = 'size-2 rounded-full'
const SWATCH = 'h-2.5 w-4 rounded-sm'

/** What every mark on the lanes means; the two marks of a change only while there is one. */
export function TimelineLegend({ changed }: { changed: boolean }) {
  const items: { label: string; mark: string }[] = [
    { label: m.timeline_legend_done(), mark: `${DOT} bg-muted` },
    { label: m.timeline_legend_ahead(), mark: `${DOT} bg-[color-mix(in_srgb,var(--muted)_45%,var(--surface))]` },
    { label: m.timeline_legend_missed(), mark: `${DOT} bg-surface ring-[1.5px] ring-today` },
    { label: m.timeline_legend_deadline(), mark: 'size-2.5 rotate-45 rounded-[2px] bg-ink' },
    {
      label: m.timeline_legend_spare(),
      mark: `${SWATCH} bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--line)_4px_6px)]`,
    },
    { label: m.timeline_legend_late(), mark: `${SWATCH} bg-[color-mix(in_srgb,var(--today)_40%,transparent)]` },
    ...(changed
      ? [
          { label: m.timeline_legend_before(), mark: 'h-0 w-4 border-t-2 border-dashed border-muted' },
          {
            label: m.timeline_legend_moved(),
            mark: `${DOT} bg-muted outline-[1.5px] outline-offset-1 outline-focus outline-solid`,
          },
        ]
      : []),
  ]
  return (
    <ul
      aria-label={m.timeline_legend()}
      className="flex flex-wrap gap-x-4 gap-y-1.5 px-3.5 py-3 text-[12px] text-muted md:px-5"
    >
      {items.map(({ label, mark }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden className="grid w-4 place-items-center">
            <i className={mark} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}
