import { type Model, TECHNIQUE_LABELS, difficultyLabel } from '@origami/core'
import { adhesiveLabel, paperLabel, timeLabel, toolLabel } from '../lib/format'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="section-title mb-1">{label}</div>
      <div className="text-sm text-ink">{value}</div>
    </div>
  )
}

export function ModelMeta({ model, columns = 2 }: { model: Model; columns?: 2 | 3 }) {
  return (
    <div className={`grid gap-4 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      <Fact label="Technique" value={TECHNIQUE_LABELS[model.technique]} />
      <Fact label="Difficulty" value={`${model.difficulty}/5 - ${difficultyLabel(model.difficulty)}`} />
      <Fact label="Time" value={timeLabel(model.timeMinutes)} />
      <Fact label="Steps" value={`${model.steps.length} steps`} />
      <Fact label="Paper" value={paperLabel(model.paper)} />
      <Fact label="Tools" value={toolLabel(model.tools)} />
      <Fact label="Adhesive" value={adhesiveLabel(model.adhesives)} />
      <Fact label="Source" value={`${model.provenance.source} (${model.provenance.license})`} />
    </div>
  )
}
