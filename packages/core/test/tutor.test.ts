import { describe, expect, it } from 'vitest'
import {
  HeuristicTutor,
  type ExplanationLevel,
  SEED_LIBRARY,
  checkGrounding,
  describeDiagram,
  explainStep,
  getModel,
  heuristicText,
  nextLevel,
  type TutorProvider,
} from '../src'

const heart = getModel('origami-heart')!
const heartStep = heart.steps[0]!
const LEVELS: ExplanationLevel[] = ['simpler', 'detail', 'analogy', 'troubleshoot', 'visual']

const liar: TutorProvider = {
  name: 'llm',
  async explain(input) {
    return {
      modelId: input.model.id,
      stepId: input.step.id,
      level: input.level,
      text: 'Now petal fold the flap and glue it down.',
      provider: 'llm',
    }
  },
}

const honest: TutorProvider = {
  name: 'llm',
  async explain(input) {
    return {
      modelId: input.model.id,
      stepId: input.step.id,
      level: input.level,
      text: 'Valley fold the top corner down to the centre and press it flat.',
      provider: 'llm',
    }
  },
}

describe('the offline tutor', () => {
  it('explains a step at every level', async () => {
    const tutor = new HeuristicTutor()
    for (const level of LEVELS) {
      const explanation = await tutor.explain({ model: heart, step: heartStep, level, attemptIndex: 0 })
      expect(explanation.text.length, level).toBeGreaterThan(10)
      expect(explanation.level).toBe(level)
      expect(explanation.provider).toBe('heuristic')
    }
  })

  it('gives a different angle at each level, rather than the same sentence relabelled', () => {
    const texts = LEVELS.map((level) => heuristicText({ model: heart, step: heartStep, level, attemptIndex: 0 }))
    expect(new Set(texts).size).toBeGreaterThanOrEqual(4)
  })

  it('changes what it says when the learner is still stuck', () => {
    const first = heuristicText({ model: heart, step: heartStep, level: 'troubleshoot', attemptIndex: 0 })
    const second = heuristicText({ model: heart, step: heartStep, level: 'troubleshoot', attemptIndex: 1 })
    expect(first).not.toBe(second)
  })

  it('describes what is actually drawn, not a generic diagram', () => {
    const description = describeDiagram(heartStep.diagram)
    expect(description.length).toBeGreaterThan(10)
    expect(description.toLowerCase()).toContain('line')
  })
})

describe('explaining without inventing folds', () => {
  it('accepts an honest explanation and reports it as grounded', async () => {
    const result = await explainStep({ model: heart, step: heartStep, level: 'detail', attemptIndex: 0 }, honest)
    expect(result.grounding.ok).toBe(true)
    expect(result.rejected).toBeUndefined()
    expect(result.explanation.provider).toBe('llm')
  })

  it('throws away an explanation that invents a fold and falls back to a safe one', async () => {
    const result = await explainStep({ model: heart, step: heartStep, level: 'detail', attemptIndex: 0 }, liar)
    expect(result.explanation.provider).toBe('heuristic')
    expect(result.grounding.ok).toBe(true)
    expect(result.rejected).toBeDefined()
    expect(result.rejected?.grounding.ok).toBe(false)
    expect(result.rejected?.grounding.violations.map((violation) => violation.operation)).toContain('petal-fold')
  })

  it('never lets an ungrounded sentence reach the learner', async () => {
    for (const model of SEED_LIBRARY) {
      for (const step of model.steps) {
        const result = await explainStep({ model, step, level: 'detail', attemptIndex: 0 }, liar)
        expect(result.grounding.ok, `${model.id}/${step.id}`).toBe(true)
      }
    }
  })
})

describe('the safety net across the whole library', () => {
  it('produces a grounded explanation for every step of every model at every level', async () => {
    const tutor = new HeuristicTutor()
    for (const model of SEED_LIBRARY) {
      for (const step of model.steps) {
        for (const level of LEVELS) {
          const explanation = await tutor.explain({ model, step, level, attemptIndex: 1 })
          const report = checkGrounding(explanation.text, model)
          expect(report.ok, `${model.id}/${step.id}/${level}: ${explanation.text}`).toBe(true)
        }
      }
    }
  })
})

describe('cycling through explanations', () => {
  it('moves on to a different level each time the learner asks again', () => {
    const seen = [0, 1, 2].map((attempt) => nextLevel('simpler', attempt))
    expect(new Set(seen).size).toBe(3)
  })
})
