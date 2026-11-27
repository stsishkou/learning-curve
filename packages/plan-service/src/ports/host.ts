import type { PlanId } from '@lc/plan-domain'

/** How the host was started, the same for every caller: whether plans can be written here, and which one is public. */
export interface HostRules {
  /**
   * Whether the plans here can be written: false on a host started read-only (`PLAN_READONLY=1`) or whose store
   * cannot be written. Asked on every call, so a store that stops being writable while the host runs is noticed.
   */
  readonly writable: () => boolean
  /** The plan anyone may read, signed out included (`PUBLIC_PLAN_ID`); null when no plan is public. */
  readonly publicPlan: PlanId | null
}
