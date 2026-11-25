import { ExternalLink, Eye, EyeOff } from '@lc/ui'
import { useState } from 'react'

import { useDocsEnv } from '../app/env'
import { m } from '../paraglide/messages'

/** The stand's page for a story, and the bare story for an iframe, in the reader's language and scheme. */
export const storyPageUrl = (stand: string, id: string) => `${stand}?path=/story/${id}`
export const storyFrameUrl = (stand: string, id: string, locale: string) =>
  `${stand}iframe.html?id=${id}&viewMode=story&globals=locale:${locale}`

/** A story of the component stand: its id, a link to it, and on demand the live component in a frame. */
export function StoryEmbed({ id }: { id: string }) {
  const { stand, locale } = useDocsEnv()
  const [shown, setShown] = useState(false)
  return (
    <li className="lc-card flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="lc-code text-sm" translate="no">
          {id}
        </code>
        <div className="flex gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-ink"
            aria-expanded={shown}
            onClick={() => setShown(!shown)}
          >
            {shown ? <EyeOff aria-hidden size={14} /> : <Eye aria-hidden size={14} />}
            {shown ? m.story_hide({}, { locale }) : m.story_show({}, { locale })}
          </button>
          <a
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-focus hover:bg-surface-2"
            href={storyPageUrl(stand, id)}
            target="_blank"
            rel="noreferrer"
          >
            {m.story_open({}, { locale })}
            <ExternalLink aria-hidden size={13} />
          </a>
        </div>
      </div>
      {shown && (
        <iframe
          className="h-[420px] w-full rounded-lg border border-line bg-bg"
          src={storyFrameUrl(stand, id, locale)}
          title={m.story_frame_title({ id }, { locale })}
          loading="lazy"
          sandbox="allow-scripts"
        />
      )}
    </li>
  )
}

export function StoryList({ ids }: { ids: readonly string[] }) {
  return (
    <ul className="grid gap-3">
      {ids.map((id) => (
        <StoryEmbed key={id} id={id} />
      ))}
    </ul>
  )
}
