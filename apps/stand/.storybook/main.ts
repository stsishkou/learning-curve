import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  // Stories live next to the components they show; the written pages live in this app.
  stories: [
    '../src/docs/*.mdx',
    '../../../packages/ui/src/**/*.stories.tsx',
    '../../../modules/*/src/**/*.stories.tsx',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  // Where the "Story" panel links: the guide's dev server while developing; next to the stand when both are
  // published, unless STORYBOOK_DOCS_URL says otherwise.
  env: (variables, { configType }) => ({
    ...variables,
    STORYBOOK_DOCS_URL:
      process.env.STORYBOOK_DOCS_URL ?? (configType === 'DEVELOPMENT' ? 'http://localhost:3100/' : '../'),
  }),
  // The page background comes from the theme tokens, switched in the toolbar.
  features: { backgrounds: false },
  typescript: {
    // react-docgen-typescript needs the TypeScript compiler API, which TypeScript 7 does not have.
    reactDocgen: 'react-docgen',
    check: false,
  },
}

export default config
