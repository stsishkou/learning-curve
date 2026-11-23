import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { CHAPTERS, DOCS_LOCALES } from '@lc/docs-contract'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { mdxOptions } from './mdx.config.ts'
import { sitePaths } from './src/site-paths.ts'

// Where the site is served: `/` locally, `/learning-curve/` on GitHub Pages. Pages are rendered at build time, so
// the origin is needed for absolute hreflang, canonical and sitemap URLs.
const base = process.env.DOCS_BASE ?? '/'
const origin = process.env.DOCS_ORIGIN ?? 'http://localhost:4310'
const stand = process.env.DOCS_STAND_URL ?? `${base}stand/`

const pages = sitePaths(
  DOCS_LOCALES,
  CHAPTERS.map((chapter) => chapter.id),
).map(({ path, alternates }) => ({
  path,
  sitemap: {
    alternateRefs: alternates.map(({ locale, path: href }) => ({
      hreflang: locale,
      href: origin + base + href.slice(1),
    })),
  },
}))

export default defineConfig(({ command }) => ({
  base,
  define: {
    'import.meta.env.VITE_DOCS_ORIGIN': JSON.stringify(origin),
    'import.meta.env.VITE_STAND_URL': JSON.stringify(command === 'serve' ? 'http://localhost:6006/' : stand),
  },
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      outputStructure: 'message-modules',
    }),
    { enforce: 'pre', ...mdx(mdxOptions) },
    tailwindcss(),
    tanstackStart({
      pages,
      // Crawling makes a link to a page that does not exist fail the build. The stand is a separate build that CI
      // copies next to the site afterwards, so links into it are not followed.
      prerender: { enabled: true, crawlLinks: true, failOnError: true, filter: ({ path }) => !path.startsWith(stand) },
      sitemap: { enabled: true, host: origin + base },
    }),
    viteReact({ include: /\.(mdx|tsx?)$/ }),
  ],
}))
