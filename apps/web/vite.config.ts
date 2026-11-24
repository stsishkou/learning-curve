import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // HiGHS stays a package on disk, in the server build too: its loader finds highs.wasm next to itself.
  ssr: { external: ['highs'] },
  plugins: [
    // Recompiles the messages when a translation changes, so dev picks it up without a restart.
    paraglideVitePlugin({
      project: '../../packages/i18n/project.inlang',
      outdir: '../../packages/i18n/src/paraglide',
      // Real files, as the CLI writes: the plugin's default leaves stubs that only this Vite server can
      // resolve, and the component stand and the type check read the same folder without the plugin.
      outputStructure: 'message-modules',
    }),
    tailwindcss(),
    // The whole package is copied: the tracer cannot see highs.wasm behind its loader's `new URL`.
    nitro({ rollupConfig: { external: [/^@sentry\//, /^highs/] }, traceDeps: ['highs*'] }),

    tanstackStart(),
    viteReact(),
  ],
})

export default config
