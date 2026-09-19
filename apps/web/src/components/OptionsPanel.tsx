import { type BuildBrief, type Model, type RankedOption, difficultyLabel } from '@origami/core'
import { OptionCard } from './OptionCard'
import { PAPER_WEIGHT_LABELS } from '../lib/format'

function ConstraintChips({ brief }: { brief: BuildBrief }) {
  const c = brief.constraints
  const chips: string[] = [`up to difficulty ${c.difficultyMax} (${difficultyLabel(c.difficultyMax).toLowerCase()})`]
  chips.push(`under ${c.timeMinutesMax} min`)
  chips.push(c.sheetsMax >= 8 ? 'no sheet limit' : `up to ${c.sheetsMax} sheet${c.sheetsMax === 1 ? '' : 's'}`)
  if (c.paperWeights.length > 0) chips.push(`using ${c.paperWeights.map((w) => PAPER_WEIGHT_LABELS[w]).join(' or ')}`)
  if (c.noScissors) chips.push('no scissors')
  if (c.noGlue) chips.push('no glue')
  if (c.noPrinter) chips.push('no printer')

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span key={chip} className="chip">
          {chip}
        </span>
      ))}
    </div>
  )
}

export function OptionsPanel({
  brief,
  options,
  enriched,
  refining = false,
  onChoose,
  onEdit,
}: {
  brief: BuildBrief
  options: RankedOption[]
  enriched: boolean
  refining?: boolean
  onChoose: (model: Model) => void
  onEdit: () => void
}) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="section-title mb-1">You asked for</div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{brief.objectLabel}</h1>
            <div className="mt-3">
              <ConstraintChips brief={brief} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="chip" title="How your request was read">
              {refining ? 'reading with AI...' : enriched ? 'read by AI' : 'read locally'}
            </span>
            <button type="button" className="btn-ghost" onClick={onEdit}>
              Change request
            </button>
          </div>
        </div>

        {(brief.notes.length > 0 || brief.unparsed.length > 0) && (
          <div className="mt-4 space-y-3 border-t border-paper-200 pt-4">
            {brief.notes.length > 0 && (
              <div className="text-xs text-ink-soft">
                <span className="font-medium text-ink">Assumptions: </span>
                {brief.notes.join(' ')}
              </div>
            )}
            {brief.unparsed.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                We could not handle <strong>{brief.unparsed.join(', ')}</strong> - no paper technique here can
                do that yet, so we have ignored it rather than pretended.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-ink">
          {options.length > 0
            ? `${options.length} realistic way${options.length === 1 ? '' : 's'} to build this`
            : 'No realistic way to build this yet'}
        </h2>
        <span className="text-xs text-ink-faint">Ranked by fit to everything you told us</span>
      </div>

      {options.length === 0 ? (
        <div className="card mt-4 p-6">
          <p className="text-sm text-ink-soft">
            Every model in the library breaks one of your constraints. Loosen one of them - allow more
            time, more sheets, or a tool - and try again.
          </p>
          <button type="button" className="btn-ghost mt-4" onClick={onEdit}>
            Adjust my request
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {options.map((option, index) => (
            <OptionCard key={option.model.id} option={option} rank={index} onChoose={onChoose} />
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-ink-faint">
        These are retrieved from a validated library, not generated. Every model records where it came
        from and who checked it.
      </p>
    </div>
  )
}
