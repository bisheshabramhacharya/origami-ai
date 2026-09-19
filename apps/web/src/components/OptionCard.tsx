import { type Model, type RankedOption, TECHNIQUE_LABELS, difficultyLabel } from '@origami/core'
import { Badge } from './Badge'
import { PreviewPane } from './DiagramView'
import { matchLabel, matchTone, percent, timeLabel } from '../lib/format'

export function OptionCard({
  option,
  rank,
  onChoose,
}: {
  option: RankedOption
  rank: number
  onChoose: (model: Model) => void
}) {
  const { model } = option

  return (
    <article className="card flex flex-col p-5 transition hover:shadow-lift">
      <div className="flex gap-4">
        <PreviewPane diagram={model.preview} className="w-28 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={matchTone(option.match)}>{matchLabel(option.match)}</Badge>
            <Badge>{TECHNIQUE_LABELS[model.technique]}</Badge>
            <span className="text-xs text-ink-faint">#{rank + 1}</span>
          </div>
          <h3 className="text-lg font-semibold leading-tight text-ink">{model.title}</h3>
          <p className="mt-1 text-sm text-ink-soft">{model.summary}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="chip">{difficultyLabel(model.difficulty)}</span>
        <span className="chip">{timeLabel(model.timeMinutes)}</span>
        <span className="chip">
          {model.steps.length} steps
        </span>
        <span className="chip">
          {model.paper.sheets === 1 ? '1 sheet' : `${model.paper.sheets} sheets`}
        </span>
        <span className="chip">{model.tools.length === 0 ? 'no tools' : `${model.tools.length} tools`}</span>
        <span className="chip">{model.adhesives.length === 0 ? 'no glue' : 'needs glue'}</span>
      </div>

      {option.reasons.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {option.reasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex gap-2 text-sm text-ink-soft">
              <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
              {reason}
            </li>
          ))}
        </ul>
      )}

      {option.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
          {option.warnings.map((warning) => (
            <li key={warning} className="text-xs text-amber-800">
              {warning}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="text-xs text-ink-faint" title={`Match score ${percent(option.score)}`}>
          {percent(option.score)} match
        </span>
        <button type="button" className="btn-primary" onClick={() => onChoose(model)}>
          Teach me this one
        </button>
      </div>
    </article>
  )
}
