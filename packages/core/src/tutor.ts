import { describeOperations } from './grounding'
import { checkGrounding } from './grounding'
import { OPERATION_LABELS, type Diagram, type Explanation, type ExplanationLevel, type GroundingReport, type Model, type Step } from './types'

export interface TutorInput {
  model: Model
  step: Step
  level: ExplanationLevel
  attemptIndex: number
  question?: string
}

export interface TutorProvider {
  readonly name: 'llm' | 'heuristic'
  explain(input: TutorInput): Promise<Explanation>
}

export interface TutorResult {
  explanation: Explanation
  grounding: GroundingReport
  rejected?: { explanation: Explanation; grounding: GroundingReport }
}

const ANALOGIES = [
  'It is like closing a book cover: the line you already made is the hinge, and everything swings on that one line.',
  'Think of it like folding a letter to fit an envelope: same motion, just lining the edges up carefully.',
  'Picture a paper fan: the whole shape only moves along the lines you have already pressed.',
  'It is the same move as closing a laptop lid - one straight hinge, everything else stays put.',
]

const TROUBLESHOOT_PROMPTS = [
  'Compare your paper against the diagram edge by edge. Which corner is furthest from the picture?',
  'Hold the paper up to a window. Can you still see the line from the previous step?',
  'Lay it flat and press along every line you have made so far, then try again.',
  'Check that you are working on the side shown in the diagram; if the fold looks wrong, try the other side.',
]

export function describeDiagram(diagram: Diagram): string {
  const parts: string[] = []
  const counts = new Map<string, number>()
  for (const primitive of diagram.primitives) {
    counts.set(primitive.kind, (counts.get(primitive.kind) ?? 0) + 1)
  }
  const folds = diagram.primitives.filter((primitive) => primitive.kind === 'fold')
  const arrows = diagram.primitives.filter((primitive) => primitive.kind === 'arrow' || primitive.kind === 'curve-arrow')
  const cuts = diagram.primitives.filter((primitive) => primitive.kind === 'cut')

  if (folds.length > 0) {
    const valleyCount = folds.filter((fold) => fold.kind === 'fold' && fold.fold === 'valley').length
    const mountainCount = folds.filter((fold) => fold.kind === 'fold' && fold.fold === 'mountain').length
    const bits: string[] = []
    if (valleyCount > 0) bits.push(`${valleyCount} dashed blue line${valleyCount === 1 ? '' : 's'}`)
    if (mountainCount > 0) bits.push(`${mountainCount} dash-dot red line${mountainCount === 1 ? '' : 's'}`)
    if (bits.length > 0) parts.push(`The diagram shows ${bits.join(' and ')}.`)
  }
  if (arrows.length > 0) {
    parts.push(
      `${arrows.length} arrow${arrows.length === 1 ? '' : 's'} tell${arrows.length === 1 ? 's' : ''} you which way the paper moves.`,
    )
  }
  if (cuts.length > 0) {
    parts.push(`${cuts.length} dashed cutting line${cuts.length === 1 ? '' : 's'} to follow with scissors.`)
  }
  if (parts.length === 0) {
    parts.push('The diagram shows the flat paper with the shape you are aiming for.')
  }
  return parts.join(' ')
}

function firstSentence(text: string): string {
  const match = /^[^.!?]+[.!?]/.exec(text.trim())
  return (match ? match[0] : text).trim()
}

function sentence(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function joinSentences(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map(sentence)
    .join(' ')
}

function expansion(step: Step, model: Model, attemptIndex: number): string {
  const operations = describeOperations(step.operations)
  const checkpoint = step.checkpoints[attemptIndex % Math.max(1, step.checkpoints.length)]
  const tip = model.tips[attemptIndex % Math.max(1, model.tips.length)]
  return joinSentences([
    `${step.title} - in full`,
    `What you are doing here: ${operations}`,
    step.instruction,
    checkpoint ? `Stop when: ${checkpoint}` : undefined,
    tip ? `Handy: ${tip}` : undefined,
  ])
}

function analogy(step: Step, attemptIndex: number): string {
  return joinSentences([
    `${step.title}: ${ANALOGIES[attemptIndex % ANALOGIES.length]}`,
    firstSentence(step.instruction),
  ])
}

function troubleshoot(step: Step, attemptIndex: number): string {
  const mistake = step.commonMistakes[attemptIndex % Math.max(1, step.commonMistakes.length)]
  return joinSentences([
    firstSentence(step.instruction),
    mistake ? `Common slip: ${mistake}` : undefined,
    TROUBLESHOOT_PROMPTS[attemptIndex % TROUBLESHOOT_PROMPTS.length],
  ])
}

function simpler(step: Step, attemptIndex: number): string {
  const checkpoint = step.checkpoints[attemptIndex % Math.max(1, step.checkpoints.length)]
  return joinSentences([
    `Just one thing: ${firstSentence(step.instruction)}`,
    checkpoint ? `Then check: ${checkpoint}` : undefined,
  ])
}

function visual(step: Step): string {
  return joinSentences([describeDiagram(step.diagram), firstSentence(step.instruction)])
}

export function heuristicText(input: TutorInput): string {
  const { step, model, level, attemptIndex } = input
  switch (level) {
    case 'simpler':
      return simpler(step, attemptIndex)
    case 'detail':
      return expansion(step, model, attemptIndex)
    case 'analogy':
      return analogy(step, attemptIndex)
    case 'troubleshoot':
      return troubleshoot(step, attemptIndex)
    case 'visual':
      return visual(step)
  }
}

export class HeuristicTutor implements TutorProvider {
  readonly name = 'heuristic' as const

  async explain(input: TutorInput): Promise<Explanation> {
    return {
      modelId: input.model.id,
      stepId: input.step.id,
      level: input.level,
      text: heuristicText(input),
      hint: input.step.checkpoints[input.attemptIndex % Math.max(1, input.step.checkpoints.length)],
      provider: 'heuristic',
    }
  }
}

export async function explainStep(input: TutorInput, provider: TutorProvider): Promise<TutorResult> {
  const explanation = await provider.explain(input)
  const grounding = checkGrounding(explanation.text, input.model)

  if (grounding.ok || provider.name === 'heuristic') {
    return { explanation, grounding }
  }

  const fallback = await new HeuristicTutor().explain(input)
  return {
    explanation: fallback,
    grounding: checkGrounding(fallback.text, input.model),
    rejected: { explanation, grounding },
  }
}

export function nextLevel(current: ExplanationLevel, attemptIndex: number): ExplanationLevel {
  const order: ExplanationLevel[] = ['simpler', 'visual', 'analogy', 'troubleshoot', 'detail']
  return order[attemptIndex % order.length] ?? current
}

export function operationVocabulary(step: Step): string {
  return step.operations.map((operation) => OPERATION_LABELS[operation]).join(', ')
}
