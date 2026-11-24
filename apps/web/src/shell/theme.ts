export type Theme = 'system' | 'light' | 'dark'

const KEY = 'color-scheme'
const CONTENT: Record<Theme, string> = { system: 'light dark', light: 'light', dark: 'dark' }

/**
 * Runs in <head> before the first paint, so a pinned theme never flashes the other one.
 * The stylesheet reads the scheme from this <meta> (see @lc/ui theme.css).
 */
export const THEME_BOOT_SCRIPT = `try{document.querySelector('meta[name="color-scheme"]').content=localStorage.getItem(${JSON.stringify(KEY)})||'light dark'}catch(e){}`

/** Pins the color scheme or hands it back to the system, and remembers the choice in this browser. */
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
