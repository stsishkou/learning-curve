# @lc/docs-contract changelog

The contract between the docs remote (`lc_docs`) and its hosts. It follows semver:

- **major**: a host built against the old version can break (a removed or renamed method, event or id, a changed
  argument). The remote is deployed under a new path (`/remote/v2/`) next to the old one.
- **minor**: something new a host may use (a chapter, a feature id, an event, an optional option).
- **patch**: no change a host can see.

## 1.0.0

- `lc_docs/help` exports `{ version, createDocsHost }`.
- `DocsHost`: `open`, `close`, `update`, `on`, `destroy`.
- Events: `docs:ready`, `docs:open`, `docs:navigate`, `docs:close`, `docs:language-changed`, `docs:error`.
- Context: `locale` (`ru`, `en`, `es`), `theme` (`inherit`, `light`, `dark`), `tokens`, `featureId`, `siteUrl`.
- `docsPageUrl(siteUrl, locale, target)`: the static page for a target, for a host's fallback link.
- Catalog: 6 parts, 24 chapters, 46 feature ids, `featureOfPath`, `chaptersForFeature`, `sourceUrl`, `commitUrl`.
