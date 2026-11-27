# @lc/stand

The component stand: a Storybook with every UI kit component, planner widget and feature on fixture data, and the
documentation pages (introduction, tokens, the story map). It is also where the visual states are checked.

- `.storybook/` and `src/`: the configuration, the theme, and `src/docs/` with the MDX pages. The stories themselves
  sit beside the code they show, in `packages/ui` and `modules/*`.
- `src/story/links.ts`: where each story's source and chapter live.

May import: the modules, `@lc/plan-domain` (and its `./fixtures`), `@lc/i18n`, `@lc/ui`, `@lc/docs-contract`. Never
`@lc/plan-data`, `@lc/plan-service` or `@lc/plan-content`: a story gets its data from the fixtures.

Run `pnpm run stand` (port 6006) and `pnpm run stand:build`. Tested with `pnpm run stand:test` (Vitest runs every story
in a browser, in the light and the dark theme: it must render, its `play` function must pass and axe must find no
violation).

Owns no data files.
