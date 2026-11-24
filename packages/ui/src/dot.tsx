interface Props {
  /** The size, as a utility class (`size-2.5`): the dot has none of its own */
  className?: string
}

/**
 * A round marker in the calendar color. Set the color on it or on any ancestor with `calendarColor()`.
 */
export function Dot({ className = '' }: Props) {
  return <i className={`flex-none rounded-full bg-cal ${className}`} />
}
