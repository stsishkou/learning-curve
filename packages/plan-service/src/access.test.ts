import { parseUserId, type PlanId } from '@lc/plan-domain'
import { expect, test } from 'vitest'

import { accessOf, mustOwn } from './access'
import { DEFAULT_PLAN, LOCAL_ACTOR, LOCAL_OWNER, type Actor } from './actor'
import { failureMessage } from './failure'
import type { HostRules } from './ports/host'
import { fail, ok } from './result'

const host = (writable: boolean, publicPlan: PlanId | null = null): HostRules => ({
  writable: () => writable,
  publicPlan,
})
const mine = { id: DEFAULT_PLAN, owner: LOCAL_OWNER }
const someone: Actor = { kind: 'person', userId: parseUserId('someone') }
const nobody: Actor = { kind: 'anonymous' }

test.each([
  ['the owner on a writable host', LOCAL_ACTOR, host(true), ok('owner')],
  ['the owner on a read-only host', LOCAL_ACTOR, host(false), ok('reader')],
  ['someone else, public plan', someone, host(true, DEFAULT_PLAN), ok('reader')],
  ['someone else, private plan', someone, host(true), fail({ kind: 'not-found' })],
  ['signed out, public plan', nobody, host(true, DEFAULT_PLAN), ok('reader')],
  ['signed out, private plan', nobody, host(true), fail({ kind: 'signed-out' })],
])('%s', (_, actor, rules, expected) => expect(accessOf(actor, mine, rules)).toEqual(expected))

test('a reader may not write', () => {
  expect(mustOwn('reader')).toEqual(fail({ kind: 'forbidden' }))
  expect(failureMessage({ kind: 'forbidden' })).toBe('The plan is read-only here')
})
