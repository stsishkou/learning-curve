import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// No federation plugin: like the planner, this host loads the remote with the runtime API only.
export default defineConfig({
  plugins: [tailwindcss(), viteReact()],
  preview: { port: 4320, strictPort: true },
  server: { port: 4320, strictPort: true },
})
