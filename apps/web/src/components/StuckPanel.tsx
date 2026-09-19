import type { ExplanationLevel, Step } from '@origami/core'
import { Badge } from './Badge'
import type { ExplainResult } from '../lib/api'

const LEVELS: Array<{ level: ExplanationLevel; label: string; hint: string }> = [
  { level: 'simpler', label: 'Simpler words', hint: 'The same thing, said in as few words as possible' },
  { level: 'visual', label: 'Walk the diagram', hint: 'What each line and arrow in the picture means' },
  { level: 'analogy', label: 'Something similar', hint: 'Compare it to something you already do' },
  { level: 'troubleshoot', label: 'What went wrong', hint: 'If you tried it and it did not work, check this' },
  { level: 'detail', label: 'Full detail', hint: 'Everything about this step, including the checkpoints' },
]

export function StuckPanel({
  step,
  level,
  attempts,
  result,
  loading,
  onAsk,
}: {
  step: Step
  level: ExplanationLevel
  attempts: number
  result: ExplainResult | null
  loading: boolean
  onAsk: (level: ExplanationLevel) => void
}) {
  const rejected = result?.rejected

  return (
    <div className="rounded-2xl border border-paper-300 bg-paper-100 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">Stuck on this step?</div>
          <p className="text-xs text-ink-soft">
            Ask again and you get a different explanation, not the same one louder.
            {attempts > 0 ? ` ${attempts} ${attempts === 1 ? 'extra angle' : 'extra angles'} so far.` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={loading}
          onClick={() => onAsk(level)}
        >
          {loading ? 'Thinking...' : attempts === 0 ? 'Explain it another way' : 'Still stuck, try again'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {LEVELS.map((option) => (
          <button
            key={option.level}
            type="button"
            title={option.hint}
            disabled={loading}
            onClick={() => onAsk(option.level)}
            className={`chip transition ${
              option.level === level ? 'border-paper-600 bg-paper-200 text-ink' : 'hover:border-paper-400'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {result && (
        <div className="mt-4 rounded-xl border border-paper-300 bg-paper-50 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="section-title">{LEVELS.find((l) => l.level === result.explanation.level)?.label}</span>
            {result.source === 'offline' && (
              <Badge title="The AI service was not reachable, so the offline tutor answered">offline tutor</Badge>
            )}
            {result.grounding.ok ? (
              <Badge tone="good" title="Every operation named is one this model actually performs">
                checked against the model
              </Badge>
            ) : (
              <Badge tone="danger">ungrounded - do not follow</Badge>
            )}
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{result.explanation.text}</p>

          {rejected && (
            <p className="mt-3 border-t border-paper-200 pt-3 text-xs text-ink-faint">
              A previous suggestion was discarded before you saw it: it named{' '}
              <strong className="text-ink-soft">
                {rejected.grounding.violations.map((violation) => violation.term).join(', ')}
              </strong>
              , which this model never does.
            </p>
          )}
        </div>
      )}

      {step.commonMistakes.length > 0 && (
        <div className="mt-4">
          <div className="section-title mb-1.5">Common slips on this step</div>
          <ul className="space-y-1">
            {step.commonMistakes.map((mistake) => (
              <li key={mistake} className="text-xs text-ink-soft">
                {mistake}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
