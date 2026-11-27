import { expect, test } from 'vitest'

import { isPlanId, isUserId, parsePlanId, parseUserId } from './ids'

test('a plan id is a short name of letters, digits, _ and -', () => {
  expect(isPlanId('default')).toBe(true)
  expect(isPlanId('plan-1a2b')).toBe(true)
  for (const bad of ['', '-x', '../x', 'a/b', 'x'.repeat(65)]) expect(isPlanId(bad)).toBe(false)
  expect(parsePlanId('default')).toBe('default')
  expect(() => parsePlanId(42)).toThrow('Not a plan id')
})

test('a user id has the same shape', () => {
  expect(isUserId('local')).toBe(true)
  expect(isUserId('a/b')).toBe(false)
  expect(parseUserId('local')).toBe('local')
  expect(() => parseUserId('')).toThrow('Not a user id')
})
