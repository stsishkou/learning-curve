// Fails when a chapter points at something the repository does not have: a path missing at its commit, a line range
// past the end of the file, a commit that does not resolve, a decision whose choice is not one of its options.
// "No invented code" holds only as long as this passes.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CHAPTERS, PINNED_COMMIT } from '@lc/docs-contract'

import { PART_1 } from '../src/content/syllabus/part-1'
import { PART_2 } from '../src/content/syllabus/part-2'
import { PART_3 } from '../src/content/syllabus/part-3'
import { PART_4 } from '../src/content/syllabus/part-4'
import { PART_5 } from '../src/content/syllabus/part-5'
import type { FileRef, Syllabus } from '../src/content/syllabus/types'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const syllabi: readonly Syllabus[] = [...PART_1, ...PART_2, ...PART_3, ...PART_4, ...PART_5]
const problems: string[] = []

function git(args: readonly string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

// `main` names files this branch adds: they are checked in the working tree, which is what lands on main with them.
function contents(path: string, at: string): string | null {
  if (at === 'main') {
    const file = join(root, path)
    return existsSync(file) ? readFileSync(file, 'utf8') : null
  }
  return git(['show', `${at}:${path}`])
}

const commits = new Map<string, boolean>()
function commitExists(sha: string): boolean {
  const known = commits.get(sha)
  if (known !== undefined) return known
  const found = git(['cat-file', '-e', `${sha}^{commit}`]) !== null
  commits.set(sha, found)
  return found
}

function checkFile(where: string, file: FileRef): void {
  const at = file.at ?? PINNED_COMMIT
  const text = contents(file.path, at)
  if (text === null) {
    problems.push(`${where}: ${file.path} does not exist at ${at}`)
    return
  }
  if (!file.lines) return
  const [from, to] = file.lines
  const count = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length
  if (from < 1 || to < from || to > count)
    problems.push(`${where}: ${file.path} lines ${from}-${to} outside 1-${count} at ${at}`)
}

// A source with no commit may name a file this branch adds, so the working tree counts too.
function sourceFileExists(path: string, at: string | undefined): boolean {
  if (at !== undefined) return contents(path, at) !== null
  return contents(path, PINNED_COMMIT) !== null || contents(path, 'main') !== null
}

const ids = new Set<string>()
for (const syllabus of syllabi) {
  const chapter = syllabus.id
  if (ids.has(chapter)) problems.push(`${chapter}: written twice`)
  ids.add(chapter)

  for (const decision of syllabus.decisions) {
    if (!decision.options.some((option) => option.name === decision.chosen)) {
      problems.push(`${chapter}: "${decision.chosen}" is not an option of "${decision.question}"`)
    }
    for (const source of decision.sources) {
      if (source.kind === 'commit' && !commitExists(source.ref))
        problems.push(`${chapter}: source commit ${source.ref} not found`)
      if (source.kind === 'file' && !sourceFileExists(source.ref, source.at)) {
        problems.push(`${chapter}: source file ${source.ref} not found at ${source.at ?? 'the pinned commit or main'}`)
      }
      if (source.kind === 'doc' && !source.ref.startsWith('https://'))
        problems.push(`${chapter}: source ${source.ref} is not a URL`)
    }
  }
  for (const [index, step] of syllabus.steps.entries()) {
    const where = `${chapter} step ${index + 1}`
    for (const file of step.files) checkFile(where, file)
    if (step.commit && !commitExists(step.commit)) problems.push(`${where}: commit ${step.commit} not found`)
  }
  for (const [index, question] of syllabus.checkpoint.quiz.entries()) {
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) {
      problems.push(`${chapter} quiz ${index + 1}: answer ${question.answer} out of range`)
    }
  }
  for (const link of [
    ...syllabus.links,
    ...syllabus.concepts.flatMap((concept) => (concept.link ? [concept.link] : [])),
  ]) {
    if (!link.href.startsWith('https://')) problems.push(`${chapter}: link ${link.href} is not https`)
  }
}

for (const chapter of CHAPTERS) {
  if (!ids.has(chapter.id)) problems.push(`${chapter.id}: no syllabus`)
  for (const sha of chapter.commits)
    if (!commitExists(sha)) problems.push(`${chapter.id}: catalogue commit ${sha} not found`)
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} problem(s) in the syllabus`)
  process.exit(1)
}
console.log(`syllabus: ${syllabi.length} chapters, every reference resolves`)
