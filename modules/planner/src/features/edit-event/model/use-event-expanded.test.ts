import { describe, expect, it } from 'vitest'

import { parseEventExpanded } from './use-event-expanded'

describe('parseEventExpanded', () => {
  it('is small when nothing is stored', () => expect(parseEventExpanded(null)).toBe(false))
  it('is expanded when 1 is stored', () => expect(parseEventExpanded('1')).toBe(true))
  it('reads anything else as small', () => {
    for (const raw of ['0', 'true', '', '{}', 'yes']) expect(parseEventExpanded(raw)).toBe(false)
  })
})
