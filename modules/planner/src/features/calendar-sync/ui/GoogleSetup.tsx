import { m } from '@lc/i18n/messages'
import { GOOGLE_SCOPE } from '@lc/plan-domain'
import { useState, type ChangeEvent } from 'react'

import { readClientFile, type ClientFile } from '../model/client-file'
import { ClientFields, CopyValue, NOTE, PageLink, Step, type SetupProps } from './setup-parts'

const CONSOLE = 'https://console.cloud.google.com'
/** Google's own pages for each step; the first one makes a project when there is none */
export const CONSOLE_PAGES = {
  api: `${CONSOLE}/flows/enableapi?apiid=calendar-json.googleapis.com`,
  auth: `${CONSOLE}/auth/overview`,
  scope: `${CONSOLE}/auth/scopes`,
  client: `${CONSOLE}/auth/clients`,
}

/**
 * The steps that make the person's own OAuth client in Google Cloud, each with the page of Google's console it
 * happens on and the value to paste there, then the client itself: the JSON Google offers when it is made, or its ID
 * and secret.
 */
export function GoogleSetup({ callback, id, secret, onClient }: SetupProps) {
  const [loaded, setLoaded] = useState<ClientFile | 'wrong' | null>(null)

  function take(text: string) {
    const file = readClientFile(text)
    setLoaded(file ?? 'wrong')
    if (file) onClient(file.id, file.secret)
  }

  async function load(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Cleared, so choosing the same file again reads it again.
    e.target.value = ''
    if (file) take(await file.text())
  }

  const note =
    loaded === 'wrong'
      ? m.google_file_wrong()
      : loaded?.kind === 'installed'
        ? m.google_file_desktop()
        : loaded && callback && !loaded.redirects.includes(callback)
          ? m.google_file_redirect()
          : ''

  return (
    <ol className="mt-4 grid gap-3.5 text-[13.5px]/[1.45]">
      <Step n={1} text={m.google_step_api()}>
        <span>
          <PageLink href={CONSOLE_PAGES.api}>{m.google_link_api()}</PageLink>
        </span>
      </Step>
      <Step n={2} text={m.google_step_auth()}>
        <span>
          <PageLink href={CONSOLE_PAGES.auth}>{m.google_link_auth()}</PageLink>
        </span>
      </Step>
      <Step n={3} text={m.google_step_scope()}>
        <CopyValue value={GOOGLE_SCOPE} />
        <span>
          <PageLink href={CONSOLE_PAGES.scope}>{m.google_link_scope()}</PageLink>
        </span>
      </Step>
      <Step n={4} text={m.google_step_client()}>
        {callback && <CopyValue value={callback} />}
        <span>
          <PageLink href={CONSOLE_PAGES.client}>{m.google_link_client()}</PageLink>
        </span>
      </Step>
      <Step n={5} text={m.google_step_load()}>
        <label className="inline-flex w-fit cursor-pointer items-center rounded-[10px] border border-line bg-surface px-3.5 py-2 font-medium shadow-card hover:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-focus">
          {m.google_load_file()}
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void load(e)} />
        </label>
        <ClientFields
          id={id}
          secret={secret}
          placeholder="….apps.googleusercontent.com"
          // The whole JSON pasted here works as well as the file.
          onId={(value) => (value.trimStart().startsWith('{') ? take(value) : onClient(value, secret))}
          onSecret={(value) => onClient(id, value)}
        />
        {note && (
          <p className={NOTE} role="alert">
            {note}
          </p>
        )}
      </Step>
    </ol>
  )
}
