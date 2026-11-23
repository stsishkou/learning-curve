// Loaded with import() on first use, so neither this file nor the federation runtime is in a host's first bundle.
import {
  DOCS_CONTRACT,
  DOCS_HELP_MODULE,
  DOCS_REMOTE_NAME,
  type DocsHelpModule,
  isCompatible,
  isDocsHelpModule,
} from '@lc/docs-contract'
import { createInstance } from '@module-federation/runtime'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as JSXRuntime from 'react/jsx-runtime'

export type DocsLoadFailure = 'timeout' | 'unavailable' | 'shape' | 'version'

export class DocsLoadError extends Error {
  readonly reason: DocsLoadFailure

  constructor(reason: DocsLoadFailure, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DocsLoadError'
    this.reason = reason
  }
}

export interface LoadOptions {
  /** The remote's `mf-manifest.json`, from the host's run-time configuration */
  manifestUrl: string
  /** Gives up after this many milliseconds, so a hanging host shows its fallback */
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

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DocsLoadError('timeout', `The docs remote did not answer in ${ms} ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

/** Loads `lc_docs/help` and checks it implements a contract of the same major as the one this host was built with. */
export async function loadDocsHelp({ manifestUrl, timeoutMs = 8000 }: LoadOptions): Promise<DocsHelpModule> {
  const federation = createInstance({
    name: 'lc_docs_host',
    remotes: [{ name: DOCS_REMOTE_NAME, entry: fresh(manifestUrl) }],
    shared: {
      react: shared(React),
      'react-dom': shared(ReactDOM),
      'react-dom/client': shared(ReactDOMClient),
      'react/jsx-runtime': shared(JSXRuntime),
    },
  })
  let loaded: unknown
  try {
    loaded = await withTimeout(federation.loadRemote<unknown>(DOCS_HELP_MODULE), timeoutMs)
  } catch (err) {
    if (err instanceof DocsLoadError) throw err
    throw new DocsLoadError('unavailable', `The docs remote could not be loaded from ${manifestUrl}`, { cause: err })
  }
  if (!isDocsHelpModule(loaded)) throw new DocsLoadError('shape', `${DOCS_HELP_MODULE} does not export createDocsHost`)
  if (!isCompatible(loaded.version)) {
    throw new DocsLoadError(
      'version',
      `${DOCS_HELP_MODULE} implements contract ${loaded.version}; this host needs ${DOCS_CONTRACT}`,
    )
  }
  return loaded
}
