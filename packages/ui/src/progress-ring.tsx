import type { ReactNode } from 'react'

interface Props {
  /** The filled share, 0…1; values outside are clamped */
  value: number
  /** Outer diameter in px */
  size?: number
  /** Thickness of the ring in px */
  stroke?: number
  /** Accessible text, e.g. "6 of 20 hours" */
  label: string
  /** Shown in the middle, usually the percentage */
  children?: ReactNode
}

/** A ring that fills clockwise in the calendar color: set it on the ring's parent with `calendarColor()`. */
export function ProgressRing({ value, size = 44, stroke = 5, label, children }: Props) {
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  const filled = Math.max(0, Math.min(1, value)) * length
  return (
    <span className="relative inline-grid flex-none place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="-rotate-90"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-line-soft" />
        {/* A round cap would draw a dot at zero. */}
        {filled > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${length}`}
            className="stroke-cal transition-[stroke-dasharray] duration-500"
          />
        )}
      </svg>
      {children !== undefined && <span className="absolute text-[11px] font-semibold tabular-nums">{children}</span>}
    </span>
  )
}
