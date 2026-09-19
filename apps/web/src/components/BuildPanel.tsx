import { type ExplanationLevel, type Model, nextLevel } from '@origami/core'
import { useEffect, useState } from 'react'
import { explain, type ExplainResult } from '../lib/api'
import { Badge } from './Badge'
import { DiagramView } from './DiagramView'
import { ModelMeta } from './ModelMeta'
import { StuckPanel } from './StuckPanel'
import { timeLabel } from '../lib/format'

function StepList({
  model,
  stepIndex,
  onJump,
}: {
  model: Model
  stepIndex: number
  onJump: (index: number) => void
}) {
  return (
    <ol className="space-y-1">
      {model.steps.map((step, index) => {
        const state = index === stepIndex ? 'current' : index < stepIndex ? 'done' : 'todo'
        return (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onJump(index)}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition ${
                state === 'current'
                  ? 'bg-paper-200 text-ink'
                  : 'text-ink-soft hover:bg-paper-100'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  state === 'done'
                    ? 'bg-emerald-500 text-white'
                    : state === 'current'
                      ? 'bg-ink text-paper-50'
                      : 'bg-paper-200 text-ink-faint'
                }`}
              >
                {state === 'done' ? '✓' : step.ordinal}
              </span>
              <span className="text-sm leading-snug">{step.title}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function BuildPanel({ model, onBack }: { model: Model; onBack: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [level, setLevel] = useState<ExplanationLevel>('simpler')
  const [attempts, setAttempts] = useState(0)
  const [result, setResult] = useState<ExplainResult | null>(null)
  const [loading, setLoading] = useState(false)

  const step = model.steps[stepIndex]
  const isLast = stepIndex === model.steps.length - 1
  const progress = ((stepIndex + 1) / model.steps.length) * 100

  useEffect(() => {
    setResult(null)
    setAttempts(0)
    setLevel('simpler')
  }, [model.id, stepIndex])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') setStepIndex((index) => Math.min(index + 1, model.steps.length - 1))
      if (event.key === 'ArrowLeft') setStepIndex((index) => Math.max(index - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [model.steps.length])

  if (!step) return null

  async function ask(chosen: ExplanationLevel) {
    setLoading(true)
    setLevel(chosen)
    const index = attempts
    try {
      const response = await explain({ model, step: step!, level: chosen, attemptIndex: index })
      setResult(response)
      setAttempts(index + 1)
    } finally {
      setLoading(false)
    }
  }

  if (finished) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="card p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-lg text-white">
              ✓
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">You built it.</h1>
              <p className="text-sm text-ink-soft">
                {model.title} - {model.steps.length} steps, about {timeLabel(model.timeMinutes)}.
              </p>
            </div>
          </div>

          {model.tips.length > 0 && (
            <div className="mt-6">
              <div className="section-title mb-2">Worth knowing for next time</div>
              <ul className="space-y-2">
                {model.tips.map((tip) => (
                  <li key={tip} className="text-sm text-ink-soft">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={onBack}>
              Make something else
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFinished(false)
                setStepIndex(0)
              }}
            >
              Run through it again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-ghost" onClick={onBack}>
            ← Options
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">{model.title}</h1>
            <p className="text-xs text-ink-faint">
              Step {stepIndex + 1} of {model.steps.length} · arrow keys work too
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{model.paper.sheets === 1 ? '1 sheet' : `${model.paper.sheets} sheets`}</Badge>
          <Badge>{timeLabel(model.timeMinutes)}</Badge>
        </div>
      </div>

      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-paper-200">
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
        <aside className="space-y-5">
          <div className="card p-4">
            <div className="section-title mb-3">Steps</div>
            <StepList model={model} stepIndex={stepIndex} onJump={(index) => setStepIndex(index)} />
          </div>
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">Materials and details</summary>
            <div className="mt-4">
              <ModelMeta model={model} />
            </div>
            <div className="mt-4 border-t border-paper-200 pt-3">
              <div className="section-title mb-1">Provenance</div>
              <p className="text-xs text-ink-soft">{model.provenance.source}</p>
              <p className="text-xs text-ink-faint">
                {model.provenance.license} · checked {model.validation.checkedAt} by {model.validation.checkedBy}
              </p>
            </div>
          </details>
        </aside>

        <main className="space-y-5">
          <div className="card p-5">
            <div className="grid gap-6 sm:grid-cols-[minmax(0,15rem)_1fr]">
              <div className="rounded-2xl bg-paper-100 p-4">
                <DiagramView diagram={step.diagram} className="aspect-square w-full" />
                {step.diagram.caption && (
                  <p className="mt-3 text-center text-xs text-ink-faint">{step.diagram.caption}</p>
                )}
              </div>

              <div>
                <div className="section-title mb-1">
                  Step {step.ordinal} of {model.steps.length}
                </div>
                <h2 className="text-2xl font-semibold leading-tight tracking-tight text-ink">{step.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-ink">{step.instruction}</p>

                {step.checkpoints.length > 0 && (
                  <div className="mt-5">
                    <div className="section-title mb-2">You have got it right when</div>
                    <ul className="space-y-1.5">
                      {step.checkpoints.map((checkpoint) => (
                        <li key={checkpoint} className="flex gap-2 text-sm text-ink-soft">
                          <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                          {checkpoint}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <StuckPanel
            step={step}
            level={level}
            attempts={attempts}
            result={result}
            loading={loading}
            onAsk={(chosen) => ask(chosen)}
          />

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn-ghost"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (isLast) setFinished(true)
                else setStepIndex((index) => index + 1)
              }}
            >
              {isLast ? 'Finish' : 'Next step →'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
