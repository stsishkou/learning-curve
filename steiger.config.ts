import fsd from '@feature-sliced/steiger-plugin'
import { defineConfig } from 'steiger'

// Feature-Sliced Design rules for the sources of every module (`steiger ./src` in modules/*).
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Slices used once stay separate on purpose: each module is laid out for growth, and its package
    // index (the module's public API) is the only consumer of its top slice.
    rules: { 'fsd/insignificant-slice': 'off' },
  },
])
