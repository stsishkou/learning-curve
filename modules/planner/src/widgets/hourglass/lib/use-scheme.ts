import { useEffect, useState } from 'react'

/**
 * A number that changes whenever the colour scheme may have: the system turned dark or light, or the app's theme
 * switch rewrote `<meta name="color-scheme">`. Colours read from the theme are read again when it changes.
 */
export function useScheme(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    system.addEventListener('change', bump)
    const observer = new MutationObserver(bump)
    const meta = document.querySelector('meta[name="color-scheme"]')
    if (meta) observer.observe(meta, { attributes: true, attributeFilter: ['content'] })
    return () => {
      system.removeEventListener('change', bump)
      observer.disconnect()
    }
  }, [])
  return version
}
