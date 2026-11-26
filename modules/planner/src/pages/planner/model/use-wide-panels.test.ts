import { describe, expect, it } from 'vitest'

import { parseWidePanels } from './use-wide-panels'

describe('parseWidePanels', () => {
  it('shows nothing when nothing is stored', () => {
    expect(parseWidePanels(null)).toEqual({ next: false, insights: false })
  })
  it('shows the panels the list names', () => {
    expect(parseWidePanels('["insights"]')).toEqual({ next: false, insights: true })
    expect(parseWidePanels('["next","insights"]')).toEqual({ next: true, insights: true })
  })
  it('ignores names it does not know', () => {
    expect(parseWidePanels('["next","bogus",3]')).toEqual({ next: true, insights: false })
  })
  it('reads anything that is not a list as nothing shown', () => {
    for (const raw of ['1', '{}', '"next"', 'not json']) {
      expect(parseWidePanels(raw)).toEqual({ next: false, insights: false })
    }
  })
})
