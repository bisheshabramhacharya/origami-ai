import { applyAction } from './actions'
import { checkKawasaki, checkLayers, checkMaekawa, checkNoStretch } from './checks'
import { type FoldCheck, FoldCheckError, type FoldIssue } from './errors'
import { type FoldKind, type FoldSequence, FoldSequenceSchema, type FoldSequenceInput } from './language'
import { type FoldState, makeSheet } from './state'

export interface FoldedStep {
  step: string
  /** The folded state at the end of the Step. */
  state: FoldState
  /** The state after each action of the Step, in order. */
  actionStates: FoldState[]
  /** The fold kinds the Step's actions used, in order. */
  kinds: FoldKind[]
}

/** A failed fold: which Step, which action (1-based), which check, and what is wrong. */
export interface SequenceIssue extends FoldIssue {
  step: string | null
  action: number | null
}

export type SequenceResult =
  | { ok: true; sheet: FoldState; steps: FoldedStep[]; final: FoldState }
  | { ok: false; issue: SequenceIssue; steps: FoldedStep[] }

export function describeIssue(issue: SequenceIssue): string {
  const where = [issue.step !== null ? `Step ${issue.step}` : null, issue.action !== null ? `action ${issue.action}` : null]
    .filter(Boolean)
    .join(', ')
  return `${where ? `${where}: ` : ''}${issue.message} (${issue.check} check)`
}

/** Error thrown by `foldSequence` when a fold fails. */
export class FoldSequenceError extends Error {
  readonly issue: SequenceIssue
  constructor(issue: SequenceIssue) {
    super(describeIssue(issue))
    this.name = 'FoldSequenceError'
    this.issue = issue
  }
}

const geometryChecks = (state: FoldState) => [...checkNoStretch(state), ...checkMaekawa(state), ...checkKawasaki(state)]

/**
 * Run a fold sequence from the flat sheet. Every action is checked; the first failure stops the
 * run and names the Step, the action and the check.
 */
export function runFoldSequence(input: FoldSequenceInput | FoldSequence): SequenceResult {
  const parsed = FoldSequenceSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]!
    const stepIndex = typeof first.path[1] === 'number' ? first.path[1] : null
    const actionIndex = typeof first.path[3] === 'number' ? first.path[3] + 1 : null
    const raw = input as { steps?: Array<{ step?: unknown }> }
    const step = stepIndex !== null ? String(raw.steps?.[stepIndex]?.step ?? stepIndex + 1) : null
    return {
      ok: false,
      steps: [],
      issue: { check: 'schema', message: `${first.path.join('.') || 'sequence'}: ${first.message}`, step, action: actionIndex },
    }
  }
  const sequence = parsed.data
  const sheet = makeSheet(sequence.paper)
  let state = sheet
  const steps: FoldedStep[] = []
  for (const step of sequence.steps) {
    const actionStates: FoldState[] = []
    const kinds: FoldKind[] = []
    for (let i = 0; i < step.actions.length; i += 1) {
      try {
        const result = applyAction(state, step.actions[i]!)
        const problems = geometryChecks(result.state)
        if (problems.length > 0) throw new FoldCheckError(problems[0]!.check, problems[0]!.message, problems[0]!.at)
        state = result.state
        actionStates.push(state)
        kinds.push(result.kind)
      } catch (error) {
        if (!(error instanceof FoldCheckError)) throw error
        return { ok: false, steps, issue: { ...error.toIssue(), step: step.step, action: i + 1 } }
      }
    }
    const layerProblems = checkLayers(state)
    if (layerProblems.length > 0) {
      return { ok: false, steps, issue: { ...layerProblems[0]!, step: step.step, action: null } }
    }
    steps.push({ step: step.step, state, actionStates, kinds })
  }
  return { ok: true, sheet, steps, final: state }
}

/** Like runFoldSequence, but throws FoldSequenceError on the first failure. */
export function foldSequence(input: FoldSequenceInput | FoldSequence) {
  const result = runFoldSequence(input)
  if (!result.ok) throw new FoldSequenceError(result.issue)
  return result
}

export type { FoldCheck }
