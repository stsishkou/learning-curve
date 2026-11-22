import { m } from '#/paraglide/messages.js'
import { getLocale, locales, setLocale } from '#/paraglide/runtime.js'

import { Segmented } from './ui'

/** Switching reloads the page on the localized URL, so the server renders the new language. */
export function LanguageSwitcher() {
  return (
    <Segmented
      label={m.language()}
      value={getLocale()}
      options={locales.map((locale) => ({ value: locale, label: locale.toUpperCase(), lang: locale }))}
      onChange={(locale) => void setLocale(locale)}
    />
  )
}
