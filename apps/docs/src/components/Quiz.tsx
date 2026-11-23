import { useId, useState } from 'react'

import { useLocale } from '../app/env'
import type { QuizQuestion } from '../content/syllabus/types'
import { m } from '../paraglide/messages'
import { InlineText } from './InlineText'

/** A question with one right answer. Checking marks the right option and explains it; picking again starts over. */
function Question({ question, index }: { question: QuizQuestion; index: number }) {
  const locale = useLocale()
  const name = useId()
  const [picked, setPicked] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const right = picked === question.answer
  return (
    <fieldset className="lc-card flex flex-col gap-3 p-4">
      <legend className="sr-only">
        {index + 1}. {question.question}
      </legend>
      <p aria-hidden className="font-semibold">
        {index + 1}. <InlineText text={question.question} />
      </p>
      <div className="flex flex-col gap-1.5">
        {question.options.map((option, optionIndex) => (
          <label
            key={option}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${
              checked && optionIndex === question.answer
                ? 'border-done bg-done/10'
                : checked && optionIndex === picked
                  ? 'border-today bg-today/10'
                  : 'border-line hover:bg-surface-2'
            }`}
          >
            <input
              type="radio"
              className="mt-1"
              name={name}
              checked={picked === optionIndex}
              onChange={() => {
                setPicked(optionIndex)
                setChecked(false)
              }}
            />
            <span>
              <InlineText text={option} />
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-[10px] border border-line bg-surface px-3 py-1.5 font-medium hover:bg-surface-2 disabled:opacity-50"
          disabled={picked === null}
          onClick={() => setChecked(true)}
        >
          {m.quiz_check({}, { locale })}
        </button>
        <p aria-live="polite" className="text-sm">
          {checked && (
            <>
              <strong className={right ? 'text-done-ink' : 'text-today-ink'}>
                {right ? m.quiz_correct({}, { locale }) : m.quiz_wrong({}, { locale })}
              </strong>{' '}
              <InlineText text={question.explanation} />
            </>
          )}
        </p>
      </div>
    </fieldset>
  )
}

export function Quiz({ questions }: { questions: readonly QuizQuestion[] }) {
  return (
    <div className="flex flex-col gap-3">
      {questions.map((question, index) => (
        <Question key={question.question} question={question} index={index} />
      ))}
    </div>
  )
}
