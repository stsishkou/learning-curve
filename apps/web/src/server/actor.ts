import { LOCAL_ACTOR, type Actor } from '@lc/plan-service'

/** Who the request being served is made for. This host has no accounts, so it is always the plan's local owner. */
export const actorOf = (): Actor => LOCAL_ACTOR
