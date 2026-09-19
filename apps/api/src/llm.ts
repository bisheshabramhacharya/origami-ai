import {
  type BuildBrief,
  BuildBriefSchema,
  mergeBrief,
} from '@origami/core'

const DEFAULT_MODEL = 'claude-sonnet-4-5'
const ANTHROPIC_VERSION = '2023-06-01'

export interface LlmSettings {
  apiKey: string
  model: string
}

export function llmSettings(): LlmSettings | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return { apiKey, model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL }
}

async function callAnthropic(settings: LlmSettings, system: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic request failed with ${response.status}`)
  }

  const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = (payload.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n')
    .trim()

  if (text.length === 0) throw new Error('Anthropic returned no text')
  return text
}

export type TutorLevel = 'simpler' | 'detail' | 'analogy' | 'troubleshoot' | 'visual'

export interface TutorContext {
  modelTitle: string
  stepTitle: string
  instruction: string
  checkpoints: string[]
  commonMistakes: string[]
  allowedOperations: string[]
  level: TutorLevel
  attemptIndex: number
  question?: string
}

const LEVEL_BRIEFS: Record<TutorLevel, string> = {
  simpler: 'Strip it to one action. Shortest possible sentence, plain words, no jargon.',
  detail: 'Give the full explanation, ending with a check the learner can perform.',
  analogy: 'Explain it through an everyday comparison, then give the concrete action.',
  troubleshoot: 'Assume they tried and it went wrong. Name the likely slip and what to check.',
  visual: 'Describe what the diagram shows - which line is which, which way the arrow points - then the action.',
}

export function buildTutorPrompts(context: TutorContext): { system: string; prompt: string } {
  const system = [
    'You are a patient paper-crafting tutor inside an app called Origami AI.',
    `The learner is building "${context.modelTitle}" and is on the step "${context.stepTitle}".`,
    '',
    'HARD RULES YOU MUST FOLLOW:',
    `- You may only refer to these operations: ${context.allowedOperations.join(', ')}.`,
    '- Never invent a fold, cut or glued joint that is not in that list.',
    '- Never tell the learner to do something physically impossible with paper.',
    '- Never introduce a new step, a new model, or a shortcut that changes the design.',
    '- If the learner asks for something this model does not do, say so plainly and point back to this step.',
    '- Keep it short: three or four sentences at most.',
  ].join('\n')

  const prompt = [
    `Step instruction: ${context.instruction}`,
    context.checkpoints.length > 0 ? `Success checkpoints: ${context.checkpoints.join('; ')}` : '',
    context.commonMistakes.length > 0 ? `Common mistakes: ${context.commonMistakes.join('; ')}` : '',
    '',
    `How to answer: ${LEVEL_BRIEFS[context.level]}`,
    context.question ? `The learner asked: ${context.question}` : '',
    context.attemptIndex > 0 ? `This is attempt ${context.attemptIndex + 1}; they are still stuck, so change your angle.` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return { system, prompt }
}

export async function llmExplain(settings: LlmSettings, context: TutorContext): Promise<string> {
  const { system, prompt } = buildTutorPrompts(context)
  return callAnthropic(settings, system, prompt, 400)
}

const BRIEF_SYSTEM = [
  'You read a paper-crafting request and return structured JSON.',
  'Return ONLY a JSON object. No prose, no markdown fences.',
  'Shape: {"objectLabel": string, "objectTags": string[], "difficultyMax": 1-5, "timeMinutesMax": number, "sheetsMax": number, "noScissors": boolean, "noGlue": boolean, "noPrinter": boolean, "paperWeights": string[], "notes": string[]}',
  'paperWeights may only contain: printer, copy, cardstock, kami, tissue-foil, kraft, any.',
  'objectTags should list the object plus synonyms a model library might be tagged with.',
  'Only state what the request actually implies. Do not invent constraints.',
].join('\n')

const PAPER_WEIGHTS = ['printer', 'copy', 'cardstock', 'kami', 'tissue-foil', 'kraft', 'any'] as const

function pickPaper(input: unknown): BuildBrief['constraints']['paperWeights'] {
  if (!Array.isArray(input)) return []
  return PAPER_WEIGHTS.filter((weight) => input.includes(weight))
}

function num(input: unknown, min: number, max: number): number | undefined {
  if (typeof input !== 'number' || !Number.isFinite(input)) return undefined
  return Math.min(max, Math.max(min, Math.round(input)))
}

function bool(input: unknown): boolean | undefined {
  return typeof input === 'boolean' ? input : undefined
}

/**
 * Best-effort enrichment. Anything malformed or partial is dropped rather than trusted,
 * and the heuristic brief stays the floor.
 */
export async function llmBrief(settings: LlmSettings, rawText: string, base: BuildBrief): Promise<BuildBrief | null> {
  let text: string
  try {
    text = await callAnthropic(settings, BRIEF_SYSTEM, rawText, 500)
  } catch {
    return null
  }

  const jsonText = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const raw = parsed as Record<string, unknown>
  const objectLabel = typeof raw.objectLabel === 'string' ? raw.objectLabel.trim().toLowerCase() : ''
  const objectTags = Array.isArray(raw.objectTags)
    ? raw.objectTags
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim().toLowerCase())
    : []
  const notes = Array.isArray(raw.notes) ? raw.notes.filter((note): note is string => typeof note === 'string') : []
  const paperWeights = pickPaper(raw.paperWeights)

  if (objectLabel.length === 0 && objectTags.length === 0) return null

  const candidate = {
    ...base,
    objectLabel: objectLabel.length > 0 ? objectLabel : base.objectLabel,
    objectTags: objectTags.length > 0 ? [...new Set([...objectTags, ...base.objectTags])] : base.objectTags,
    constraints: {
      ...base.constraints,
      difficultyMax: num(raw.difficultyMax, 1, 5) ?? base.constraints.difficultyMax,
      timeMinutesMax: num(raw.timeMinutesMax, 5, 600) ?? base.constraints.timeMinutesMax,
      sheetsMax: num(raw.sheetsMax, 1, 100) ?? base.constraints.sheetsMax,
      noScissors: bool(raw.noScissors) ?? base.constraints.noScissors,
      noGlue: bool(raw.noGlue) ?? base.constraints.noGlue,
      noPrinter: bool(raw.noPrinter) ?? base.constraints.noPrinter,
      paperWeights: paperWeights.length > 0 ? paperWeights : base.constraints.paperWeights,
    },
    notes: [...base.notes, ...notes],
    confidence: Math.max(base.confidence, 0.9),
    source: 'llm' as const,
  }

  const result = BuildBriefSchema.safeParse(candidate)
  if (!result.success) return null
  return mergeBrief(base, result.data)
}
