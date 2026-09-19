import { describe, expect, it } from 'vitest'
import {
  HeuristicTutor,
  SEED_LIBRARY,
  type ExplanationLevel,
  checkGrounding,
  explainStep,
  findOptions,
  getModel,
  getStep,
  nextLevel,
  parseBriefHeuristic,
  relatedModels,
  renderDiagram,
  searchLibrary,
} from '../src'

const REQUEST = 'I want to make a bird. I am a beginner and only have printer paper.'

describe('the core product loop', () => {
  it('goes from a typed request all the way to a finished, explained build', async () => {
    const brief = parseBriefHeuristic(REQUEST)
    expect(brief.objectLabel).toBe('bird')

    const options = findOptions(brief, SEED_LIBRARY)
    expect(options.length).toBeGreaterThan(1)

    const chosen = options[0]!
    expect(chosen.model.validation.status).toBe('validated')
    expect(chosen.model.steps.length).toBeGreaterThan(3)

    const tutor = new HeuristicTutor()
    const walked: string[] = []
    for (const step of chosen.model.steps) {
      const result = await explainStep({ model: chosen.model, step, level: 'detail', attemptIndex: 0 }, tutor)
      expect(result.grounding.ok, `${chosen.model.id}/${step.id}`).toBe(true)
      walked.push(step.id)
    }

    expect(walked).toEqual(chosen.model.steps.map((step) => step.id))
  })

  it('lets the learner get stuck on any step and get a grounded explanation at each level', async () => {
    const brief = parseBriefHeuristic(REQUEST)
    const chosen = findOptions(brief, SEED_LIBRARY)[0]!
    const step = chosen.model.steps[2]!
    const tutor = new HeuristicTutor()

    const levels: ExplanationLevel[] = ['simpler', 'visual', 'analogy', 'troubleshoot', 'detail']
    const texts = new Set<string>()

    for (const level of levels) {
      const result = await explainStep({ model: chosen.model, step, level, attemptIndex: 0 }, tutor)
      expect(result.grounding.ok, level).toBe(true)
      expect(result.explanation.text.length).toBeGreaterThan(0)
      texts.add(result.explanation.text)
    }

    expect(texts.size).toBeGreaterThanOrEqual(4)
  })

  it('keeps offering a fresh angle when the learner says they are still stuck', async () => {
    const model = getModel('origami-crane')!
    const step = model.steps[7]!
    const tutor = new HeuristicTutor()

    const seen: string[] = []
    let level: ExplanationLevel = 'troubleshoot'
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await explainStep({ model, step, level, attemptIndex: attempt }, tutor)
      expect(result.grounding.ok, `attempt ${attempt}`).toBe(true)
      seen.push(result.explanation.text)
      level = nextLevel(level, attempt + 1)
    }

    expect(new Set(seen).size).toBeGreaterThanOrEqual(3)
  })

  it('renders a usable diagram for every step a learner will be shown', () => {
    for (const model of SEED_LIBRARY) {
      const svg = renderDiagram(model.preview)
      expect(svg, model.id).toContain('<svg')
      for (const step of model.steps) {
        const stepSvg = renderDiagram(step.diagram)
        expect(stepSvg, `${model.id}/${step.id}`).toContain('<svg')
        expect(stepSvg, `${model.id}/${step.id}`).toContain('100 100')
      }
    }
  })
})

describe('switching models mid-build', () => {
  it('offers related models when someone wants a different take', () => {
    const crane = getModel('origami-crane')!
    const related = relatedModels(crane, SEED_LIBRARY)
    expect(related.length).toBeGreaterThan(0)
    expect(related.map((model) => model.id)).not.toContain(crane.id)
    expect(related.every((model) => model.validation.status === 'validated')).toBe(true)
  })

  it('finds a model by id and its steps by ordinal', () => {
    const model = getModel('kirigami-snowflake')!
    const step = getStep(model, 'snow-3')!
    expect(step.ordinal).toBe(3)
    expect(getStep(model, 'nope')).toBeUndefined()
  })

  it('lets someone browse the library without typing a request', () => {
    expect(searchLibrary('pop-up', SEED_LIBRARY).map((model) => model.id)).toContain('popup-flower-card')
    expect(searchLibrary('cube', SEED_LIBRARY).map((model) => model.id)).toContain('modular-cube')
  })
})

describe('the promise that matters', () => {
  it('never lets an unvalidated model reach a learner through any path', () => {
    const brief = parseBriefHeuristic('make me anything')
    for (const option of findOptions(brief, SEED_LIBRARY, { limit: 100 })) {
      expect(option.model.validation.status, option.model.id).toBe('validated')
      expect(option.model.validation.foldableByHand, option.model.id).toBe(true)
    }
  })

  it('produces no explanation anywhere in the library that names a fold the model cannot do', async () => {
    const tutor = new HeuristicTutor()
    for (const model of SEED_LIBRARY) {
      for (const step of model.steps) {
        for (const level of ['simpler', 'detail', 'analogy', 'troubleshoot', 'visual'] as ExplanationLevel[]) {
          for (const attemptIndex of [0, 1, 2]) {
            const result = await explainStep({ model, step, level, attemptIndex }, tutor)
            const report = checkGrounding(result.explanation.text, model)
            expect(report.ok, `${model.id}/${step.id}/${level}/${attemptIndex}: ${result.explanation.text}`).toBe(true)
          }
        }
      }
    }
  })
})
