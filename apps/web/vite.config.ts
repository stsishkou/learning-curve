import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // Recompiles the messages when a translation changes, so dev picks it up without a restart.
    paraglideVitePlugin({
      project: '../../packages/i18n/project.inlang',
      outdir: '../../packages/i18n/src/paraglide',
    }),
    tailwindcss(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),

    tanstackStart(),
    viteReact(),
  ],
})

export default config
