import { BIRD_MODELS } from './data/birds'
import { ENGINEERED_MODELS } from './data/engineered'
import { FOLDED_MODELS } from './data/folded'
import { modelOperations } from './grounding'
import { ModelSchema, TECHNIQUE_LABELS, type LibraryIssue, type Model, type Technique } from './types'

const MEDIUM_TOOLS = new Set(['scissors', 'craft-knife'])

export function modelRequiresCutting(model: Model): boolean {
  return model.tools.some((tool) => MEDIUM_TOOLS.has(tool)) || modelOperations(model).includes('cut')
}

export function parseLibrary(entries: unknown[]): { models: Model[]; issues: LibraryIssue[] } {
  const models: Model[] = []
  const issues: LibraryIssue[] = []
  const seenIds = new Set<string>()

  entries.forEach((entry, index) => {
    const result = ModelSchema.safeParse(entry)
    if (!result.success) {
      const id = typeof entry === 'object' && entry !== null && 'id' in entry ? String((entry as { id: unknown }).id) : `#${index}`
      for (const issue of result.error.issues) {
        issues.push({ modelId: id, severity: 'error', message: `${issue.path.join('.') || 'model'}: ${issue.message}` })
      }
      return
    }

    const model = result.data
    if (seenIds.has(model.id)) {
      issues.push({ modelId: model.id, severity: 'error', message: 'Duplicate model id.' })
      return
    }
    seenIds.add(model.id)
    models.push(model)
  })

  for (const model of models) {
    issues.push(...auditModel(model))
  }

  return { models, issues }
}

export function auditModel(model: Model): LibraryIssue[] {
  const issues: LibraryIssue[] = []
  const push = (severity: LibraryIssue['severity'], message: string) => issues.push({ modelId: model.id, severity, message })

  if (model.timeMinutes.min > model.timeMinutes.max) {
    push('error', 'timeMinutes.min is greater than max.')
  }

  const stepIds = new Set<string>()
  model.steps.forEach((step, index) => {
    if (stepIds.has(step.id)) push('error', `Duplicate step id "${step.id}".`)
    stepIds.add(step.id)

    const expected = index + 1
    if (step.ordinal !== expected) {
      push('error', `Step "${step.id}" has ordinal ${step.ordinal}, expected ${expected}.`)
    }
    if (step.diagram.primitives.length === 0) {
      push('error', `Step "${step.id}" has an empty diagram.`)
    }
    if (step.checkpoints.length === 0) {
      push('warning', `Step "${step.id}" has no checkpoint, so the learner has no way to verify it.`)
    }
    const folds = step.diagram.primitives.filter((primitive) => primitive.kind === 'fold')
    const hasFoldOperation = step.operations.some((operation) => operation.includes('fold') || operation === 'fold')
    if (folds.length > 0 && !hasFoldOperation) {
      push('warning', `Step "${step.id}" draws a fold line but declares no folding operation.`)
    }
  })

  const cutting = modelRequiresCutting(model)
  if (cutting && !model.tools.some((tool) => MEDIUM_TOOLS.has(tool))) {
    push('error', 'Model performs cuts but lists no cutting tool.')
  }
  if (!cutting && model.tools.some((tool) => MEDIUM_TOOLS.has(tool))) {
    push('warning', 'Model lists a cutting tool but never cuts.')
  }

  if (model.adhesives.length > 0 && !modelOperations(model).some((operation) => ['glue', 'tape', 'staple'].includes(operation))) {
    push('error', 'Model lists an adhesive but no step applies it.')
  }

  if (model.validation.status === 'validated' && !model.validation.foldableByHand) {
    push('error', 'A validated model must be marked foldableByHand.')
  }

  if (model.provenance.source.trim().length === 0) {
    push('error', 'Model has no provenance source, so it cannot be audited.')
  }

  return issues
}

export function assertLibraryHealthy(entries: unknown[]): Model[] {
  const { models, issues } = parseLibrary(entries)
  const errors = issues.filter((issue) => issue.severity === 'error')
  if (errors.length > 0) {
    const detail = errors.map((issue) => `  - [${issue.modelId}] ${issue.message}`).join('\n')
    throw new Error(`Seed library failed validation:\n${detail}`)
  }
  return models
}

export const SEED_LIBRARY: Model[] = assertLibraryHealthy([
  ...BIRD_MODELS,
  ...FOLDED_MODELS,
  ...ENGINEERED_MODELS,
])

export function getModel(id: string, library: Model[] = SEED_LIBRARY): Model | undefined {
  return library.find((model) => model.id === id)
}

export function getStep(model: Model, stepId: string) {
  return model.steps.find((step) => step.id === stepId)
}

export function techniquesPresent(library: Model[] = SEED_LIBRARY): Technique[] {
  const seen: Technique[] = []
  for (const model of library) if (!seen.includes(model.technique)) seen.push(model.technique)
  return seen
}

export interface LibraryStats {
  total: number
  validated: number
  byTechnique: Array<{ technique: Technique; label: string; count: number }>
  averageSteps: number
  noToolCount: number
  noGlueCount: number
}

export function libraryStats(library: Model[] = SEED_LIBRARY): LibraryStats {
  const counts = new Map<Technique, number>()
  let steps = 0
  let noToolCount = 0
  let noGlueCount = 0
  let validatedCount = 0

  for (const model of library) {
    counts.set(model.technique, (counts.get(model.technique) ?? 0) + 1)
    steps += model.steps.length
    if (model.tools.length === 0) noToolCount += 1
    if (model.adhesives.length === 0) noGlueCount += 1
    if (model.validation.status === 'validated') validatedCount += 1
  }

  return {
    total: library.length,
    validated: validatedCount,
    byTechnique: [...counts.entries()]
      .map(([technique, count]) => ({ technique, label: TECHNIQUE_LABELS[technique], count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    averageSteps: library.length === 0 ? 0 : Math.round((steps / library.length) * 10) / 10,
    noToolCount,
    noGlueCount,
  }
}

export function searchLibrary(query: string, library: Model[] = SEED_LIBRARY): Model[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return library
  return library.filter((model) => {
    const haystack = [model.title, model.summary, model.technique, ...model.objectTags, ...model.tags]
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}

export function relatedModels(model: Model, library: Model[] = SEED_LIBRARY, limit = 3): Model[] {
  return library
    .filter((candidate) => candidate.id !== model.id)
    .map((candidate) => {
      const shared = candidate.objectTags.filter((tag) => model.objectTags.includes(tag)).length
      const sameTechnique = candidate.technique === model.technique ? 1 : 0
      const nearDifficulty = Math.abs(candidate.difficulty - model.difficulty) <= 1 ? 1 : 0
      return { candidate, score: shared * 2 + sameTechnique + nearDifficulty }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
    .slice(0, limit)
    .map((entry) => entry.candidate)
}
