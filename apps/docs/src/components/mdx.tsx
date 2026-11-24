import type { MDXComponents } from 'mdx/types'

import { ArchitectureMap } from './ArchitectureMap'
import { ChapterLink } from './ChapterLink'
import { CodeBlock } from './CodeBlock'
import { HostingMatrix } from './HostingMatrix'
import { StoryEmbed, StoryList } from './Story'
import { Terminal } from './Terminal'
import { WalkStep, Walkthrough } from './Walkthrough'

/** What chapter MDX may use without importing it. */
export const mdxComponents: MDXComponents = {
  pre: CodeBlock,
  ArchitectureMap,
  ChapterLink,
  HostingMatrix,
  StoryEmbed,
  StoryList,
  Terminal,
  Walkthrough,
  WalkStep,
}
