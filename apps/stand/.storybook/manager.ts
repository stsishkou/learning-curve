import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming/create'

import { registerStoryPanel } from './story-panel'

addons.setConfig({
  theme: create({ base: 'light', brandTitle: 'learning-curve · component stand' }),
})

registerStoryPanel()
