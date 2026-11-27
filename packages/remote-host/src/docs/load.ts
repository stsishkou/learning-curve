// Loaded with import() on first use, so neither this file nor the federation runtime is in a host's first bundle.
import {
  DOCS_HELP_MODULE,
  DOCS_REMOTE_NAME,
  type DocsHelpModule,
  isCompatible,
  isDocsHelpModule,
} from '@lc/docs-contract'

import { loadRemote, type RemoteLoadFailure } from '../load-remote'

/** Why the docs remote could not be used; the hook reports it for a host's fallback. */
export type DocsLoadFailure = RemoteLoadFailure

/** Where the docs remote is and how long to wait for it. */
export interface LoadOptions {
  /** The remote's `mf-manifest.json`, from the host's run-time configuration */
  manifestUrl: string
  /** Gives up after this many milliseconds, so a hanging host shows its fallback */
  timeoutMs?: number | undefined
}

/** Loads `lc_docs/help` and checks it implements a contract of the same major as the one this host was built with. */
export function loadDocsHelp({ manifestUrl, timeoutMs }: LoadOptions): Promise<DocsHelpModule> {
  return loadRemote<DocsHelpModule>({
    manifestUrl,
    remoteName: DOCS_REMOTE_NAME,
    module: DOCS_HELP_MODULE,
    hostName: 'lc_docs_host',
    isModule: isDocsHelpModule,
    isCompatible: (loaded) => isCompatible(loaded.version),
    timeoutMs,
  })
}
