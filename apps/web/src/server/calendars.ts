import {
  acceptProposals,
  calendarStatus,
  calendarStatuses,
  canWrite,
  disconnectCalendar,
  rejectProposals,
  saveCalendarClient,
  syncCalendar,
  type CalendarStatus,
} from '@lc/plan-data'
import { isCalendarProvider, type CalendarProvider } from '@lc/plan-domain'
import { createServerFn } from '@tanstack/react-start'

const mustWrite = () => {
  if (!canWrite()) throw new Error('The plan is read-only here')
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function providerOf(value: unknown): CalendarProvider {
  if (!isCalendarProvider(value)) throw new Error('Unknown calendar app')
  return value
}

const withIds = (input: unknown) => {
  const ids = isRecord(input) ? input.ids : undefined
  if (!Array.isArray(ids) || !ids.length || !ids.every((id) => typeof id === 'string')) {
    throw new Error('Proposal ids are required')
  }
  return {
    provider: providerOf(isRecord(input) ? input.provider : undefined),
    ids: ids.filter((id): id is string => typeof id === 'string'),
  }
}

/** How the plan is kept in each calendar app; the client secrets and the tokens never leave the server. */
export const getCalendarStatuses = createServerFn({ method: 'GET' }).handler((): CalendarStatus[] => calendarStatuses())

/** Keeps the person's own OAuth client for a calendar app, which its sign-in then uses. */
export const saveCalendarClientFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const { provider, id, secret } = isRecord(input) ? input : {}
    if (typeof id !== 'string' || typeof secret !== 'string' || !id.trim() || !secret.trim()) {
      throw new Error('A client id and secret are required')
    }
    if (id.length > 300 || secret.length > 300) throw new Error('The client id or secret is too long')
    return { provider: providerOf(provider), id, secret }
  })
  .handler(({ data }): CalendarStatus => {
    mustWrite()
    saveCalendarClient(data.provider, data.id, data.secret)
    return calendarStatus(data.provider)
  })

/** Reads what changed in a calendar app and writes what the plan changed: one round, now. */
export const syncCalendarNow = createServerFn({ method: 'POST' })
  .validator(providerOf)
  .handler(({ data }) => syncCalendar(data))

export const acceptCalendarProposals = createServerFn({ method: 'POST' })
  .validator(withIds)
  .handler(({ data }) => {
    mustWrite()
    return acceptProposals(data.provider, data.ids)
  })

export const rejectCalendarProposals = createServerFn({ method: 'POST' })
  .validator(withIds)
  .handler(({ data }) => {
    mustWrite()
    return rejectProposals(data.provider, data.ids)
  })

/** Signs out of a calendar app; its calendars stay there, and connecting again picks them up. */
export const disconnectCalendarFn = createServerFn({ method: 'POST' })
  .validator(providerOf)
  .handler(async ({ data }): Promise<CalendarStatus> => {
    mustWrite()
    await disconnectCalendar(data)
    return calendarStatus(data)
  })
