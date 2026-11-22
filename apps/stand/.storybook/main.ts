import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  // Stories live next to the components they show; the written pages live in this app.
  stories: [
    '../src/docs/*.mdx',
    '../../../packages/ui/src/**/*.stories.tsx',
    '../../../modules/*/src/**/*.stories.tsx',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  core: {
    disableTelemetry: true,
    disableWhatsNewNotifications: true,
  },
  // The page background comes from the theme tokens, switched in the toolbar.
  features: { backgrounds: false },
  typescript: {
    // react-docgen-typescript needs the TypeScript compiler API, which TypeScript 7 does not have.
    reactDocgen: 'react-docgen',
    check: false,
  },
}

export default config
