import { defineConfig, devices } from '@playwright/test'

// Both sides run from their production builds: the guide from its static files with GitHub Pages' headers, the host
// from `vite preview`. Build them first (`pnpm exec nx run @lc/docs-harness:test` does).
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'http://localhost:4320', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @lc/docs run preview',
      url: `http://localhost:4310${process.env.DOCS_BASE ?? '/'}ru/`,
      reuseExistingServer: !process.env.CI,
    },
    { command: 'pnpm exec vite preview', url: 'http://localhost:4320/', reuseExistingServer: !process.env.CI },
  ],
})
