import { nowMinsk } from '@lc/plan-domain'
import { useEffect } from 'react'

/** The tab icon: a calendar leaf with today's date in the plan's time zone. */
export function todayIcon(): string {
  const day = new Date(nowMinsk()).getUTCDate()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#fff"/><path d="M0 14A14 14 0 0 1 14 0h36a14 14 0 0 1 14 14v8H0z" fill="#e5484d"/><text x="32" y="54" text-anchor="middle" font-family="system-ui,sans-serif" font-size="34" font-weight="700" fill="#16203a">${day}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Keeps the icon on today's date in a tab that stays open past midnight. */
export function TodayIcon() {
  useEffect(() => {
    const timer = window.setInterval(() => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      const href = todayIcon()
      if (link && link.href !== href) link.href = href
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return null
}
