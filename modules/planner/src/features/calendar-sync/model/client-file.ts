/** An OAuth client as Google offers it for download when it is made. */
export interface ClientFile {
  id: string
  secret: string
  /** `web` for a Web application client, `installed` for a Desktop app one */
  kind: 'web' | 'installed'
  /** The redirect URIs registered on it */
  redirects: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The client in the JSON Google offers (`{ "web": { "client_id", … } }`); null when the text holds none. */
export function readClientFile(text: string): ClientFile | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(data)) return null
  const kind = isRecord(data.web) ? 'web' : isRecord(data.installed) ? 'installed' : null
  const client = kind ? data[kind] : null
  if (!kind || !isRecord(client)) return null
  const { client_id: id, client_secret: secret, redirect_uris: redirects } = client
  if (typeof id !== 'string' || typeof secret !== 'string' || !id || !secret) return null
  return {
    id,
    secret,
    kind,
    redirects: Array.isArray(redirects) ? redirects.filter((uri) => typeof uri === 'string') : [],
  }
}
