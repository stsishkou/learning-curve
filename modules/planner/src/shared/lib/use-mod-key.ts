import { useEffect, useState } from 'react'

/** The label of the platform's command key: `⌘` on Apple devices, `Ctrl` elsewhere. `Ctrl` until hydration. */
export function useModKey(): string {
  const [key, setKey] = useState('Ctrl')
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setKey('⌘')
  }, [])
  return key
}
