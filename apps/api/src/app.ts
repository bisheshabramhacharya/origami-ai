import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import {
  type Explanation,
  type ExplanationLevel,
  type Model,
  type TutorInput,
  type TutorProvider,
  BuildBriefSchema,
  HeuristicTutor,
  OPERATION_LABELS,
  SEED_LIBRARY,
  TECHNIQUE_LABELS,
  difficultyLabel,
  expandImplied,
  explainStep,
  findOptions,
  getModel,
  getStep,
  libraryStats,
  modelOperations,
  modelRequiresCutting,
  parseBriefHeuristic,
  techniquesPresent,
} from '@origami/core'
import { type LlmSettings, llmBrief, llmExplain, llmSettings, type TutorContext } from './llm'

export interface AppOptions {
  settings?: LlmSettings | null
}

function modelSummary(model: Model) {
  return {
    id: model.id,
    title: model.title,
    summary: model.summary,
    technique: model.technique,
    techniqueLabel: TECHNIQUE_LABELS[model.technique],
    objectTags: model.objectTags,
    audience: model.audience,
    difficulty: model.difficulty,
    difficultyLabel: difficultyLabel(model.difficulty),
    timeMinutes: model.timeMinutes,
    paper: model.paper,
    tools: model.tools,
    adhesives: model.adhesives,
    requiresCutting: modelRequiresCutting(model),
    stepCount: model.steps.length,
    preview: model.preview,
    tags: model.tags,
    tips: model.tips,
    provenance: model.provenance,
    validation: model.validation,
  }
}

class AnthropicTutorProvider implements TutorProvider {
  readonly name = 'llm' as const

  constructor(private readonly settings: LlmSettings) {}

  async explain(input: TutorInput): Promise<Explanation> {
    const allowed = expandImplied(modelOperations(input.model)).map((operation) => OPERATION_LABELS[operation])
    const context: TutorContext = {
      modelTitle: input.model.title,
      stepTitle: input.step.title,
      instruction: input.step.instruction,
      checkpoints: input.step.checkpoints,
      commonMistakes: input.step.commonMistakes,
      allowedOperations: allowed,
      level: input.level,
      attemptIndex: input.attemptIndex,
      question: input.question,
    }
    const text = await llmExplain(this.settings, context)
    return {
      modelId: input.model.id,
      stepId: input.step.id,
      level: input.level,
      text,
      provider: 'llm',
    }
  }
}

const BriefRequest = z.object({
  text: z.string().min(1),
  useLlm: z.boolean().optional(),
})

const OptionsRequest = z.object({
  text: z.string().min(1).optional(),
  brief: BuildBriefSchema.optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

const ExplainRequest = z.object({
  modelId: z.string().min(1),
  stepId: z.string().min(1),
  level: z.enum(['simpler', 'detail', 'analogy', 'troubleshoot', 'visual']).optional(),
  attemptIndex: z.number().int().min(0).max(20).optional(),
  question: z.string().max(500).optional(),
})

export function createApp(options: AppOptions = {}) {
  const settings = options.settings === undefined ? llmSettings() : options.settings
  const app = new Hono()

  app.use('*', cors())

  app.get('/api/health', (c) =>
    c.json({
      ok: true,
      models: SEED_LIBRARY.length,
      techniques: techniquesPresent(),
      llm: settings ? 'anthropic' : 'heuristic',
    }),
  )

  app.get('/api/library', (c) => {
    const stats = libraryStats()
    return c.json({
      stats,
      techniques: techniquesPresent().map((technique) => ({ technique, label: TECHNIQUE_LABELS[technique] })),
      models: SEED_LIBRARY.map(modelSummary),
    })
  })

  app.get('/api/library/:id', (c) => {
    const model = getModel(c.req.param('id'))
    if (!model) return c.json({ error: 'Model not found' }, 404)
    return c.json({ model, summary: modelSummary(model) })
  })

  app.post('/api/brief', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = BriefRequest.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Expected { text: string }' }, 400)

    const heuristic = parseBriefHeuristic(parsed.data.text)
    if (!settings || parsed.data.useLlm === false) {
      return c.json({ brief: heuristic, enriched: false })
    }

    const enriched = await llmBrief(settings, parsed.data.text, heuristic)
    return c.json({ brief: enriched ?? heuristic, enriched: enriched !== null })
  })

  app.post('/api/options', (c) => {
    return c.req
      .json()
      .then((body) => {
        const parsed = OptionsRequest.safeParse(body)
        if (!parsed.success) return c.json({ error: 'Expected { text } or { brief }' }, 400)

        const brief = parsed.data.brief ?? (parsed.data.text ? parseBriefHeuristic(parsed.data.text) : null)
        if (!brief) return c.json({ error: 'Provide text or a brief' }, 400)

        const options = findOptions(brief, SEED_LIBRARY, { limit: parsed.data.limit ?? 8 })
        return c.json({
          brief,
          options: options.map((option) => ({
            model: modelSummary(option.model),
            score: option.score,
            match: option.match,
            reasons: option.reasons,
            warnings: option.warnings,
          })),
        })
      })
      .catch(() => c.json({ error: 'Invalid JSON body' }, 400))
  })

  app.post('/api/explain', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = ExplainRequest.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Expected { modelId, stepId }' }, 400)

    const model = getModel(parsed.data.modelId)
    if (!model) return c.json({ error: 'Model not found' }, 404)
    const step = getStep(model, parsed.data.stepId)
    if (!step) return c.json({ error: 'Step not found' }, 404)

    const input: TutorInput = {
      model,
      step,
      level: (parsed.data.level ?? 'detail') as ExplanationLevel,
      attemptIndex: parsed.data.attemptIndex ?? 0,
      question: parsed.data.question,
    }

    const primary: TutorProvider = settings ? new AnthropicTutorProvider(settings) : new HeuristicTutor()

    try {
      const result = await explainStep(input, primary)
      return c.json({
        explanation: result.explanation,
        grounding: result.grounding,
        rejected: result.rejected ?? null,
      })
    } catch (error) {
      const result = await explainStep(input, new HeuristicTutor())
      return c.json({
        explanation: result.explanation,
        grounding: result.grounding,
        rejected: null,
        note: `Model provider unavailable, used the offline tutor (${(error as Error).message}).`,
      })
    }
  })

  return app
}

export const app = createApp()
