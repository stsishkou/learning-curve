import { DAY } from '@lc/plan-domain'
import { fixtureBase } from '@lc/plan-domain/fixtures'
import { describe, expect, test } from 'vitest'

import {
  parseBusyAddress,
  parseBusyWindow,
  parseChanges,
  parseCursor,
  parseFileRef,
  parseFileRename,
  parseFileSave,
  parseRebalanceInput,
} from './parse'

describe('parseChanges', () => {
  test.each([[[]], ['plan.rename'], [null], [{ type: 'plan.rename', title: 'X' }]])(
    'refuses %j: Changes are required',
    (input) => expect(() => parseChanges(input)).toThrow('Changes are required'),
  )

  test('reads each change, and refuses one that is not a change with its own message', () => {
    expect(parseChanges([{ type: 'plan.rename', title: ' X ' }])).toEqual([{ type: 'plan.rename', title: 'X' }])
    expect(() => parseChanges([{ type: 'plan.rename' }])).toThrow('title is required')
  })
})

describe('parseCursor', () => {
  test.each([[-1], [1.5], ['2'], [null]])('refuses %j: A step is required', (input) =>
    expect(() => parseCursor(input)).toThrow('A step is required'),
  )

  test('reads a step', () => {
    expect(parseCursor(0)).toBe(0)
    expect(parseCursor(3)).toBe(3)
  })
})

describe('parseBusyWindow', () => {
  test.each([[null], [3], [{ from: 0 }], [{ to: 1 }]])('refuses %j: A window is required', (input) =>
    expect(() => parseBusyWindow(input)).toThrow('A window is required'),
  )

  test.each([[{ from: 5, to: 5 }], [{ from: 0, to: 62 * DAY + 1 }], [{ from: '0', to: 1 }], [{ from: 2, to: 1 }]])(
    'refuses %j: A window of at most two months is required',
    (input) => expect(() => parseBusyWindow(input)).toThrow('A window of at most two months is required'),
  )

  test('reads a window of up to 62 days', () => {
    expect(parseBusyWindow({ from: 0, to: 62 * DAY })).toEqual({ from: 0, to: 62 * DAY })
  })
})

describe('parseBusyAddress', () => {
  test.each([['http://cal.example/a.ics'], ['not an address'], [42], [undefined]])(
    'refuses %j: An https or webcal address of an iCal file is required',
    (input) => expect(() => parseBusyAddress(input)).toThrow('An https or webcal address of an iCal file is required'),
  )

  test('reads an address as it is fetched, and null as forgetting it', () => {
    expect(parseBusyAddress(' webcal://cal.example/a.ics ')).toBe('https://cal.example/a.ics')
    expect(parseBusyAddress('https://cal.example/a.ics')).toBe('https://cal.example/a.ics')
    expect(parseBusyAddress(null)).toBeNull()
  })
})

describe('the library parsers', () => {
  test('a file is named by its id, with a version or the latest', () => {
    expect(() => parseFileRef('plan-a')).toThrow('An object is required')
    expect(() => parseFileRef({ version: 'v-1' })).toThrow('id is required')
    expect(() => parseFileRef({ id: '  ' })).toThrow('id is required')
    expect(parseFileRef({ id: ' plan-a ', version: 'v-1' })).toEqual({ id: 'plan-a', version: 'v-1' })
    expect(parseFileRef({ id: 'plan-a', version: '' })).toEqual({ id: 'plan-a', version: undefined })
  })

  test('a save needs a plan and a name; the id and the note are optional', () => {
    expect(() => parseFileSave(null)).toThrow('An object is required')
    expect(() => parseFileSave({ name: 'A', plan: { meta: {} } })).toThrow('A plan is required')
    expect(() => parseFileSave({ name: ' ', plan: fixtureBase })).toThrow('name is required')
    expect(parseFileSave({ name: ' A ', plan: fixtureBase })).toEqual({
      id: undefined,
      name: 'A',
      plan: fixtureBase,
      note: undefined,
    })
    expect(parseFileSave({ id: 'plan-a', name: 'A', plan: fixtureBase, note: 'n' })).toEqual({
      id: 'plan-a',
      name: 'A',
      plan: fixtureBase,
      note: 'n',
    })
  })

  test('a rename needs the id and the new name', () => {
    expect(() => parseFileRename([])).toThrow('id is required')
    expect(() => parseFileRename({ id: 'plan-a' })).toThrow('name is required')
    expect(parseFileRename({ id: 'plan-a', name: ' B ' })).toEqual({ id: 'plan-a', name: 'B' })
  })
})

describe('parseRebalanceInput', () => {
  test.each([[null], [{}], [{ plan: { meta: {} } }]])('refuses %j: A plan is required', (input) =>
    expect(() => parseRebalanceInput(input)).toThrow('A plan is required'),
  )

  test('checks the request against the plan', () => {
    expect(() => parseRebalanceInput({ plan: fixtureBase, request: { calendar: 'nope' } })).toThrow(
      'Unknown calendar "nope"',
    )
    expect(() => parseRebalanceInput({ plan: fixtureBase })).toThrow('The request must be an object')
    const { plan, request } = parseRebalanceInput({
      plan: fixtureBase,
      request: { calendar: 'certs', from: '2026-12-07', target: { mode: 'rhythm', perDay: 1 } },
    })
    expect(plan).toEqual(fixtureBase)
    expect(request).toMatchObject({ calendar: 'certs', from: '2026-12-07', overBudget: false })
  })
})
