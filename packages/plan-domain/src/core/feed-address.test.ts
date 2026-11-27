import { expect, test } from 'vitest'

import { feedAddress } from './feed-address'

test('webcal is https, anything else is refused', () => {
  expect(feedAddress(' webcal://example.com/a.ics ')).toBe('https://example.com/a.ics')
  expect(feedAddress('http://example.com/a.ics')).toBeNull()
  expect(feedAddress('not a url')).toBeNull()
})
