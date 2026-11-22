import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Storybook's Vite builder starts from this config and adds its own plugins.
export default defineConfig({
  plugins: [tailwindcss(), viteReact()],
})
