import { m } from '@lc/i18n/messages'

import { ClientFields, CopyValue, PageLink, Step, type SetupProps } from './setup-parts'

const ENTRA = 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps'
/** Microsoft Entra's pages for each step */
export const ENTRA_PAGES = {
  register: `${ENTRA}/CreateApplicationBlade/quickStartType~/null/isMSAApp~/false`,
  apps: `${ENTRA}/ApplicationsListBlade`,
}

/**
 * The steps that register the person's own app in Microsoft Entra, each with the page it happens on and the value to
 * paste there, then the app's ID and secret. Microsoft offers no file to load, so both are pasted.
 */
export function OutlookSetup({ callback, id, secret, onClient }: SetupProps) {
  return (
    <ol className="mt-4 grid gap-3.5 text-[13.5px]/[1.45]">
      <Step n={1} text={m.outlook_step_register()}>
        <span>
          <PageLink href={ENTRA_PAGES.register}>{m.outlook_link_register()}</PageLink>
        </span>
      </Step>
      <Step n={2} text={m.outlook_step_redirect()}>
        {callback && <CopyValue value={callback} />}
      </Step>
      <Step n={3} text={m.outlook_step_secret()}>
        <span>
          <PageLink href={ENTRA_PAGES.apps}>{m.outlook_link_apps()}</PageLink>
        </span>
      </Step>
      <Step n={4} text={m.outlook_step_paste()}>
        <ClientFields
          id={id}
          secret={secret}
          placeholder="00000000-0000-0000-0000-000000000000"
          onId={(value) => onClient(value, secret)}
          onSecret={(value) => onClient(id, value)}
        />
        <p className="text-[12.5px] text-muted">{m.outlook_work_note()}</p>
      </Step>
    </ol>
  )
}
