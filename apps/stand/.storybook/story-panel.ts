// Written with createElement rather than JSX: the manager runs on Storybook's own copy of React, and the JSX
// transforms either need React in scope (classic) or bundle a jsx-runtime whose elements that copy rejects (automatic).
import { commitUrl } from '@lc/docs-contract'
import { createElement as h, Fragment } from 'react'
import { AddonPanel } from 'storybook/internal/components'
import { addons, types, useGlobals, useStorybookState } from 'storybook/manager-api'
import { styled } from 'storybook/theming'

import { chapterHref, fileHref, guideHref, originOf } from '../src/story/links'

const ADDON = 'lc/story'

const Wrapper = styled.div(({ theme }) => ({
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  fontSize: theme.typography.size.s2,
  lineHeight: 1.5,
  color: theme.color.defaultText,
  '& a': { color: theme.color.secondary },
  '& code': { fontSize: '0.9em' },
  '& ol': { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 },
}))

const Muted = styled.span(({ theme }) => ({ color: theme.color.mediumdark }))

const external = (href: string, ...children: Parameters<typeof h>[2][]) =>
  h('a', { href, target: '_blank', rel: 'noreferrer' }, ...children)

/**
 * The "Story" panel: which slice of the code the component on screen belongs to, its file in the repository, and
 * the chapters of the guide that built it with their commits.
 */
function StoryPanel() {
  const { storyId, index } = useStorybookState()
  const [globals] = useGlobals()
  const entry = index?.[storyId]
  if (!entry || !('importPath' in entry)) return null
  const { feature, chapters, file } = originOf(entry.importPath)
  const locale: unknown = globals['locale']

  const where = h(
    'p',
    null,
    h(Muted, null, 'Slice '),
    h('code', null, feature ?? 'none the guide covers'),
    h(Muted, null, ' · file '),
    external(fileHref(file), h('code', null, file)),
  )
  const list =
    chapters.length > 0
      ? h(
          'ol',
          null,
          ...chapters.map((chapter) =>
            h(
              'li',
              { key: chapter.id },
              external(chapterHref(chapter, locale), `Chapter ${chapter.number}: ${chapter.title}`),
              chapter.commits.length > 0 &&
                h(
                  Fragment,
                  null,
                  h(Muted, null, ' · '),
                  ...chapter.commits.map((sha, position) =>
                    h('span', { key: sha }, position > 0 ? ' ' : '', external(commitUrl(sha), h('code', null, sha))),
                  ),
                ),
            ),
          ),
        )
      : h('p', null, h(Muted, null, 'No chapter is about this slice yet. '), external(guideHref(locale), 'The guide'))
  return h(Wrapper, null, where, list)
}

export function registerStoryPanel() {
  addons.register(ADDON, () => {
    addons.add(`${ADDON}/panel`, {
      type: types.PANEL,
      title: 'Story',
      render: ({ active }) => h(AddonPanel, { active: Boolean(active), children: h(StoryPanel) }),
    })
  })
}
