import { type FoldedStep, type FoldState, type SequenceResult, describeIssue, runFoldSequence } from '@origami/fold'
import { parseLibrary } from './library'
import type { LibraryIssue, Model } from './types'

const cache = new WeakMap<Model, SequenceResult>()

/** Run a Model's fold sequence through the fold engine. Null when the Model has none. Cached per Model. */
export function foldModel(model: Model): SequenceResult | null {
  if (!model.foldSequence) return null
  const known = cache.get(model)
  if (known) return known
  const result = runFoldSequence(model.foldSequence)
  cache.set(model, result)
  return result
}

export function hasFoldSequence(model: Model): boolean {
  return model.foldSequence !== undefined
}

/**
 * The folded state at the end of each Step that has folds, keyed by Step id. A Step with no folds
 * of its own (for example "colour side up") still gets the state it shows. Empty when the Model
 * has no fold sequence or its sequence fails.
 */
export function foldedStates(model: Model): Map<string, FoldedStep> {
  const result = foldModel(model)
  const out = new Map<string, FoldedStep>()
  if (!result || !result.ok) return out
  for (const step of result.steps) out.set(step.step, step)
  return out
}

/** The folded state a learner sees at the end of a Step, or null. */
export function foldedStateForStep(model: Model, stepId: string): FoldState | null {
  return foldedStates(model).get(stepId)?.state ?? null
}

/** The folded state just before a Step starts (the sheet for the first Step), or null. */
export function foldedStateBeforeStep(model: Model, stepId: string): FoldState | null {
  const result = foldModel(model)
  if (!result || !result.ok) return null
  const index = result.steps.findIndex((s) => s.step === stepId)
  if (index < 0) return null
  return index === 0 ? result.sheet : result.steps[index - 1]!.state
}

/**
 * The fold part of the Library audit: the fold sequence names real Steps in order, and every fold
 * in it passes the fold engine's checks. Runs in CI (see `auditLibrary`), not at page load.
 */
export function auditFoldSequence(model: Model): LibraryIssue[] {
  if (!model.foldSequence) return []
  const issues: LibraryIssue[] = []
  const push = (message: string) => issues.push({ modelId: model.id, severity: 'error', message })
  const order = new Map(model.steps.map((step, index) => [step.id, index]))
  let last = -1
  const seen = new Set<string>()
  for (const foldStep of model.foldSequence.steps) {
    const index = order.get(foldStep.step)
    if (index === undefined) push(`Fold sequence names Step "${foldStep.step}", which the Model does not have.`)
    else if (seen.has(foldStep.step)) push(`Fold sequence names Step "${foldStep.step}" twice.`)
    else if (index < last) push(`Fold sequence lists Step "${foldStep.step}" out of order.`)
    else last = index
    seen.add(foldStep.step)
  }
  const result = foldModel(model)
  if (result && !result.ok) push(`Fold sequence: ${describeIssue(result.issue)}`)
  return issues
}

/**
 * The full Library audit: schema and structure checks (`parseLibrary`) plus the fold engine on
 * every Model that has a fold sequence.
 */
export function auditLibrary(entries: unknown[]): { models: Model[]; issues: LibraryIssue[] } {
  const { models, issues } = parseLibrary(entries)
  for (const model of models) issues.push(...auditFoldSequence(model))
  return { models, issues }
}
