import { type Model, type Technique, SEED_LIBRARY, TECHNIQUE_LABELS, difficultyLabel, searchLibrary, techniquesPresent } from '@origami/core'
import { useMemo, useState } from 'react'
import { Badge } from './Badge'
import { PreviewPane } from './DiagramView'
import { paperLabel, timeLabel, toolLabel } from '../lib/format'

export function LibraryPanel({ onStart, onBack }: { onStart: (model: Model) => void; onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [technique, setTechnique] = useState<Technique | 'all'>('all')

  const results = useMemo(() => {
    const searched = searchLibrary(query, SEED_LIBRARY)
    return technique === 'all' ? searched : searched.filter((model) => model.technique === technique)
  }, [query, technique])

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Model library</h1>
          <p className="text-sm text-ink-soft">
            {SEED_LIBRARY.length} validated models. Every one was folded end to end before it was listed.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by object, technique or tag"
          className="field sm:max-w-sm"
          aria-label="Search the model library"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTechnique('all')}
            className={`chip transition ${technique === 'all' ? 'border-paper-600 bg-paper-200 text-ink' : ''}`}
          >
            all
          </button>
          {techniquesPresent().map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTechnique(item)}
              className={`chip transition ${technique === item ? 'border-paper-600 bg-paper-200 text-ink' : ''}`}
            >
              {TECHNIQUE_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">
          Nothing matches that. This library is small and deliberately so - only models that have been
          checked get in.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((model) => (
            <article key={model.id} className="card flex flex-col p-4">
              <PreviewPane diagram={model.preview} className="mb-3" />
              <div className="mb-1 flex flex-wrap gap-1.5">
                <Badge>{TECHNIQUE_LABELS[model.technique]}</Badge>
                <Badge>{difficultyLabel(model.difficulty)}</Badge>
              </div>
              <h2 className="text-sm font-semibold leading-snug text-ink">{model.title}</h2>
              <p className="mt-1 flex-1 text-xs text-ink-soft">{model.summary}</p>
              <dl className="mt-3 space-y-0.5 text-[11px] text-ink-faint">
                <div>{timeLabel(model.timeMinutes)} · {model.steps.length} steps</div>
                <div>{paperLabel(model.paper)}</div>
                <div>tools: {toolLabel(model.tools)}</div>
              </dl>
              <button type="button" className="btn-ghost mt-4 w-full" onClick={() => onStart(model)}>
                Start building
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
