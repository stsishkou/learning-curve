import { Tooltips } from '@lc/ui'
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks'
import type { Decorator, Preview } from '@storybook/react-vite'
import { Fragment, useSyncExternalStore, type PropsWithChildren } from 'react'
import { GLOBALS_UPDATED, SET_GLOBALS } from 'storybook/internal/core-events'
import { addons } from 'storybook/preview-api'
import { themes } from 'storybook/theming'

import { ComponentPage } from '../src/docs/page'
import { applyGlobals, askPage, getLocale, getTheme, subscribe } from '../src/globals'
import { Reopenable } from '../src/reopen'

// oxlint-disable-next-line import/no-unassigned-import -- a stylesheet is imported for its effect
import '../src/styles.css'

const channel = addons.getChannel()

// Written pages have no story, so no decorator runs on them: they follow the toolbar through the channel.
// Only this preview's own events count. A framed story's preview posts its events to this window as well,
// and the channel marks what arrived from another window with `source`.
function onGlobals(this: { source?: string }, { globals }: { globals: Record<string, unknown> }) {
  if (!this.source) applyGlobals(globals)
}
channel.on(SET_GLOBALS, onGlobals)
channel.on(GLOBALS_UPDATED, onGlobals)

// Message functions are plain calls, not subscriptions: a new language needs a fresh render of the whole story.
function Localized({ children }: PropsWithChildren) {
  const locale = useSyncExternalStore(subscribe, getLocale)
  return <Fragment key={locale}>{children}</Fragment>
}

const withToolbar: Decorator = (Story, { globals, parameters }) => {
  applyGlobals(globals)
  askPage()
  return (
    <Localized>
      <Tooltips />
      {parameters.dialog ? (
        <Reopenable>
          <Story />
        </Reopenable>
      ) : (
        <Story />
      )}
    </Localized>
  )
}

function ThemedDocs(props: PropsWithChildren<DocsContainerProps>) {
  const theme = useSyncExternalStore(subscribe, getTheme)
  return <DocsContainer {...props} theme={theme === 'dark' ? themes.dark : themes.light} />
}

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [withToolbar],
  // `pnpm run stand:test` runs the stories a second time in the dark theme through this variable.
  initialGlobals: { theme: import.meta.env.VITE_STAND_THEME === 'dark' ? 'dark' : 'light', locale: 'ru' },
  globalTypes: {
    theme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        dynamicTitle: true,
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
      },
    },
    locale: {
      description: 'Interface language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        dynamicTitle: true,
        items: [
          { value: 'ru', title: 'Русский', right: 'RU' },
          { value: 'en', title: 'English', right: 'EN' },
          { value: 'es', title: 'Español', right: 'ES' },
        ],
      },
    },
  },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    // An accessibility violation fails the story's test (`pnpm run stand:test`), not only the panel.
    a11y: { test: 'error' },
    docs: { container: ThemedDocs, page: ComponentPage },
    options: {
      storySort: {
        order: [
          'Introduction',
          'Design tokens',
          'UI kit',
          'Planner',
          ['Page', 'Widgets', 'Features'],
          'Dashboard',
          ['Page', 'Widgets'],
          'Calendar export',
        ],
      },
    },
  },
}

export default preview
