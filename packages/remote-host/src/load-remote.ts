// Not imported by the host's first bundle: a host imports this with import() on first use, so the federation runtime
// stays out of it.
import { createInstance } from '@module-federation/runtime'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as JSXRuntime from 'react/jsx-runtime'

/**
 * Why a remote could not be used: it did not answer in time, could not be fetched, exports something other than the
 * agreed shape, or implements an incompatible contract version.
 */
export type RemoteLoadFailure = 'timeout' | 'unavailable' | 'shape' | 'version'

/** What `loadRemote` throws; a host shows its fallback and may say more by `reason`. */
export class RemoteLoadError extends Error {
  readonly reason: RemoteLoadFailure

  constructor(reason: RemoteLoadFailure, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RemoteLoadError'
    this.reason = reason
  }
}

/** Which module of which remote to load, and how to tell that it is the one this host was built for. */
export interface LoadRemoteOptions<T> {
  /** The remote's `mf-manifest.json`, from the host's run-time configuration */
  manifestUrl: string
  /** The remote's federation name, as in the first half of `module` */
  remoteName: string
  /** The exposed module, as `<remoteName>/<expose>` */
  module: string
  /** This host's federation name */
  hostName: string
  /** Narrows what the remote exported; a module that fails it is a `shape` failure */
  isModule: (value: unknown) => value is T
  /** Whether the module implements a contract this host can use; a module that fails it is a `version` failure */
  isCompatible: (module: T) => boolean
  /** Gives up after this many milliseconds (8000 when omitted), so a hanging remote shows the host's fallback */
  timeoutMs?: number | undefined
}

// The host's own copies: the remote takes these instead of downloading its fallback React. A singleton cannot be
// duplicated, so a remote built against another major gets a warning and this copy.
const shared = (lib: object) => ({
  version: React.version,
  scope: 'default',
  lib: () => lib,
  shareConfig: { singleton: true, requiredVersion: `^${React.version}` },
})

/**
 * A query that changes on every page load: the manifest is the remote's one file with a fixed name, and a static
 * host may keep it cached for minutes (GitHub Pages: ten). Everything it points to has a content hash.
 */
function fresh(manifestUrl: string): string {
  const url = new URL(manifestUrl, globalThis.location.href)
  url.searchParams.set('v', Date.now().toString(36))
  return url.href
}

function withTimeout<T>(work: Promise<T>, ms: number, remoteName: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RemoteLoadError('timeout', `${remoteName} did not answer in ${ms} ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Loads one module of a Module Federation remote with the host's own React shared, and checks it. Rejects with a
 * `RemoteLoadError`: `timeout` when the remote does not answer, `unavailable` when it cannot be fetched, `shape`
 * when the module is not what `isModule` accepts, `version` when `isCompatible` refuses it.
 */
export async function loadRemote<T>({
  manifestUrl,
  remoteName,
  module,
  hostName,
  isModule,
  isCompatible,
  timeoutMs = 8000,
}: LoadRemoteOptions<T>): Promise<T> {
  const federation = createInstance({
    name: hostName,
    remotes: [{ name: remoteName, entry: fresh(manifestUrl) }],
    shared: {
      react: shared(React),
      'react-dom': shared(ReactDOM),
      'react-dom/client': shared(ReactDOMClient),
      'react/jsx-runtime': shared(JSXRuntime),
    },
  })
  let loaded: unknown
  try {
    loaded = await withTimeout(federation.loadRemote<unknown>(module), timeoutMs, remoteName)
  } catch (err) {
    if (err instanceof RemoteLoadError) throw err
    throw new RemoteLoadError('unavailable', `${remoteName} could not be loaded from ${manifestUrl}`, { cause: err })
  }
  if (!isModule(loaded)) throw new RemoteLoadError('shape', `${module} does not export what this host expects`)
  if (!isCompatible(loaded))
    throw new RemoteLoadError('version', `${module} implements a contract this host cannot use`)
  return loaded
}
