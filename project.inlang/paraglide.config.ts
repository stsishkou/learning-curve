import { defineConfig } from '@inlang/paraglide-js'

export default defineConfig({
  outdir: './src/paraglide',
  emitTsDeclarations: true,
  strategy: ['url', 'baseLocale'],
  // Russian keeps the unprefixed URLs so existing links and /api routes stay valid.
  urlPatterns: [
    {
      pattern: '/:path(.*)?',
      localized: [
        ['en', '/en/:path(.*)?'],
        ['es', '/es/:path(.*)?'],
        ['ru', '/:path(.*)?'],
      ],
    },
  ],
})
