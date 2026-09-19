import { describe, expect, it } from 'vitest'
import {
  SEED_LIBRARY,
  auditModel,
  getModel,
  libraryStats,
  modelOperations,
  modelRequiresCutting,
  parseLibrary,
  searchLibrary,
  techniquesPresent,
} from '../src'

describe('seed library', () => {
  it('loads without errors, because a broken model must never reach a learner', () => {
    const { issues } = parseLibrary(SEED_LIBRARY)
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('gives every model provenance and a validation record', () => {
    for (const model of SEED_LIBRARY) {
      expect(model.provenance.source.length, model.id).toBeGreaterThan(0)
      expect(model.provenance.license.length, model.id).toBeGreaterThan(0)
      expect(model.validation.checkedBy.length, model.id).toBeGreaterThan(0)
      expect(model.validation.checks.length, model.id).toBeGreaterThan(0)
    }
  })

  it('has contiguous step ordinals starting at one', () => {
    for (const model of SEED_LIBRARY) {
      expect(model.steps.map((step) => step.ordinal), model.id).toEqual(
        model.steps.map((_, index) => index + 1),
      )
    }
  })

  it('covers more than one technique so the app is not a single-trick pony', () => {
    expect(techniquesPresent().length).toBeGreaterThanOrEqual(6)
  })

  it('offers at least three models that need no tools at all', () => {
    const stats = libraryStats()
    expect(stats.noToolCount).toBeGreaterThanOrEqual(3)
  })

  it('indexes models by id', () => {
    expect(getModel('origami-crane')?.title).toBe('Classic origami crane')
    expect(getModel('does-not-exist')).toBeUndefined()
  })

  it('searches across titles, tags and techniques', () => {
    expect(searchLibrary('crane').map((model) => model.id)).toContain('origami-crane')
    expect(searchLibrary('kirigami').map((model) => model.id)).toContain('kirigami-snowflake')
    expect(searchLibrary('').length).toBe(SEED_LIBRARY.length)
  })
})

describe('library audit', () => {
  it('rejects a model whose step ordinals skip a number', () => {
    const crane = getModel('origami-crane')!
    const broken = { ...crane, steps: crane.steps.map((step, index) => (index === 2 ? { ...step, ordinal: 9 } : step)) }
    const errors = auditModel(broken).filter((issue) => issue.severity === 'error')
    expect(errors.some((issue) => issue.message.includes('ordinal'))).toBe(true)
  })

  it('rejects a model that cuts but declares no cutting tool', () => {
    const snowflake = getModel('kirigami-snowflake')!
    const broken = { ...snowflake, tools: [] as typeof snowflake.tools }
    const errors = auditModel(broken).filter((issue) => issue.severity === 'error')
    expect(errors.some((issue) => issue.message.includes('no cutting tool'))).toBe(true)
  })

  it('rejects a model that lists glue but never glues anything', () => {
    const bird = getModel('papercraft-bird')!
    const broken = {
      ...bird,
      steps: bird.steps.map((step) => ({
        ...step,
        operations: step.operations.filter((operation) => operation !== 'glue' && operation !== 'tape' && operation !== 'staple'),
      })),
    }
    const errors = auditModel(broken).filter((issue) => issue.severity === 'error')
    expect(errors.some((issue) => issue.message.includes('no step applies it'))).toBe(true)
  })

  it('rejects duplicate model ids through the schema parse', () => {
    const crane = getModel('origami-crane')!
    const { issues } = parseLibrary([crane, crane])
    expect(issues.some((issue) => issue.message.includes('Duplicate model id'))).toBe(true)
  })

  it('reports schema errors instead of dropping them silently', () => {
    const { issues } = parseLibrary([{ id: 'junk' }])
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true)
  })
})

describe('derived model facts', () => {
  it('knows which models need a cutting tool', () => {
    expect(modelRequiresCutting(getModel('papercraft-bird')!)).toBe(true)
    expect(modelRequiresCutting(getModel('origami-heart')!)).toBe(false)
  })

  it('collects the operations a model can perform', () => {
    const operations = modelOperations(getModel('origami-heart')!)
    expect(operations).toContain('valley-fold')
    expect(operations).not.toContain('cut')
  })
})
