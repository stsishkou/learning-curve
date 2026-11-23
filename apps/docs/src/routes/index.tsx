import { DOCS_DEFAULT_LOCALE, DOCS_LOCALES } from '@lc/docs-contract'
import { createFileRoute } from '@tanstack/react-router'

import { absolute } from '../app/head'
import { m } from '../paraglide/messages'

// The root has no language. A static host cannot redirect by Accept-Language, so the page picks the first of the
// browser's languages the guide has (Russian when none match, as in the root app) and replaces itself. The links stay
// for crawlers and for a reader without scripts.
const REDIRECT = `(function(){var s=${JSON.stringify(DOCS_LOCALES)},l=navigator.languages||[navigator.language],p=${JSON.stringify(DOCS_DEFAULT_LOCALE)};for(var i=0;i<l.length;i++){var c=String(l[i]).slice(0,2).toLowerCase();if(s.indexOf(c)>-1){p=c;break}}location.replace(${JSON.stringify(import.meta.env.BASE_URL)}+p+'/')})()`

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: m.meta_title({}, { locale: DOCS_DEFAULT_LOCALE }) },
      { name: 'robots', content: 'noindex, follow' },
    ],
    links: [
      ...DOCS_LOCALES.map((locale) => ({ rel: 'alternate', hrefLang: locale, href: absolute(`/${locale}/`) })),
      { rel: 'alternate', hrefLang: 'x-default', href: absolute('/') },
    ],
    scripts: [{ children: REDIRECT }],
  }),
  component: ChooseLanguage,
})

function ChooseLanguage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4">
      <ul className="flex w-full flex-col gap-3">
        {DOCS_LOCALES.map((locale) => (
          <li key={locale} lang={locale}>
            <a
              href={`${import.meta.env.BASE_URL}${locale}/`}
              hrefLang={locale}
              className="lc-card flex flex-col gap-1 p-4 hover:bg-surface-2"
            >
              <span className="font-display text-lg">{m.choose_language({}, { locale })}</span>
              <span className="text-muted">{m.site_tagline({}, { locale })}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
