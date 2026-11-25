import { defineConfig } from '@inlang/paraglide-js'

// Every call passes its locale (`m.key({}, { locale })`): the same components render inside a host page whose
// language belongs to the host, so no ambient strategy may decide it.
export default defineConfig({
  outdir: './src/paraglide',
  emitTsDeclarations: true,
  strategy: ['baseLocale'],
})
