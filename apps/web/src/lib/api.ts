import {
  type BuildBrief,
  type Explanation,
  type ExplanationLevel,
  type GroundingReport,
  type Model,
  type Step,
  HeuristicTutor,
  explainStep,
} from '@origami/core'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const TIMEOUT_MS = 12_000

export interface Health {
  ok: boolean
  models: number
  llm: string
}

export interface ExplainResult {
  explanation: Explanation
  grounding: GroundingReport
  rejected: { explanation: Explanation; grounding: GroundingReport } | null
  note?: string
  source: 'api' | 'offline'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`${path} responded ${response.status}`)
  return (await response.json()) as T
}

export async function getHealth(): Promise<Health | null> {
  try {
    return await request<Health>('/api/health')
  } catch {
    return null
  }
}

/**
 * The API only ever refines the local result. If it is unreachable, slow, or returns
 * something we cannot trust, the local brief is already good enough to keep going.
 */
export async function refineBrief(text: string): Promise<{ brief: BuildBrief; enriched: boolean } | null> {
  try {
    return await request<{ brief: BuildBrief; enriched: boolean }>('/api/brief', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  } catch {
    return null
  }
}

export async function explain(input: {
  model: Model
  step: Step
  level: ExplanationLevel
  attemptIndex: number
}): Promise<ExplainResult> {
  try {
    const payload = await request<{
      explanation: Explanation
      grounding: GroundingReport
      rejected: { explanation: Explanation; grounding: GroundingReport } | null
      note?: string
    }>('/api/explain', {
      method: 'POST',
      body: JSON.stringify({
        modelId: input.model.id,
        stepId: input.step.id,
        level: input.level,
        attemptIndex: input.attemptIndex,
      }),
    })
    return { ...payload, source: 'api' }
  } catch {
    const result = await explainStep(input, new HeuristicTutor())
    return {
      explanation: result.explanation,
      grounding: result.grounding,
      rejected: result.rejected ?? null,
      source: 'offline',
    }
  }
}
