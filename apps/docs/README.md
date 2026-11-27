# @lc/docs — how learning-curve was built

The story of this repository from an empty folder, for a React engineer: 24 chapters in six parts, each with its
problem, the options weighed, the decision (marked as evidenced by the repository or inferred by us), the new
technology, the implementation with real files and commits, a checkpoint, and the trade-offs. Russian, English and
Spanish.

Two products from one codebase:

- **A static site.** TanStack Start, pre-rendered: every page of every language is an HTML file, with `hreflang`,
  a sitemap and a Pagefind search index. Served from any static host; this repository deploys it to GitHub Pages.
- **A Module Federation remote** (`lc_docs`, exposing `./help`) that a React host loads at run time and shows in a
  drawer. The planner (`apps/web`) does, through `@lc/remote-host/docs`. The host decides the language, theme and screen;
  the contract between them is `@lc/docs-contract`.

The guide's own chapters 23 and 24 explain both in depth. The integration guide (`/<locale>/integration/`) is the
how-to for a host.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter @lc/docs dev` | The site on http://localhost:3100 with hot reload |
| `pnpm --filter @lc/docs dev:remote` | Rebuilds the remote on change (serve it with `preview`) |
| `pnpm --filter @lc/docs build` | The site, the remote under `dist/client/remote/v1/`, and the search index |
| `pnpm --filter @lc/docs preview` | Serves `dist/client` on http://localhost:4310 with GitHub Pages' headers |
| `pnpm --filter @lc/docs test` | Checks every file, line range and commit the chapters cite |
| `pnpm --filter @lc/docs coverage` | What each language has of its own (`--json` for a script) |
| `pnpm docs:test` | Builds the guide and the harness and runs the Playwright tests of the remote in a host |

`pnpm run check` at the root covers the type check, Oxlint, Steiger, the translation check and formatting.

The build is not cached by Nx on purpose: code excerpts are read from git and from files anywhere in the repository,
and the base path comes from the environment, none of which Nx would see as inputs.

## Configuration

| Variable | Read by | Default |
| --- | --- | --- |
| `DOCS_BASE` | the site build: the path it is served under | `/` (CI: `/<repo>/`) |
| `DOCS_ORIGIN` | the site build: absolute URLs in `hreflang`, canonical links and the sitemap | `http://localhost:4310` |
| `DOCS_STAND_URL` | the site build: where the component stand is | `<base>stand/` |
| `DOCS_REMOTE_URL` | the planner's server, at run time: the remote's `mf-manifest.json` | dev: `http://localhost:4310/remote/v1/mf-manifest.json`; prod: none, no docs button |
| `DOCS_SITE_URL` | the planner's server, at run time: the site, for the fallback link | two folders above the manifest |
| `STORYBOOK_DOCS_URL` | the component stand's build: where its Story panel links | dev: `http://localhost:3100/`; build: `../` |

The remote needs none: its chunks are resolved from wherever its manifest was loaded (`publicPath: 'auto'`).

## Layout

```
src/
  app/          site shell: header, search, theme, the environment context both modes share
  components/   chapter page, decision cards, code blocks, walkthroughs, the hosting matrix…
  content/
    syllabus/   the chapters as typed data (part-1.ts … part-5.ts); types.ts is the schema
    en/ ru/ es/ prose per page as MDX: <chapter id>.mdx, integration.mdx
    titles.ts   chapter and part titles in Russian and Spanish (English is in the contract)
    hosting.ts  the hosting comparison of chapter 22
  remote/       the federation module: createDocsHost, shadow root, memory router, drawer
  routes/       the site's file routes: /$locale/, chapters, decisions, glossary, integration
  styles/       site.css (the site), remote.css (adopted by the shadow root), content.css (both)
scripts/        check-syllabus.ts, check-stories.ts, coverage.ts, serve.ts
mdx.config.ts   fills code fences from git
vite.config.ts  the site; vite.remote.config.ts: the remote
```

`apps/docs` may import only `@lc/docs-contract` and `@lc/ui` (enforced by Oxlint). It never imports the planner's
code: chapters show it by reading git.

## Writing a chapter

1. **The catalogue** (`packages/docs-contract/src/catalog.ts`): the chapter's id, part, number, title, minutes, the
   commits it covers, the feature slices it built and the stories it cites. Hosts read this, so a new chapter is a
   minor version of the contract.
2. **The syllabus** (`src/content/syllabus/part-N.ts`): the spine every chapter page renders in the order of the
   template. Mark a decision `evidenced` only when the repository records the reason (a commit body, a document, a
   comment) and cite it; otherwise `inferred`, and say so in the text. File references take `at` for a commit other
   than the pinned one, and `at: 'main'` for files that land with the guide.
3. **The prose** (`src/content/en/<id>.mdx`, optional): the story around the code, rendered under "The story". Use
   `###` headings. MDX may use, without importing: `Walkthrough` + `WalkStep`, `ChapterLink`, `HostingMatrix`,
   `ArchitectureMap`, `StoryEmbed` / `StoryList` and `Terminal`.
4. **Translations**: the title in `titles.ts` (the type requires it), then `ru/<id>.mdx` and `es/<id>.mdx` when they
   exist. Until then the page shows the English prose with a notice.
5. Run `pnpm --filter @lc/docs test`, `pnpm --filter @lc/docs build` and, if the chapter cites stories, build the
   stand and run `pnpm --filter @lc/docs exec tsx scripts/check-stories.ts`.

### Code is never written by hand

A fence that names a file is filled from the repository when the site is built:

````md
```ts file=apps/web/vite.config.ts lines=8-30
```
````

- `file` is a path from the repository root; `lines` a range (the whole file when omitted).
- `at` is a commit; the pinned commit (`PINNED_COMMIT` in the contract) when omitted. `at=main` reads the working
  tree and links to `main`, for files that land on main with the guide.
- The fence must be empty. A missing path or a range past the end of the file fails the build.
- Every line keeps its real number, and the block links to those lines on GitHub at that commit.

A `Walkthrough` holds one such fence and `WalkStep`s whose `lines` use the file's real numbers; the step in the
middle of the screen highlights its lines. Excerpts are never translated.

Links between chapters use `<ChapterLink id="…" />`: a router link, so it moves only the drawer when embedded, and an
unknown id fails the build.

## Languages

- Interface strings: `messages/{ru,en,es}.json`, compiled by Paraglide into `src/paraglide/` (generated, not edited).
  `pnpm --filter @lc/docs check:i18n` finds missing and unused keys.
- `/` has no language: it opens the first of the browser's languages the guide has, and Russian when none match, as
  the planner does. Chapters are written in English first.
- Routes are prefixed (`/ru/`, `/en/`, `/es/`); each page names its translations with `hreflang`, and the sitemap
  lists them.
- `coverage` reports what is still English-only. At the time of writing that is the syllabus of every chapter in
  Russian and Spanish; interface strings, titles and the prose pages exist in all three languages.

## The remote

- **Contract**: `packages/docs-contract`, semver, with `CHANGELOG.md`. A major version is built into
  `remote/v<major>/` beside the old one.
- **Isolation**: one `<lc-docs>` element with a shadow root and adopted stylesheets; `:host { all: initial }` keeps the
  host's inherited styles out, `@property` rules are hoisted to the document (they do nothing inside a shadow tree),
  and key events stop at the shadow root. `destroy()` removes everything.
- **Routing**: a memory router with the site's paths; the host's URL never changes.
- **Sharing**: React, ReactDOM, `react/jsx-runtime` and `react-dom/client` as singletons within `^19.3.0`.
- **Proof**: `apps/docs-harness` is a host with hostile CSS and window shortcuts; its Playwright tests check lazy
  loading, a single React, language and theme, links, styles and keys both ways, and the fallback.

## Deployment

`.github/workflows/docs.yml` runs on every pull request and on pushes to `main` and `develop`: the reference check,
the contract tests, the site and remote build, the stand build with the story check, and the harness tests. On
`main` it copies the stand to `dist/client/stand/` and deploys `dist/client` to GitHub Pages.

GitHub Pages sends `Access-Control-Allow-Origin: *` and `max-age=600` on every file, and nothing else can be set. The
remote copes: chunks and `remoteEntry-[hash].js` carry content hashes, and hosts request `mf-manifest.json` with a
query that changes on every load. Chapter 22 compares the alternatives, and `docs/deployment-research.md` has the
sources.
