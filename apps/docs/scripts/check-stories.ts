// Fails when a chapter embeds or links a story the component stand does not have. Run after `pnpm --filter
// @lc/stand build`, which writes the stand's index of stories.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { CHAPTERS } from '@lc/docs-contract'

const file = resolve(import.meta.dirname, '../../stand/dist/index.json')
const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
const entries = typeof parsed === 'object' && parsed !== null && 'entries' in parsed ? parsed.entries : null
if (typeof entries !== 'object' || entries === null) throw new Error(`${file} has no entries`)

const known = new Set(Object.keys(entries))
const missing = CHAPTERS.flatMap((chapter) =>
  chapter.stories.filter((id) => !known.has(id)).map((id) => `${chapter.id}: ${id}`),
)
if (missing.length > 0) {
  console.error(`Stories the stand does not have:\n${missing.join('\n')}`)
  process.exit(1)
}
console.log(`stories: all ${CHAPTERS.reduce((sum, chapter) => sum + chapter.stories.length, 0)} exist in the stand`)
