import { Controls, Description, Primary, Stories, Title, useOf } from '@storybook/addon-docs/blocks'

import { sourceOf } from './source'

/** The generated page of a component: Storybook's default one plus the path of the file it documents. */
export function ComponentPage() {
  const { preparedMeta } = useOf('meta', ['meta'])
  const file: unknown = preparedMeta.parameters.fileName
  return (
    <>
      <Title />
      {typeof file === 'string' && (
        <p>
          <code>{sourceOf(file)}</code>
        </p>
      )}
      <Description />
      <Primary />
      <Controls />
      <Stories />
    </>
  )
}
