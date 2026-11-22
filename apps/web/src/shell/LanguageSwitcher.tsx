import { m } from '@lc/i18n/messages'
import { getLocale, locales, setLocale } from '@lc/i18n/runtime'
import { Segmented } from '@lc/ui'

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
