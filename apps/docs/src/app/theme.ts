// The same switch as the planner's (apps/web/src/shell/theme.ts): the stylesheet reads the scheme from
// <meta name="color-scheme">, and a script in <head> applies the stored choice before the first paint.
export type Theme = 'system' | 'light' | 'dark'

const KEY = 'color-scheme'
const CONTENT: Record<Theme, string> = { system: 'light dark', light: 'light', dark: 'dark' }

export const THEME_BOOT_SCRIPT = `try{document.querySelector('meta[name="color-scheme"]').content=localStorage.getItem(${JSON.stringify(KEY)})||'light dark'}catch(e){}`

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function setTheme(theme: Theme) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
  if (meta) meta.content = CONTENT[theme]
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // storage unavailable: the choice lasts until the page is closed
  }
}
