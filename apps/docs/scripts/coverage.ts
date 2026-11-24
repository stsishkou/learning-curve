// Translation coverage: what each language has of its own. A page without a translation is served in English with a
// notice, so this is a to-do list rather than a check; `--json` prints the same numbers for a script to read.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { CHAPTERS, DOCS_LOCALES, DOCS_SOURCE_LOCALE, type DocsLocale } from '@lc/docs-contract'

import { PART_1 } from '../src/content/syllabus/part-1'
import { PART_2 } from '../src/content/syllabus/part-2'
import { PART_3 } from '../src/content/syllabus/part-3'
import { PART_4 } from '../src/content/syllabus/part-4'
import { PART_5 } from '../src/content/syllabus/part-5'
import { chapterTitle } from '../src/content/titles'

const ROOT = join(import.meta.dirname, '..')

interface Count {
  done: number
  total: number
  missing: readonly string[]
}

const count = <T extends string>(all: readonly T[], has: (item: T) => boolean): Count => {
  const missing = all.filter((item) => !has(item))
  return { done: all.length - missing.length, total: all.length, missing }
}

function messageKeys(locale: DocsLocale): Set<string> {
  const parsed: unknown = JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8'))
  if (typeof parsed !== 'object' || parsed === null) return new Set()
  return new Set(Object.keys(parsed).filter((key) => !key.startsWith('$')))
}

function proseSlugs(locale: DocsLocale): Set<string> {
  const dir = join(ROOT, 'src/content', locale)
  if (!existsSync(dir)) return new Set()
  return new Set(
    readdirSync(dir)
      .filter((file) => file.endsWith('.mdx'))
      .map((file) => file.slice(0, -'.mdx'.length)),
  )
}

const sourceMessages = [...messageKeys(DOCS_SOURCE_LOCALE)]
const sourceProse = [...proseSlugs(DOCS_SOURCE_LOCALE)].toSorted()
const chapterIds = CHAPTERS.map((chapter) => chapter.id)
// Syllabi are written once, in English; a reader of another language sees them with the fallback notice.
const withSyllabus = new Set([...PART_1, ...PART_2, ...PART_3, ...PART_4, ...PART_5].map((syllabus) => syllabus.id))

const report = DOCS_LOCALES.map((locale) => {
  const keys = messageKeys(locale)
  const prose = proseSlugs(locale)
  return {
    locale,
    interface: count(sourceMessages, (key) => keys.has(key)),
    titles: count(chapterIds, (id) => chapterTitle(id, locale).length > 0),
    syllabi: count(chapterIds, (id) => withSyllabus.has(id) && locale === DOCS_SOURCE_LOCALE),
    prose: count(sourceProse, (slug) => prose.has(slug)),
  }
})

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const rows = [
    ['Interface strings', 'interface'],
    ['Chapter and part titles', 'titles'],
    ['Chapter syllabi', 'syllabi'],
    ['Prose pages', 'prose'],
  ] as const
  const cell = (value: Count) => `${value.done}/${value.total}`.padStart(9)
  console.log(`Translation coverage (written in ${DOCS_SOURCE_LOCALE} first)\n`)
  console.log(`${''.padEnd(26)}${report.map(({ locale }) => locale.padStart(9)).join('')}`)
  for (const [label, key] of rows) console.log(`${label.padEnd(26)}${report.map((entry) => cell(entry[key])).join('')}`)
  for (const { locale, prose, interface: strings } of report) {
    if (strings.missing.length > 0) console.log(`\n${locale}: strings missing: ${strings.missing.join(', ')}`)
    if (prose.missing.length > 0) console.log(`\n${locale}: prose in English only: ${prose.missing.join(', ')}`)
  }
  console.log('\nSyllabi exist in English only; other languages show them with a notice.')
}
