// MDX for the chapters. A code fence that names a file gets its code from the repository at build time, so the
// guide cannot show code the project never had:
//
//   ```ts file=modules/planner/src/index.ts lines=1-12
//   ```
//
// `at=<sha>` reads another commit (the pinned one by default); `at=main` reads the working tree, for files that land
// on main with the guide itself, as the syllabus references do. A missing file or a line range past its end fails
// the build.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { PINNED_COMMIT } from '@lc/docs-contract'
import type { Options as MdxOptions } from '@mdx-js/rollup'
import rehypeShiki from '@shikijs/rehype'
import type { Code, Root } from 'mdast'
import type { ShikiTransformer } from 'shiki'
import { visit } from 'unist-util-visit'

const REPO_ROOT = resolve(import.meta.dirname, '../..')

export function parseMeta(meta: string | null | undefined): Map<string, string> {
  const entries = (meta ?? '').split(/\s+/).flatMap<[string, string]>((pair) => {
    const [key, value] = pair.split('=')
    return key && value ? [[key, value]] : []
  })
  return new Map(entries)
}

const cache = new Map<string, string>()

function readAt(path: string, at: string): string {
  const key = `${at}:${path}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const text =
    at === 'main'
      ? readFileSync(resolve(REPO_ROOT, path), 'utf8')
      : execFileSync('git', ['show', key], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  cache.set(key, text)
  return text
}

export function lineRange(spec: string | undefined, length: number): readonly [number, number] {
  if (!spec) return [1, length]
  const [from = Number.NaN, to = from] = spec.split('-').map(Number)
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > length)
    throw new Error(`lines=${spec} is outside 1–${length}`)
  return [from, to]
}

function remarkRepoCode() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code) => {
      const meta = parseMeta(node.meta)
      const file = meta.get('file')
      if (!file) return
      if (node.value.trim())
        throw new Error(`${file}: a fence with file= is filled from the repository; leave it empty`)
      const at = meta.get('at') ?? PINNED_COMMIT
      const lines = readAt(file, at).replace(/\n$/, '').split('\n')
      const [from, to] = lineRange(meta.get('lines'), lines.length)
      node.value = lines.slice(from - 1, to).join('\n')
      node.meta = `${node.meta ?? ''} from=${from}`
    })
  }
}

/** Puts the fence's file, commit and first line on <pre> and the real line number on every line. */
const repoCodeTransformer: ShikiTransformer = {
  name: 'lc-repo-code',
  pre(node) {
    // oxlint-disable-next-line no-underscore-dangle -- the name Shiki gives the fence's meta string
    const meta = parseMeta(this.options.meta?.__raw)
    const file = meta.get('file')
    if (!file) return
    node.properties['dataFile'] = file
    node.properties['dataAt'] = meta.get('at') ?? PINNED_COMMIT
    node.properties['dataFrom'] = meta.get('from') ?? '1'
    const lines = meta.get('lines')
    if (lines) node.properties['dataLines'] = lines
  },
  line(node, line) {
    // oxlint-disable-next-line no-underscore-dangle -- the name Shiki gives the fence's meta string
    const from = Number(parseMeta(this.options.meta?.__raw).get('from') ?? '1')
    node.properties['dataLine'] = String(from + line - 1)
  },
}

export const mdxOptions: MdxOptions = {
  remarkPlugins: [remarkRepoCode],
  rehypePlugins: [
    [
      rehypeShiki,
      {
        // The high-contrast pair: the plain GitHub themes fall below 4.5:1 on the code background for red, orange and
        // comment tokens.
        themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
        // Both colours become custom properties, and CSS picks one with light-dark(): the page and a host's theme
        // switch it without re-highlighting.
        defaultColor: false,
        transformers: [repoCodeTransformer],
      },
    ],
  ],
}
