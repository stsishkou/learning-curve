import type { MenuItem, Shortcuts } from '@lc/ui'
import type { ReactNode } from 'react'

import type { Command } from '../../../features/command-palette'

/**
 * One thing the page can do, declared once: the command search, the `⋮` menu, the keyboard shortcuts and the
 * list of shortcuts are all read from the same list.
 */
export interface PlannerAction {
  id: string
  /** Section of the command search it is listed under */
  group: string
  label: string
  /** The text in the `⋮` menu, when the label is a sentence that explains the action */
  menuLabel?: string
  /** A plain key that runs it, shown wherever the action is listed */
  keys?: string | undefined
  icon?: ReactNode
  /** A count or state shown next to it in the menu */
  badge?: ReactNode
  /** Makes the menu row a switch */
  checked?: boolean
  disabled?: boolean
  /** Lists it in the `⋮` menu: always, or only on a narrow screen, where the toolbar has no room for its button */
  menu?: 'always' | 'narrow' | undefined
  /** false keeps it out of the command search */
  palette?: boolean
  run: () => void
}

export const toCommands = (actions: PlannerAction[]): Command[] =>
  actions.filter((a) => a.palette !== false).map(({ id, group, label, keys, run }) => ({ id, group, label, keys, run }))

/** One action as a row of a menu of its own: without the class that hides `⋮` rows on a wide screen. */
export const toMenuItem = (a: PlannerAction): MenuItem => ({
  id: a.id,
  icon: a.icon,
  label: a.menuLabel ?? a.label,
  keys: a.keys,
  badge: a.badge,
  checked: a.checked,
  disabled: a.disabled,
  run: a.run,
})

export const toMenuItems = (actions: PlannerAction[]): MenuItem[] =>
  actions
    .filter((a) => a.menu)
    .map((a) => ({ ...toMenuItem(a), className: a.menu === 'narrow' ? 'md:hidden' : undefined }))

export const toShortcuts = (actions: PlannerAction[]): Shortcuts =>
  Object.fromEntries(actions.flatMap((a) => (a.keys ? [[a.keys.toLowerCase(), a.run]] : [])))

export const toShortcutRows = (actions: PlannerAction[]) =>
  actions.flatMap((a) => (a.keys && a.palette !== false ? [{ keys: a.keys, label: a.label }] : []))
