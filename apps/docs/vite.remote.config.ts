// The same chapters as a Module Federation remote. It exposes one module, `lc_docs/help` (src/remote/help.tsx), and
// is built next to the site under remote/v<major>/, so a breaking contract change ships beside the old remote
// instead of over it (packages/docs-contract/CHANGELOG.md).
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { DOCS_CONTRACT, DOCS_REMOTE_NAME } from '@lc/docs-contract'
import mdx from '@mdx-js/rollup'
import { federation } from '@module-federation/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { mdxOptions } from './mdx.config.ts'

const major = DOCS_CONTRACT.split('.')[0] ?? '1'
const REACT = { singleton: true, requiredVersion: '^19.3.0' }

export default defineConfig({
  // Chunks are requested relative to the manifest the host loaded (`publicPath: 'auto'`), so one build serves any
  // origin and path: nothing about the environment is baked in.
  base: './',
  define: {
    'import.meta.env.VITE_DOCS_ORIGIN': JSON.stringify(''),
    'import.meta.env.VITE_STAND_URL': JSON.stringify(''),
  },
  build: {
    outDir: `dist/client/remote/v${major}`,
    emptyOutDir: true,
    target: 'es2022',
    rolldownOptions: { input: 'remote.html' },
  },
  plugins: [
    paraglideVitePlugin({ project: './project.inlang', outdir: './src/paraglide', outputStructure: 'message-modules' }),
    { enforce: 'pre', ...mdx(mdxOptions) },
    tailwindcss(),
    viteReact({ include: /\.(mdx|tsx?)$/ }),
    federation({
      name: DOCS_REMOTE_NAME,
      // Hashed: GitHub Pages caches every file for ten minutes, and the manifest is the only fixed name a host asks for.
      filename: 'remoteEntry-[hash].js',
      exposes: { './help': './src/remote/help.tsx' },
      shared: {
        react: REACT,
        'react-dom': REACT,
        'react/jsx-runtime': REACT,
        'react-dom/client': REACT,
      },
      manifest: true,
      publicPath: 'auto',
      dts: false,
    }),
  ],
})
