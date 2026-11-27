import { type Model, foldedStateForStep } from '@origami/core'
import { displayMesh } from '@origami/fold'
import { useMemo } from 'react'
import { FoldScene } from './FoldScene'

/** The 3D view of a Step's end state. Loaded only when a Model with a fold sequence opens. */
export default function Step3D({ model, stepId, stepLabel }: { model: Model; stepId: string; stepLabel: string }) {
  const mesh = useMemo(() => {
    const state = foldedStateForStep(model, stepId)
    return state ? displayMesh(state) : null
  }, [model, stepId])
  // No folded state (the sequence failed before this Step): let StepVisual's boundary show the 2D Diagram.
  if (!mesh) throw new Error(`No folded state for ${stepId}.`)
  return <FoldScene mesh={mesh} label={`3D view of ${stepLabel}. Drag to turn the paper.`} />
}
