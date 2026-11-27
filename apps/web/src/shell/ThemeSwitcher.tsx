import { m } from '@lc/i18n/messages'
import { Segmented } from '@lc/ui'

import { setTheme, useTheme } from './theme'

/** The color scheme: the system's, or one of the two pinned in this browser. */
export function ThemeSwitcher() {
  return (
    <Segmented
      label={m.theme()}
      value={useTheme()}
      options={[
        { value: 'system', label: m.theme_system() },
        { value: 'light', label: m.theme_light() },
        { value: 'dark', label: m.theme_dark() },
      ]}
      onChange={setTheme}
    />
  )
}
