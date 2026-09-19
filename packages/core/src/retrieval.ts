import type { BuildBrief, Model, PaperWeight, RankedOption, Technique } from './types'

export interface FindOptionsConfig {
  limit?: number
  minResults?: number
}

const WEIGHTS = {
  object: 0.38,
  difficulty: 0.2,
  time: 0.14,
  material: 0.14,
  audience: 0.09,
  simplicity: 0.05,
} as const

const PAPER_CAPABILITY: Record<PaperWeight, PaperWeight[]> = {
  printer: ['printer'],
  copy: ['copy', 'printer'],
  cardstock: ['cardstock'],
  kami: ['kami', 'printer', 'copy'],
  'tissue-foil': ['tissue-foil', 'kami', 'printer', 'copy'],
  kraft: ['kraft', 'cardstock', 'printer', 'copy'],
  any: ['printer', 'copy', 'cardstock', 'kami', 'tissue-foil', 'kraft'],
}

const MEDIUM_TOOLS = new Set(['scissors', 'craft-knife'])

export function normalizeTag(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.endsWith('ies') && trimmed.length > 4) return `${trimmed.slice(0, -3)}y`
  if (trimmed.endsWith('s') && !trimmed.endsWith('ss') && trimmed.length > 3) return trimmed.slice(0, -1)
  return trimmed
}

export function paperCompatible(modelWeight: PaperWeight, available: PaperWeight[]): boolean {
  if (available.length === 0) return true
  if (modelWeight === 'any') return true
  return available.some((weight) => PAPER_CAPABILITY[weight].includes(modelWeight))
}

export function isRetrievable(model: Model): boolean {
  return model.validation.status === 'validated' && model.validation.foldableByHand
}

export interface ExclusionResult {
  excluded: boolean
  hard: string[]
  soft: string[]
}

export function evaluateConstraints(model: Model, brief: BuildBrief): ExclusionResult {
  const c = brief.constraints
  const hard: string[] = []
  const soft: string[] = []

  if (!isRetrievable(model)) {
    hard.push(`Not a validated, hand-foldable model yet (${model.validation.status}).`)
  }
  if (c.techniquesExcluded.includes(model.technique)) {
    hard.push(`You ruled out ${model.technique}.`)
  }
  if (c.techniquesAllowed.length > 0 && !c.techniquesAllowed.includes(model.technique)) {
    hard.push(`Outside the techniques you asked for.`)
  }
  if (c.noScissors && model.tools.some((tool) => MEDIUM_TOOLS.has(tool))) {
    hard.push('Needs scissors or a craft knife.')
  }
  if (c.noGlue && model.adhesives.length > 0) {
    hard.push('Needs glue or tape.')
  }
  if (c.noPrinter && model.tools.includes('printer')) {
    hard.push('Needs a printer.')
  }
  if (model.paper.sheets > c.sheetsMax) {
    hard.push(`Needs ${model.paper.sheets} sheets, you allowed ${c.sheetsMax}.`)
  }

  if (!paperCompatible(model.paper.weight, c.paperWeights)) {
    soft.push(`Wants ${model.paper.weight} paper, you have ${c.paperWeights.join(', ')}.`)
  }
  if (model.difficulty > c.difficultyMax) {
    soft.push(`Difficulty ${model.difficulty} is above your limit of ${c.difficultyMax}.`)
  }
  if (model.timeMinutes.max > c.timeMinutesMax) {
    soft.push(`Can take up to ${model.timeMinutes.max} minutes.`)
  }

  return { excluded: hard.length > 0, hard, soft }
}

export function scoreObjectRelevance(model: Model, brief: BuildBrief): number {
  const modelTags = new Set([
    ...model.objectTags.map(normalizeTag),
    ...model.tags.map(normalizeTag),
  ])
  const titleLower = model.title.toLowerCase()
  const summaryLower = model.summary.toLowerCase()
  const labelTag = normalizeTag(brief.objectLabel)

  let best = 0
  brief.objectTags.forEach((rawTag, index) => {
    const tag = normalizeTag(rawTag)
    let similarity = 0
    if (modelTags.has(tag)) {
      similarity = 1
    } else if ([...modelTags].some((candidate) => candidate.includes(tag) || tag.includes(candidate))) {
      similarity = 0.55
    }
    // The first tag is the object itself; later tags are broader categories, so they
    // count for progressively less. A frog shares "animal" with a bird but is not a bird.
    const weight = 1 / (1 + index * 1.2)
    best = Math.max(best, similarity * weight)
  })

  if (best < 1 && titleLower.includes(labelTag)) best = Math.max(best, 0.85)
  if (best < 0.55 && summaryLower.includes(labelTag)) best = Math.max(best, 0.4)
  return best
}

function scoreDifficulty(model: Model, brief: BuildBrief): number {
  const ceiling = Math.min(brief.constraints.difficultyMax, 5)
  const ideal = Math.max(1, ceiling - 1)
  const distance = Math.abs(model.difficulty - ideal)
  return Math.max(0, 1 - distance / 4)
}

function scoreTime(model: Model, brief: BuildBrief): number {
  const budget = brief.constraints.timeMinutesMax
  if (model.timeMinutes.max <= budget) return 1
  const overrun = model.timeMinutes.max - budget
  return Math.max(0, 1 - overrun / budget)
}

function scoreMaterial(model: Model, brief: BuildBrief): number {
  const c = brief.constraints
  let score = 1
  if (!paperCompatible(model.paper.weight, c.paperWeights)) score -= 0.5
  if (model.paper.sheets > c.sheetsMax) score -= 0.3
  if (c.noScissors && model.tools.some((tool) => MEDIUM_TOOLS.has(tool))) score -= 0.5
  if (c.noGlue && model.adhesives.length > 0) score -= 0.4
  return Math.max(0, score)
}

function scoreAudience(model: Model, brief: BuildBrief): number {
  const beginnerish = brief.constraints.difficultyMax <= 2
  if (!beginnerish) return 0.7
  if (model.audience.includes('child') || model.audience.includes('beginner')) return 1
  if (model.audience.includes('intermediate')) return 0.45
  return 0.15
}

function scoreSimplicity(model: Model): number {
  const steps = model.steps.length
  return Math.max(0, 1 - Math.max(0, steps - 8) / 40)
}

function matchLabel(score: number, softIssues: string[]): RankedOption['match'] {
  if (score >= 0.72 && softIssues.length === 0) return 'great'
  if (score >= 0.5) return 'good'
  return 'stretch'
}

function buildReasons(model: Model, brief: BuildBrief, parts: Record<string, number>): string[] {
  const reasons: string[] = []
  if (parts.object >= 0.85) reasons.push(`Directly matches "${brief.objectLabel}".`)
  else if (parts.object >= 0.4) reasons.push(`Related to "${brief.objectLabel}".`)

  if (model.difficulty <= brief.constraints.difficultyMax) {
    reasons.push(`Difficulty ${model.difficulty} fits your ceiling of ${brief.constraints.difficultyMax}.`)
  }
  if (model.timeMinutes.max <= brief.constraints.timeMinutesMax) {
    reasons.push(`Finishes inside ${brief.constraints.timeMinutesMax} minutes (${model.timeMinutes.min}-${model.timeMinutes.max} min).`)
  }
  if (brief.constraints.noGlue && model.adhesives.length === 0) reasons.push('No glue or tape needed.')
  if (brief.constraints.noScissors && !model.tools.some((tool) => MEDIUM_TOOLS.has(tool))) reasons.push('No cutting needed.')
  if (model.paper.sheets === 1 && brief.constraints.sheetsMax === 1) reasons.push('Uses a single sheet.')
  if (model.audience.includes('beginner') && brief.constraints.difficultyMax <= 2) reasons.push('Written for beginners.')
  return reasons.slice(0, 4)
}

function scoreModel(model: Model, brief: BuildBrief): RankedOption {
  const parts = {
    object: scoreObjectRelevance(model, brief),
    difficulty: scoreDifficulty(model, brief),
    time: scoreTime(model, brief),
    material: scoreMaterial(model, brief),
    audience: scoreAudience(model, brief),
    simplicity: scoreSimplicity(model),
  }
  const raw =
    parts.object * WEIGHTS.object +
    parts.difficulty * WEIGHTS.difficulty +
    parts.time * WEIGHTS.time +
    parts.material * WEIGHTS.material +
    parts.audience * WEIGHTS.audience +
    parts.simplicity * WEIGHTS.simplicity
  const score = Math.round(raw * 1000) / 10

  const evaluation = evaluateConstraints(model, brief)
  return {
    model,
    score,
    match: matchLabel(raw, evaluation.soft),
    reasons: buildReasons(model, brief, parts),
    warnings: evaluation.soft,
  }
}

export function findOptions(brief: BuildBrief, library: Model[], config: FindOptionsConfig = {}): RankedOption[] {
  const limit = config.limit ?? 8
  const minResults = config.minResults ?? 3
  const ceiling = brief.constraints.difficultyMax
  const budget = brief.constraints.timeMinutesMax

  const scored = library
    .filter((model) => !evaluateConstraints(model, brief).excluded)
    .map((model) => scoreModel(model, brief))

  const tiers: RankedOption[][] = [
    scored.filter((option) => option.model.difficulty <= ceiling && option.model.timeMinutes.max <= budget),
    scored.filter((option) => option.model.difficulty <= ceiling),
    scored.filter((option) => option.model.difficulty <= ceiling + 1),
  ]

  const chosen = tiers.find((tier) => tier.length >= minResults) ?? tiers[tiers.length - 1] ?? []
  return chosen.sort(byScoreDesc).slice(0, limit)
}

function byScoreDesc(a: RankedOption, b: RankedOption): number {
  if (b.score !== a.score) return b.score - a.score
  const difficultyDelta = a.model.difficulty - b.model.difficulty
  if (difficultyDelta !== 0) return difficultyDelta
  return a.model.id.localeCompare(b.model.id)
}

export function techniqueCoverage(options: RankedOption[]): Technique[] {
  const seen: Technique[] = []
  for (const option of options) {
    if (!seen.includes(option.model.technique)) seen.push(option.model.technique)
  }
  return seen
}

export function topPick(options: RankedOption[]): RankedOption | undefined {
  return options[0]
}
