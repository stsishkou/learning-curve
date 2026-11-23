import { CopyButton } from './CopyButton'

/** Shell commands to run from the repository root, each with its prompt. Never translated. */
export function Terminal({ commands }: { commands: readonly string[] }) {
  return (
    <div className="lc-terminal" translate="no">
      <div className="flex justify-end border-b border-line-soft px-1 py-0.5">
        <CopyButton text={commands.join('\n')} />
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-sm">
        {commands.map((command) => (
          <code key={command} className="block before:text-muted before:content-['$_']">
            {command}
          </code>
        ))}
      </pre>
    </div>
  )
}
