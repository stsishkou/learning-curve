import { expect, test } from 'vitest'

import type { PlanChange } from './changes'
import { parseLocal } from './dates'
import { fixtureNow, fixturePlan, itemAt } from './fixtures'
import { isSession } from './progress'
import { previewUpdate, reportPreview } from './update'

const upcoming = fixturePlan.events.filter((e) => isSession(e) && !e.done && parseLocal(e.start) > fixtureNow)
const first = itemAt(upcoming)
const second = itemAt(upcoming, 1)
const finished = itemAt(fixturePlan.events.filter((e) => e.done))

const move = (uid: string, start: string, end: string): PlanChange => ({
  type: 'event.patch',
  uid,
  patch: { start, end },
})
const rules = (changes: PlanChange[]) => previewUpdate(fixturePlan, changes).warnings.map((w) => w.rule)

test('a move that keeps every rule has no warnings', () => {
  expect(rules([move(first.uid, '2026-12-03T20:00', '2026-12-03T21:00')])).toEqual([])
})

test('a session on a holiday is flagged', () => {
  expect(rules([move(first.uid, '2026-12-25T20:00', '2026-12-25T21:00')])).toEqual(['holiday'])
})

test('a session on a weekend is flagged', () => {
  expect(rules([move(first.uid, '2026-12-06T20:00', '2026-12-06T21:00')])).toEqual(['weekend'])
})

test('a session on top of another busy event is flagged once per pair', () => {
  const warnings = previewUpdate(fixturePlan, [
    move(first.uid, second.start, second.end),
    move(second.uid, second.start, second.end),
  ]).warnings
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({ rule: 'overlap', event: { uid: first.uid }, other: { uid: second.uid } })
})

test('a session after the deadline of its course is flagged', () => {
  const cert = itemAt(upcoming.filter((e) => e.calendar === 'certs'))
  expect(rules([move(cert.uid, '2027-01-05T20:00', '2027-01-05T21:00')])).toEqual(['deadline'])
})

test('changing or removing a finished session is flagged', () => {
  expect(rules([{ type: 'event.patch', uid: finished.uid, patch: { title: 'Renamed' } }])).toEqual(['done'])
  expect(rules([{ type: 'event.remove', uid: finished.uid }])).toEqual(['done'])
})

test('a rule the event already broke is not repeated when something else changes', () => {
  const onHoliday = previewUpdate(fixturePlan, [move(first.uid, '2026-12-25T20:00', '2026-12-25T21:00')]).after
  const renamed = previewUpdate(onHoliday, [{ type: 'event.patch', uid: first.uid, patch: { title: 'Renamed' } }])
  expect(renamed.warnings).toEqual([])
})

test('warnings reach a tool as words, and do not stop the update', () => {
  const report = reportPreview(previewUpdate(fixturePlan, [move(first.uid, '2026-12-25T20:00', '2026-12-25T21:00')]))
  expect(report.ok).toBe(true)
  expect(report.warnings).toEqual([
    { rule: 'holiday', uid: first.uid, message: `"${first.title}" (${first.uid}) falls on 2026-12-25, a holiday` },
  ])
})
