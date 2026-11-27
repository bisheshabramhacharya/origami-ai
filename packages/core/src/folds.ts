import {
  type ActionMotion,
  type DisplayMesh,
  type FoldKind,
  type FoldedStep,
  type FoldState,
  type SequenceResult,
  MOTION_SAMPLES,
  actionMotion,
  describeIssue,
  displayMesh,
  runFoldSequence,
} from '@origami/fold'
import { parseLibrary } from './library'
import type { LibraryIssue, Model, Operation } from './types'

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

/** What the 3D player needs for one Step: the paper before it, and the motion of each action in order. */
export interface StepPlayback {
  stepId: string
  before: FoldState
  after: FoldState
  /** One per action. A Step with no actions (for example "colour side up") has none. */
  motions: ActionMotion[]
  /** A box that holds the paper all through the Step, so a view can frame it once. */
  frame: DisplayMesh['box']
}

const playbackCache = new WeakMap<Model, Map<string, StepPlayback | null>>()

/** The playback of a Step, or null when the Model has no fold sequence for it. Cached per Model. */
export function stepPlayback(model: Model, stepId: string): StepPlayback | null {
  let byStep = playbackCache.get(model)
  if (!byStep) {
    byStep = new Map()
    playbackCache.set(model, byStep)
  }
  if (byStep.has(stepId)) return byStep.get(stepId)!
  const before = foldedStateBeforeStep(model, stepId)
  const step = foldedStates(model).get(stepId)
  let playback: StepPlayback | null = null
  if (before && step) {
    const motions: ActionMotion[] = []
    const actions = model.foldSequence?.steps.find((s) => s.step === stepId)?.actions ?? []
    let from = before
    step.actionStates.forEach((state, i) => {
      const action = actions[i]
      const turnDegrees = action?.kind === 'rotate' ? action.degrees : undefined
      motions.push(actionMotion(from, state, step.kinds[i]!, { turnDegrees }))
      from = state
    })
    const boxes = [before, step.state, ...motions.flatMap((m) => MOTION_SAMPLES.map((t) => m.stateAt(t)))].map(
      (state) => displayMesh(state).box,
    )
    const frame = {
      minX: Math.min(...boxes.map((b) => b.minX)),
      minY: Math.min(...boxes.map((b) => b.minY)),
      minZ: Math.min(...boxes.map((b) => b.minZ)),
      maxX: Math.max(...boxes.map((b) => b.maxX)),
      maxY: Math.max(...boxes.map((b) => b.maxY)),
      maxZ: Math.max(...boxes.map((b) => b.maxZ)),
    }
    playback = { stepId, before, after: step.state, motions, frame }
  }
  byStep.set(stepId, playback)
  return playback
}

/**
 * The Operation a Step must declare for each kind of fold the engine sees it do. Written once here;
 * the Library audit uses it to keep each Step's declared Operations true to its folds.
 */
export const FOLD_KIND_OPERATIONS: Record<FoldKind, Operation> = {
  valley: 'valley-fold',
  mountain: 'mountain-fold',
  collapse: 'collapse',
  squash: 'squash-fold',
  petal: 'petal-fold',
  'inside-reverse': 'reverse-fold',
  'outside-reverse': 'reverse-fold',
  unfold: 'unfold',
  'turn-over': 'turn-over',
  rotate: 'rotate',
  open: 'open',
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
  // Grounded check: every fold the engine sees a Step do is one the Step declares.
  if (result && result.ok) {
    for (const folded of result.steps) {
      const step = model.steps.find((s) => s.id === folded.step)
      if (!step) continue
      for (const kind of new Set(folded.kinds)) {
        const operation = FOLD_KIND_OPERATIONS[kind]
        if (!step.operations.includes(operation)) {
          push(`Model "${model.id}", Step "${step.id}" does a ${kind} fold in its fold sequence but does not declare the Operation "${operation}".`)
        }
      }
    }
  }
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
