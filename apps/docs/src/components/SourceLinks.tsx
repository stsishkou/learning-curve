import { commitUrl, PINNED_COMMIT, sourceUrl } from '@lc/docs-contract'
import { ExternalLink } from '@lc/ui'

import { useLocale } from '../app/env'
import type { FileRef, Source } from '../content/syllabus/types'
import { m } from '../paraglide/messages'
import { InlineText } from './InlineText'

const short = (sha: string) => sha.slice(0, 7)

/** A file at the pinned commit (or the one it names), with the lines to look at and why. */
export function FileLink({ file }: { file: FileRef }) {
  const locale = useLocale()
  const at = file.at ?? PINNED_COMMIT
  return (
    <li className="flex flex-col gap-0.5">
      <a
        className="lc-link inline-flex w-fit items-center gap-1.5"
        href={sourceUrl(file.path, file.lines, at)}
        translate="no"
      >
        <code className="lc-code">{file.path}</code>
        {file.lines && (
          <span className="text-xs text-muted">{m.lines({ from: file.lines[0], to: file.lines[1] }, { locale })}</span>
        )}
        <ExternalLink aria-hidden size={13} className="shrink-0 text-muted" />
      </a>
      <span className="text-sm text-muted">
        <InlineText text={file.note} />
        {file.at && file.at !== 'main' && (
          <span className="ml-1 text-xs">({m.open_commit({ sha: short(file.at) }, { locale })})</span>
        )}
      </span>
    </li>
  )
}

export function CommitLink({ sha }: { sha: string }) {
  return (
    <a className="lc-link font-mono text-sm" href={commitUrl(sha)} translate="no">
      {short(sha)}
    </a>
  )
}

/** A commit, a file or an official page that backs a decision. */
export function SourceItem({ source }: { source: Source }) {
  const link =
    source.kind === 'commit' ? (
      <CommitLink sha={source.ref} />
    ) : source.kind === 'file' ? (
      <a className="lc-link" href={sourceUrl(source.ref, undefined, source.at ?? PINNED_COMMIT)} translate="no">
        <code className="lc-code">{source.ref}</code>
      </a>
    ) : (
      <a className="lc-link break-all" href={source.ref}>
        {source.ref.replace(/^https?:\/\//, '')}
      </a>
    )
  return (
    <li>
      {link}
      {source.note && (
        <span className="text-muted">
          {' — '}
          <InlineText text={source.note} />
        </span>
      )}
    </li>
  )
}
