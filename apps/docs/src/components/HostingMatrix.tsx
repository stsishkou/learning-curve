import type { ReactNode } from 'react'

import { useLocale } from '../app/env'
import { type Fit, PLANNER_HOSTS, STATIC_HOSTS } from '../content/hosting'
import { m } from '../paraglide/messages'
import { InlineText } from './InlineText'

function FitCell({ fit }: { fit: Fit }) {
  const locale = useLocale()
  const label = {
    yes: m.fit_yes({}, { locale }),
    no: m.fit_no({}, { locale }),
    partial: m.fit_partial({}, { locale }),
  }[fit]
  const sign = { yes: '●', no: '○', partial: '◐' }[fit]
  const tone = { yes: 'text-done-ink', no: 'text-today-ink', partial: 'text-muted' }[fit]
  return (
    <td className="px-3 py-2 whitespace-nowrap">
      <span aria-hidden className={tone}>
        {sign}
      </span>{' '}
      {label}
    </td>
  )
}

function Pick({ pick }: { pick: 'cheapest' | 'value' | 'control' | undefined }) {
  const locale = useLocale()
  if (!pick) return null
  const label = {
    cheapest: m.hosting_pick_cheapest({}, { locale }),
    value: m.hosting_pick_value({}, { locale }),
    control: m.hosting_pick_control({}, { locale }),
  }[pick]
  return (
    <span className="ml-1 rounded-full bg-focus px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-surface">
      {label}
    </span>
  )
}

function Table({ caption, head, children }: { caption: string; head: readonly string[]; children: ReactNode }) {
  return (
    // A region that scrolls sideways takes focus, so a keyboard can scroll it (WCAG 2.1.1).
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above
    <div className="lc-card overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
        <caption className="px-3 pt-3 pb-1 text-left font-semibold">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-muted">
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3 py-2 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line-soft [&>tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  )
}

/** Chapter 22's comparison: where the server app can run, and where the static docs, remote and stand can. */
export function HostingMatrix() {
  const locale = useLocale()
  return (
    <div className="my-6 flex flex-col gap-6">
      <Table
        caption={m.hosting_planner_caption({}, { locale })}
        head={[
          m.hosting_option({}, { locale }),
          m.hosting_price({}, { locale }),
          m.hosting_ssr({}, { locale }),
          m.hosting_api({}, { locale }),
          m.hosting_disk({}, { locale }),
          m.hosting_free({}, { locale }),
          m.hosting_note({}, { locale }),
        ]}
      >
        {PLANNER_HOSTS.map((host) => (
          <tr key={host.name} className={host.pick ? 'bg-focus/5' : ''}>
            <th scope="row" className="px-3 py-2 font-semibold">
              {host.name}
              <Pick pick={host.pick} />
            </th>
            <td className="px-3 py-2 whitespace-nowrap tabular-nums">{host.price}</td>
            <FitCell fit={host.ssr} />
            <FitCell fit={host.api} />
            <FitCell fit={host.disk} />
            <td className="px-3 py-2 text-muted">{host.free}</td>
            <td className="px-3 py-2">
              <InlineText text={host.note} />
            </td>
          </tr>
        ))}
      </Table>
      <Table
        caption={m.hosting_static_caption({}, { locale })}
        head={[
          m.hosting_option({}, { locale }),
          m.hosting_price({}, { locale }),
          m.hosting_headers({}, { locale }),
          m.hosting_previews({}, { locale }),
          m.hosting_account({}, { locale }),
          m.hosting_note({}, { locale }),
        ]}
      >
        {STATIC_HOSTS.map((host) => (
          <tr key={host.name} className={host.pick ? 'bg-focus/5' : ''}>
            <th scope="row" className="px-3 py-2 font-semibold">
              {host.name}
              <Pick pick={host.pick} />
            </th>
            <td className="px-3 py-2 tabular-nums">{host.price}</td>
            <td className="px-3 py-2">
              <InlineText text={host.headers} />
            </td>
            <FitCell fit={host.previews} />
            <td className="px-3 py-2 text-muted">{host.account}</td>
            <td className="px-3 py-2">
              <InlineText text={host.note} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
