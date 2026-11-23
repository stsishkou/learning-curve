import type { CalendarProvider } from '@lc/plan-domain'

import { google } from '../google/kit'
import { outlook } from '../outlook/kit'
import type { CalendarKit } from './kit'

const KITS: Record<CalendarProvider, CalendarKit> = { google, outlook }

export const kitOf = (provider: CalendarProvider): CalendarKit => KITS[provider]
