import { OPERATION_LABELS, type GroundingReport, type GroundingViolation, type Model, type Operation, type Step } from './types'

interface OperationPattern {
  operation: Operation
  pattern: RegExp
}

const NAMED_OBJECTS = '(?:it|the|this|that|these|those|them)'
const NAMED_OBJECT_LOOKAHEAD = `(?=\\s+${NAMED_OBJECTS}\\b)`

const PATTERNS: OperationPattern[] = [
  { operation: 'rabbit-ear-fold', pattern: /\brabbit[\s-]?ears?\b/i },
  { operation: 'reverse-fold', pattern: new RegExp(`\\breverse[\\s-]?folds?\\b|\\brevers(?:e|ed|ing)${NAMED_OBJECT_LOOKAHEAD}`, 'i') },
  { operation: 'squash-fold', pattern: new RegExp(`\\bsquash(?:ed|ing)?[\\s-]?folds?\\b|\\bsquash(?:ed|ing)?${NAMED_OBJECT_LOOKAHEAD}`, 'i') },
  { operation: 'petal-fold', pattern: new RegExp(`\\bpetal[\\s-]?folds?\\b|\\bpetals?${NAMED_OBJECT_LOOKAHEAD}`, 'i') },
  { operation: 'crimp-fold', pattern: new RegExp(`\\bcrimped?[\\s-]?folds?\\b|\\bcrimp(?:ed|ing)?${NAMED_OBJECT_LOOKAHEAD}`, 'i') },
  { operation: 'pleat-fold', pattern: /\bpleats?(ed)?[\s-]?folds?\b|\bpleated\b|\bpleat(?:s|ed|ing)?\b(?=\s+(?:it|the|this|that)\b)/i },
  { operation: 'blintz-fold', pattern: /\bblintz(ed)?\b/i },
  { operation: 'kite-fold', pattern: /\bkite[\s-]?folds?\b/i },
  { operation: 'mountain-fold', pattern: /\bmountain[\s-]?folds?\b/i },
  { operation: 'valley-fold', pattern: /\bvalley[\s-]?folds?\b/i },
  { operation: 'unfold', pattern: /\bunfold(s|ed|ing)?\b/i },
  { operation: 'crease', pattern: /\bcreas(e|es|ed|ing)\b/i },
  { operation: 'collapse', pattern: /\bcollaps(e|es|ed|ing)\b/i },
  { operation: 'turn-over', pattern: /\bturn (it )?(over|around)\b|\bturn[- ]over\b/i },
  { operation: 'press-flat', pattern: /\bpress (it )?(flat|down)\b|\bflatten\b/i },
  { operation: 'open', pattern: /\bopen (it )?out\b|\bopen out\b|\bopen (it )?up\b/i },
  { operation: 'cut', pattern: /\bcut(s|ting)?\b|\bsnip\b/i },
  { operation: 'score', pattern: /\bscor(e|es|ed|ing)\b/i },
  { operation: 'punch', pattern: /\bpunche?s?\b|\bhole punch\b/i },
  { operation: 'inflate', pattern: /\binflat(e|es|ed|ing)\b|\bblow (it )?up\b/i },
  { operation: 'insert', pattern: /\binsert(s|ed|ing)?\b/i },
  { operation: 'tuck', pattern: /\btuck(s|ed|ing)?\b|\btuck in\b/i },
  { operation: 'assemble', pattern: /\bassembl(e|es|ed|ing)\b|\bglue together\b/i },
  { operation: 'glue', pattern: /\bglu(e|es|ed|ing)\b/i },
  { operation: 'tape', pattern: /\btap(e|es|ed|ing)\b/i },
  { operation: 'staple', pattern: /\bstapl(e|es|ed|ing)\b/i },
  { operation: 'print', pattern: /\bprint(?:ing)? (?:out|the|it|this|these|them|all|at|on)\b/i },
  { operation: 'stand', pattern: /\bstand (it )?up\b|\bstands? (up|on)\b/i },
  { operation: 'shape', pattern: /\bshape (it|the|them)\b|\bshaping\b/i },
  { operation: 'fold', pattern: /\bfold(s|ed|ing)?\b/i },
]

export function modelOperations(model: Model): Operation[] {
  const set = new Set<Operation>()
  for (const step of model.steps) {
    for (const operation of step.operations) set.add(operation)
  }
  return [...set].sort()
}

export function stepOperations(step: Step): Operation[] {
  return [...new Set(step.operations)].sort()
}

/**
 * A model may only be explained using operations it actually performs.
 * Fold, unfold and crease are mutually implied: you cannot do one without the others,
 * and none of them can be an "impossible fold" on their own. The named folds, cuts and
 * adhesives are what the guard really polices.
 */
export function expandImplied(operations: Operation[]): Operation[] {
  const set = new Set<Operation>(operations)
  if (set.has('unfold')) set.add('fold')
  for (const operation of [...set]) {
    if (operation.endsWith('-fold')) set.add('fold')
  }
  if (set.has('fold')) set.add('crease')
  return [...set].sort()
}

export function extractOperations(text: string): Array<{ operation: Operation; term: string }> {
  const found = new Map<Operation, string>()
  for (const { operation, pattern } of PATTERNS) {
    const match = pattern.exec(text)
    if (match && !found.has(operation)) {
      found.set(operation, match[0].toLowerCase())
    }
  }
  return [...found.entries()].map(([operation, term]) => ({ operation, term }))
}

export function checkGrounding(text: string, model: Model): GroundingReport {
  const allowed = expandImplied(modelOperations(model))
  const allowedSet = new Set(allowed)
  const mentioned = extractOperations(text)

  const seen = new Set<string>()
  const violations: GroundingViolation[] = []
  for (const { operation, term } of mentioned) {
    if (allowedSet.has(operation) || seen.has(operation)) continue
    seen.add(operation)
    violations.push({
      operation,
      term,
      message: `"${term}" is not part of ${model.title}. No step in this model performs that operation, so the assistant must not introduce it.`,
    })
  }

  return {
    ok: violations.length === 0,
    violations,
    allowedOperations: allowed,
    mentionedOperations: [...new Set(mentioned.map((entry) => entry.operation))].sort(),
  }
}

export function describeOperations(operations: Operation[]): string {
  return operations.map((operation) => OPERATION_LABELS[operation]).join(', ')
}
