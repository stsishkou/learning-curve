import { useLocale } from '../app/env'
import type { Checkpoint as CheckpointData } from '../content/syllabus/types'
import { m } from '../paraglide/messages'
import { InlineText } from './InlineText'
import { Quiz } from './Quiz'
import { Terminal } from './Terminal'

/** What to run to see the chapter's result in your own checkout, what you should see, and a short quiz. */
export function Checkpoint({ checkpoint }: { checkpoint: CheckpointData }) {
  const locale = useLocale()
  return (
    <div className="flex flex-col gap-5">
      {checkpoint.commands.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{m.checkpoint_run({}, { locale })}</h3>
          <Terminal commands={checkpoint.commands} />
        </div>
      )}
      {checkpoint.expect.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{m.checkpoint_expect({}, { locale })}</h3>
          <ul className="lc-list">
            {checkpoint.expect.map((line) => (
              <li key={line}>
                <InlineText text={line} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {checkpoint.quiz.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{m.quiz_title({}, { locale })}</h3>
          <Quiz questions={checkpoint.quiz} />
        </div>
      )}
    </div>
  )
}
