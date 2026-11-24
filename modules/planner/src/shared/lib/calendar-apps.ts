import { m } from '@lc/i18n/messages'
import type { CalendarProvider } from '@lc/plan-domain'

const NAMES: Record<CalendarProvider, () => string> = { google: m.sync_app_google, outlook: m.sync_app_outlook }
const TITLES: Record<CalendarProvider, () => string> = { google: m.google_calendar, outlook: m.outlook_calendar }

/** A calendar app's name inside a sentence: "From Outlook: …". */
export const appName = (provider: CalendarProvider) => NAMES[provider]()

/** A calendar app's name on its own, as a title. */
export const appTitle = (provider: CalendarProvider) => TITLES[provider]()
