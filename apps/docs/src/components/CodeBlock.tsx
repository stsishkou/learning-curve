import { sourceUrl } from '@lc/docs-contract'
import { ExternalLink } from '@lc/ui'
import { type ComponentProps, useRef } from 'react'

import { useLocale } from '../app/env'
import { m } from '../paraglide/messages'
import { CopyButton } from './CopyButton'

/** What mdx.config.ts puts on a fence filled from the repository. */
export interface CodeBlockProps extends ComponentProps<'pre'> {
  'data-file'?: string | undefined
  'data-at'?: string | undefined
  'data-from'?: string | undefined
  'data-lines'?: string | undefined
}

function range(spec: string | undefined): readonly [number, number] | undefined {
  const [from, to = from] = (spec ?? '').split('-').map(Number)
  return from && to ? [from, to] : undefined
}

/** A highlighted code block. One that came from the repository shows its path and links to those lines on GitHub. */
export function CodeBlock({
  'data-file': file,
  'data-at': at,
  'data-from': from,
  'data-lines': lines,
  ...props
}: CodeBlockProps) {
  const locale = useLocale()
  const ref = useRef<HTMLPreElement>(null)
  const lineRange = range(lines)
  return (
    <figure className="lc-codeblock" translate="no" data-from={from}>
      <figcaption className="flex min-h-9 items-center justify-between gap-2 border-b border-line-soft py-1 pr-1 pl-3 text-xs">
        {file && at ? (
          <a
            className="lc-link inline-flex min-w-0 items-center gap-1.5"
            href={sourceUrl(file, lineRange, at === 'worktree' ? 'HEAD' : at)}
          >
            <span className="truncate font-mono">{file}</span>
            {lineRange && (
              <span className="shrink-0 text-muted">
                {m.lines({ from: lineRange[0], to: lineRange[1] }, { locale })}
              </span>
            )}
            <ExternalLink aria-hidden size={12} className="shrink-0" />
          </a>
        ) : (
          <span />
        )}
        <CopyButton text={() => ref.current?.textContent ?? ''} />
      </figcaption>
      <pre ref={ref} {...props} />
    </figure>
  )
}
