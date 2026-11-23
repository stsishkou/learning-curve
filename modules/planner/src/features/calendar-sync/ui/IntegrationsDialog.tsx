import { m } from '@lc/i18n/messages'
import type { CalendarProvider } from '@lc/plan-domain'
import { CalendarDays, CalendarSync, ChevronRight, Download, FOOT, META, Modal, TITLE, Button } from '@lc/ui'
import type { ReactNode } from 'react'

import { appTitle } from '../../../shared/lib'
import { attentionOf, type CalendarSyncStatus } from '../model/source'
import { moment } from './CalendarSyncDialog'

interface Props {
  open: boolean
  /** The calendar apps the plan can be kept in here; none on a host where the plan cannot change */
  apps: CalendarSyncStatus[]
  /** A round runs for the app */
  working: (provider: CalendarProvider) => boolean
  /** Present when the person's own busy time can be shown: `host` is where it comes from now */
  busy?: { host: string | null } | undefined
  /** Present when the plan can be exported as files */
  onExport?: (() => void) | undefined
  onApp: (provider: CalendarProvider) => void
  /** Opens the edits that wait for a decision, from every app */
  onReview: () => void
  onBusy: () => void
  onClose: () => void
}

function Row(props: {
  icon: ReactNode
  title: string
  detail: string
  /** The detail asks for the person's attention */
  alert?: boolean
  action: string
  onOpen: () => void
}) {
  const { icon, title, detail, alert, action, onOpen } = props
  return (
    <li>
      <button
        type="button"
        className="grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl border border-line-soft px-3.5 py-2.5 text-left text-[14px] hover:bg-surface-2 active:scale-[0.99]"
        onClick={onOpen}
      >
        <span className="flex text-muted">{icon}</span>
        <span className="min-w-0">
          <span className="block font-medium text-pretty">{title}</span>
          <span className={`block text-[12.5px] text-pretty ${alert ? 'text-today-ink' : 'text-muted'}`}>{detail}</span>
        </span>
        <span className="flex items-center gap-0.5 text-[13px] font-medium whitespace-nowrap text-focus">
          {action}
          <ChevronRight size={15} aria-hidden />
        </span>
      </button>
    </li>
  )
}

/** How one app's sync stands, in a few words. */
function appDetail(status: CalendarSyncStatus, working: boolean): { detail: string; alert: boolean } {
  const attention = attentionOf(status)
  if (attention === 'waiting') return { detail: m.integrations_waiting({ count: status.inbox.length }), alert: true }
  if (attention === 'problem') return { detail: m.integrations_attention(), alert: true }
  if (status.connectedAt === null) return { detail: m.integrations_off(), alert: false }
  if (working) return { detail: m.sync_syncing(), alert: false }
  const when = status.lastRound
  return { detail: when ? m.integrations_synced({ when: moment(when) }) : m.sync_not_synced(), alert: false }
}

/** Where an app's row leads: to the edits that wait when there are some, else to the app's own dialog. */
function appAction(
  status: CalendarSyncStatus,
  onApp: () => void,
  onReview: () => void,
): { action: string; onOpen: () => void } {
  if (status.inbox.length) return { action: m.sync_review(), onOpen: onReview }
  return { action: status.connectedAt === null ? m.integrations_set_up() : m.integrations_open(), onOpen: onApp }
}

const HEADING = 'mt-4 mb-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase'
const ICON = { size: 17, 'aria-hidden': true } as const

/**
 * The one place the plan meets other calendars: the apps it is kept in, both ways, then what goes one way only (the
 * person's own busy time drawn behind the plan, and files to import once). Each row says how it stands and opens it.
 */
export function IntegrationsDialog({ open, apps, working, busy, onExport, onApp, onReview, onBusy, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className={TITLE}>{m.integrations_title()}</h2>
      <p className={META}>{m.integrations_hint()}</p>
      {apps.length > 0 && (
        <>
          <h3 className={HEADING}>{m.integrations_sync()}</h3>
          <ul className="grid gap-1.5">
            {apps.map((status) => (
              <Row
                key={status.provider}
                icon={<CalendarSync {...ICON} />}
                title={appTitle(status.provider)}
                {...appDetail(status, working(status.provider))}
                {...appAction(status, () => onApp(status.provider), onReview)}
              />
            ))}
          </ul>
        </>
      )}
      {(busy !== undefined || onExport !== undefined) && (
        <>
          <h3 className={HEADING}>{m.integrations_one_way()}</h3>
          <ul className="grid gap-1.5">
            {busy && (
              <Row
                icon={<CalendarDays {...ICON} />}
                title={m.busy_calendar()}
                detail={busy.host ? m.busy_connected({ host: busy.host }) : m.integrations_off()}
                action={busy.host ? m.integrations_open() : m.integrations_set_up()}
                onOpen={onBusy}
              />
            )}
            {onExport && (
              <Row
                icon={<Download {...ICON} />}
                title={m.export_to_calendar()}
                detail={m.integrations_export()}
                action={m.integrations_open()}
                onOpen={onExport}
              />
            )}
          </ul>
        </>
      )}
      <div className={FOOT}>
        <Button onClick={onClose}>{m.close()}</Button>
      </div>
    </Modal>
  )
}
