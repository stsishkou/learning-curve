import { describe, expect, it } from 'vitest'

import {
  CHAPTERS,
  chaptersForFeature,
  docsPageUrl,
  FEATURES,
  featureOfPath,
  isCompatible,
  isDocsHelpModule,
  PARTS,
  sourceUrl,
} from './index.ts'

describe('the catalogue', () => {
  it('numbers chapters 1..n in order, in known parts', () => {
    expect(CHAPTERS.map((chapter) => chapter.number)).toEqual(CHAPTERS.map((_, index) => index + 1))
    const parts = new Set<string>(PARTS.map((part) => part.id))
    for (const chapter of CHAPTERS) expect(parts.has(chapter.part)).toBe(true)
  })

  it('covers every feature with at least one chapter', () => {
    for (const feature of FEATURES) expect(chaptersForFeature(feature).length, feature).toBeGreaterThan(0)
  })

  it('finds the slice of a story file', () => {
    expect(featureOfPath('./modules/planner/src/widgets/week-grid/ui/WeekGrid.stories.tsx')).toBe(
      'planner/widgets/week-grid',
    )
    expect(featureOfPath('../../packages/ui/src/button.stories.tsx')).toBe('ui')
    expect(featureOfPath('./modules/planner/src/shared/lib/x.stories.tsx')).toBeNull()
  })

  it('links a file at the pinned commit, or at another', () => {
    expect(sourceUrl('a/b.ts', [3, 9])).toMatch(/\/blob\/[0-9a-f]{40}\/a\/b\.ts#L3-L9$/)
    expect(sourceUrl('a/b.ts', undefined, 'main')).toMatch(/\/blob\/main\/a\/b\.ts$/)
  })
})

describe('compatibility', () => {
  it('accepts the same major only', () => {
    expect(isCompatible('1.4.2', '1.0.0')).toBe(true)
    expect(isCompatible('2.0.0', '1.9.0')).toBe(false)
    expect(isCompatible('', '1.0.0')).toBe(false)
  })

  it('recognises the help module by shape', () => {
    expect(isDocsHelpModule({ version: '1.0.0', createDocsHost: () => null })).toBe(true)
    expect(isDocsHelpModule({ version: 1, createDocsHost: () => null })).toBe(false)
    expect(isDocsHelpModule({ default: { version: '1.0.0' } })).toBe(false)
    expect(isDocsHelpModule(null)).toBe(false)
  })
})

describe('docsPageUrl', () => {
  it('links a chapter, the first chapter of a topic, or the start page', () => {
    expect(docsPageUrl('https://x.test/guide', 'en', { chapterId: 'shipping' })).toBe(
      'https://x.test/guide/en/chapters/shipping/',
    )
    const first = chaptersForFeature('planner/widgets/week-grid').at(0)?.id
    expect(docsPageUrl('https://x.test/', 'ru', { topicId: 'planner/widgets/week-grid' })).toBe(
      `https://x.test/ru/chapters/${first}/`,
    )
    expect(docsPageUrl('https://x.test/', 'es')).toBe('https://x.test/es/')
  })
})
