import type { Model, Step } from '@origami/core'
import { Component, type ReactNode, Suspense, lazy, useState } from 'react'
import { hasWebGL } from '../lib/webgl'
import { DiagramView } from './DiagramView'

const Step3D = lazy(() => import('./three/Step3D'))

/** Plain data check, so the fold engine runs only in the lazy 3D chunk. */
function stepHasFolds(model: Model, step: Step): boolean {
  return model.foldSequence?.steps.some((s) => s.step === step.id) ?? false
}

class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** The picture for a Step: the 3D folded state when the Model has one, else the 2D Diagram. */
export function StepVisual({ model, step }: { model: Model; step: Step }) {
  const can3D = stepHasFolds(model, step) && hasWebGL()
  const [mode, setMode] = useState<'3d' | '2d'>('3d')
  const diagram = (
    <>
      <DiagramView diagram={step.diagram} className="aspect-square w-full" />
      {step.diagram.caption && <p className="mt-3 text-center text-xs text-ink-faint">{step.diagram.caption}</p>}
    </>
  )
  if (!can3D) return <div className="rounded-2xl bg-paper-100 p-4">{diagram}</div>
  const show3D = mode === '3d'
  return (
    <div className="rounded-2xl bg-paper-100 p-3">
      <div className="mb-2 flex justify-end">
        <div role="group" aria-label="View" className="inline-flex rounded-full bg-paper-200 p-0.5 text-xs font-medium">
          {(['3d', '2d'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {show3D ? (
        <Fallback key={step.id} fallback={diagram}>
          <Suspense fallback={<div className="aspect-square w-full animate-pulse rounded-xl bg-paper-200" />}>
            <div className="aspect-square w-full">
              <Step3D model={model} stepId={step.id} stepLabel={`Step ${step.ordinal}, ${step.title}`} />
            </div>
          </Suspense>
          <p className="mt-2 text-center text-xs text-ink-faint">Drag to turn the paper.</p>
        </Fallback>
      ) : (
        diagram
      )}
    </div>
  )
}
