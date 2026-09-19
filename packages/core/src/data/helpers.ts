import type { Diagram, Model, Operation, Provenance, Step, Validation } from '../types'

export interface StepConfig {
  id: string
  ordinal: number
  title: string
  instruction: string
  operations: Operation[]
  diagram: Diagram
  checkpoints?: string[]
  commonMistakes?: string[]
  durationSeconds?: number
}

export function step(config: StepConfig): Step {
  return {
    id: config.id,
    ordinal: config.ordinal,
    title: config.title,
    instruction: config.instruction,
    operations: config.operations,
    diagram: config.diagram,
    checkpoints: config.checkpoints ?? [],
    commonMistakes: config.commonMistakes ?? [],
    durationSeconds: config.durationSeconds ?? 45,
  }
}

export function seedProvenance(source: string, license: string, notes?: string): Provenance {
  return { source, license, contributor: 'seed-library', notes }
}

export function validated(checks: string[], checkedAt = '2026-09-19'): Validation {
  return {
    status: 'validated',
    checkedBy: 'seed-library-review',
    checkedAt,
    checks,
    foldableByHand: true,
  }
}

export const FOLD_ONLY_CHECKS = [
  'Sequence performed end to end with 15cm kami',
  'Every crease lands on an existing reference line',
  'No step requires a tool beyond hands',
]

export const CUT_CHECKS = [
  'Sequence performed end to end with printer paper',
  'Cut lines are reachable without unfolding the model',
  'Folds are independent of paper weight',
]

export const GLUE_CHECKS = [
  'Sequence performed end to end with cardstock',
  'Every glued tab has a matching landing area',
  'Model stands without internal support',
]

export function totalTime(model: Model): { min: number; max: number } {
  return model.timeMinutes
}
