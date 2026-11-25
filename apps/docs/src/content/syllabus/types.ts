// The technical spine of every chapter, as data. The chapter page renders it in the order of the chapter template;
// a chapter's MDX prose, where it exists, tells the story around it.
import type { ChapterId } from '@lc/docs-contract'

/** `evidenced`: the repo records the reason (a commit body, a doc, a comment). `inferred`: our reconstruction. */
export type Evidence = 'evidenced' | 'inferred'

export interface Link {
  label: string
  href: string
}

/** A place in the repository. `at` is the commit the path and lines refer to; the pinned commit when omitted. */
export interface FileRef {
  path: string
  lines?: readonly [number, number] | undefined
  at?: string | undefined
  /** What to look at there, one sentence */
  note: string
}

export interface Source {
  kind: 'commit' | 'file' | 'doc'
  /** A short sha, a repository path, or the URL of official documentation */
  ref: string
  /** For a path: the commit it is read at; the pinned commit when omitted */
  at?: string | undefined
  note?: string | undefined
}

export interface Concept {
  term: string
  /** The mental model in 2–4 sentences, for a React engineer who has not used it */
  explanation: string
  link?: Link | undefined
}

export interface Alternative {
  name: string
  pros: readonly string[]
  cons: readonly string[]
}

export interface Decision {
  question: string
  options: readonly Alternative[]
  /** The `name` of the option taken */
  chosen: string
  why: string
  evidence: Evidence
  sources: readonly Source[]
}

export interface Step {
  title: string
  /** What to do and why, 2–5 sentences */
  detail: string
  files: readonly FileRef[]
  commands?: readonly string[] | undefined
  commit?: string | undefined
}

export interface QuizQuestion {
  question: string
  options: readonly string[]
  /** Index into `options` */
  answer: number
  explanation: string
}

export interface Checkpoint {
  commands: readonly string[]
  expect: readonly string[]
  quiz: readonly QuizQuestion[]
}

export interface Syllabus {
  id: ChapterId
  /** What the reader builds, 2–3 sentences */
  summary: string
  /** The state of the app when the chapter starts */
  whereWeAre: string
  /** Why something new is needed now */
  problem: string
  /** "After this chapter you can…" */
  outcomes: readonly string[]
  /** New technology, each explained where it is first needed */
  concepts: readonly Concept[]
  decisions: readonly Decision[]
  steps: readonly Step[]
  checkpoint: Checkpoint
  pitfalls: readonly string[]
  tradeoffs: readonly string[]
  /** Official documentation for everything the chapter introduces */
  links: readonly Link[]
  /** One line to the next chapter */
  next: string
}
