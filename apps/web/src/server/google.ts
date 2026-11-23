import {
  acceptGoogle,
  canWrite,
  disconnectGoogle,
  googleStatus,
  rejectGoogle,
  saveGoogleClient,
  syncGoogle,
  type GoogleStatus,
} from '@lc/plan-data'
import { createServerFn } from '@tanstack/react-start'

const mustWrite = () => {
  if (!canWrite()) throw new Error('The plan is read-only here')
}

const proposalIds = (ids: unknown) => {
  if (!Array.isArray(ids) || !ids.length || !ids.every((id) => typeof id === 'string')) {
    throw new Error('Proposal ids are required')
  }
  return ids.filter((id): id is string => typeof id === 'string')
}

/** The state of the Google sync; the client secret and the tokens never leave the server. */
export const getGoogleStatus = createServerFn({ method: 'GET' }).handler((): GoogleStatus => googleStatus())

/** Keeps the person's own OAuth client, which the sign-in then uses. */
export const saveGoogleClientFn = createServerFn({ method: 'POST' })
  .validator((client: unknown) => {
    if (typeof client !== 'object' || client === null || !('id' in client) || !('secret' in client)) {
      throw new Error('A client id and secret are required')
    }
    const { id, secret } = client
    if (typeof id !== 'string' || typeof secret !== 'string' || !id.trim() || !secret.trim()) {
      throw new Error('A client id and secret are required')
    }
    if (id.length > 300 || secret.length > 300) throw new Error('The client id or secret is too long')
    return { id, secret }
  })
  .handler(({ data }): GoogleStatus => {
    mustWrite()
    saveGoogleClient(data.id, data.secret)
    return googleStatus()
  })

/** Reads what changed in Google and writes what the plan changed: one round, now. */
export const syncGoogleNow = createServerFn({ method: 'POST' }).handler(() => syncGoogle())

export const acceptGoogleProposals = createServerFn({ method: 'POST' })
  .validator(proposalIds)
  .handler(({ data }) => {
    mustWrite()
    return acceptGoogle(data)
  })

export const rejectGoogleProposals = createServerFn({ method: 'POST' })
  .validator(proposalIds)
  .handler(({ data }) => {
    mustWrite()
    return rejectGoogle(data)
  })

/** Signs out of Google; the calendars there stay, and connecting again picks them up. */
export const disconnectGoogleFn = createServerFn({ method: 'POST' }).handler(async (): Promise<GoogleStatus> => {
  mustWrite()
  await disconnectGoogle()
  return googleStatus()
})
