import { Controls, Description, Primary, Stories, Title, useOf } from '@storybook/addon-docs/blocks'
import { useSyncExternalStore } from 'react'

import { getLocale, subscribe } from '../globals'
import { chapterHref, originOf } from '../story/links'
import { sourceOf } from './source'

/** The chapters of the guide that built the component, in the stand's language. */
function BuiltIn({ file }: { file: string }) {
  const locale = useSyncExternalStore(subscribe, getLocale)
  const { chapters } = originOf(file)
  if (chapters.length === 0) return null
  return (
    <p>
      Built in{' '}
      {chapters.map((chapter, position) => (
        <span key={chapter.id}>
          {position > 0 && ', '}
          <a href={chapterHref(chapter, locale)} target="_blank" rel="noreferrer">
            chapter {chapter.number}, {chapter.title}
          </a>
        </span>
      ))}
      .
    </p>
  )
}

/**
 * The generated page of a component: Storybook's default one plus the path of the file it documents and the
 * chapters of the guide that tell how it was built.
 */
export function ComponentPage() {
  const { preparedMeta } = useOf('meta', ['meta'])
  const file: unknown = preparedMeta.parameters.fileName
  return (
    <>
      <Title />
      {typeof file === 'string' && (
        <>
          <p>
            <code>{sourceOf(file)}</code>
          </p>
          <BuiltIn file={file} />
        </>
      )}
      <Description />
      <Primary />
      <Controls />
      <Stories />
    </>
  )
}
