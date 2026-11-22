import { m } from '@lc/i18n/messages'
import { Button, FIELD, FOOT, INPUT, META, Modal, TITLE } from '@lc/ui'

interface Props {
  open: boolean
  /** The zone chosen now, an IANA name such as `Europe/Warsaw`; null for none */
  zone: string | null
  /** Called with the new choice; the dialog stays open, so the hour column can be seen changing */
  onChoose: (zone: string | null) => void
  onClose: () => void
}

const zones = () => (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])
const here = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/** Picks the time zone whose clock is shown next to the plan's own in the hour column. */
export function SecondZoneDialog({ open, zone, onChoose, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className={TITLE}>{m.second_zone()}</h2>
      <p className={META}>{m.second_zone_hint()}</p>
      {open && (
        <label className={`${FIELD} mt-4`}>
          {m.second_zone_label()}
          <select className={INPUT} value={zone ?? ''} onChange={(e) => onChoose(e.target.value || null)}>
            <option value="">{m.second_zone_none()}</option>
            {zones().map((name) => (
              <option key={name} value={name}>
                {name.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={FOOT}>
        {open && zone !== here() && (
          <Button className="mr-auto" onClick={() => onChoose(here())}>
            {m.second_zone_mine({ zone: here().replaceAll('_', ' ') })}
          </Button>
        )}
        <Button primary onClick={onClose}>
          {m.close()}
        </Button>
      </div>
    </Modal>
  )
}
