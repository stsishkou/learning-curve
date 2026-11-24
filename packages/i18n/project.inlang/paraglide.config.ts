import { defineConfig } from '@inlang/paraglide-js'

export default defineConfig({
  outdir: './src/paraglide',
  emitTsDeclarations: true,
  strategy: ['url', 'baseLocale'],
  urlPatterns: [
    {
      pattern: '/:path(.*)?',
      localized: [
        ['ru', '/ru/:path(.*)?'],
        ['en', '/en/:path(.*)?'],
        ['es', '/es/:path(.*)?'],
      ],
    },
  ],
  // The .ics and plan endpoints are language-neutral and their URLs are used as calendar subscriptions.
  routeStrategies: [{ match: '/api/:path(.*)?', exclude: true }],
})
