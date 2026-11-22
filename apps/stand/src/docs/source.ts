// Only the keys are used: which kit files are plain `.ts` (class strings, helpers) and not components.
const plain = new Set(
  Object.keys(import.meta.glob('../../../../packages/ui/src/*.ts')).map((path) => path.replace(/^(\.\.\/)+/, '')),
)

/** Workspace path of the file a story file documents: the one next to it with the same name. */
export function sourceOf(storyPath: string) {
  const base = storyPath.replace(/^(\.\/)?(\.\.\/)*/, '').replace('.stories.tsx', '')
  return plain.has(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`
}
