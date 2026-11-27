// The loader (and with it the federation runtime) is not exported: the hook imports it on first use, so importing this
// entry adds a hook to a host's bundle and nothing else.
export type { DocsLoadFailure } from './load'
export {
  useDocsHost,
  type DocsEventHandlers,
  type DocsHostOptions,
  type DocsHostState,
  type DocsStatus,
} from './use-docs-host'
