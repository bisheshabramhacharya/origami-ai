import { describe, expect, it } from 'vitest'
import {
  type Model,
  SEED_LIBRARY,
  SEED_MODELS,
  auditModel,
  evaluateConstraints,
  findOptions,
  getModel,
  libraryStats,
  parseBriefHeuristic,
  relatedModels,
  searchLibrary,
  diagram,
  renderDiagram,
  sheet,
} from '../src'

const dart = () => getModel('paper-plane-dart', SEED_MODELS)!

describe('the classic paper dart in the Library', () => {
  it('is a six-Step origami Model on one sheet of US Letter printer paper', () => {
    const model = dart()
    expect(model).toBeDefined()
    expect(model.technique).toBe('origami')
    expect(model.objectTags).toEqual(expect.arrayContaining(['plane', 'airplane', 'vehicle']))
    expect(model.paper).toMatchObject({ sheets: 1, shape: 'letter', weight: 'printer' })
    expect(model.steps.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5, 6])
    expect(model.tools).toEqual([])
    expect(model.adhesives).toEqual([])
    expect(auditModel(model)).toEqual([])
  })

  it('is needs-review until a person folds it, so retrieval does not offer it and says why (ADR-0001)', () => {
    const model = dart()
    expect(model.validation.status).toBe('needs-review')
    const brief = parseBriefHeuristic('paper airplane')
    expect(findOptions(brief, SEED_LIBRARY).map((o) => o.model.id)).not.toContain('paper-plane-dart')
    const why = evaluateConstraints(model, brief)
    expect(why.excluded).toBe(true)
    expect(why.hard.join(' ')).toMatch(/not a validated/i)
  })

  it('is not in the Library that the app and the API list, search, count and open (ADR-0001)', () => {
    expect(SEED_MODELS.map((m) => m.id)).toContain('paper-plane-dart')
    expect(SEED_LIBRARY.map((m) => m.id)).not.toContain('paper-plane-dart')
    expect(SEED_LIBRARY.every((m) => m.validation.status === 'validated' && m.validation.foldableByHand)).toBe(true)
    expect(getModel('paper-plane-dart')).toBeUndefined()
    expect(searchLibrary('plane').map((m) => m.id)).not.toContain('paper-plane-dart')
    expect(libraryStats().total).toBe(SEED_MODELS.length - 1)
    for (const model of SEED_LIBRARY) expect(relatedModels(model).map((m) => m.id)).not.toContain('paper-plane-dart')
  })

  it('once a person has folded it (validated), it comes first for a paper airplane', () => {
    const folded: Model = {
      ...dart(),
      validation: { status: 'validated', checkedBy: 'a person', checkedAt: '2026-11-28', checks: ['Folded end to end'], foldableByHand: true },
    }
    const library = SEED_MODELS.map((m) => (m.id === folded.id ? folded : m))
    for (const request of ['paper airplane', 'a plane for my kid']) {
      const options = findOptions(parseBriefHeuristic(request), library)
      expect(options[0]?.model.id, request).toBe('paper-plane-dart')
    }
  })
})

describe('the dart diagrams', () => {
  it('draws the letter sheet at its true 8.5 by 11 shape, so a 45-degree crease looks like one', () => {
    const svg = renderDiagram(diagram('x', sheet('letter')))
    const m = svg.match(/M([\d.]+),([\d.]+) H([\d.]+) V([\d.]+)/)
    expect(m).not.toBeNull()
    const [x1, y1, x2, y2] = m!.slice(1).map(Number) as [number, number, number, number]
    expect((x2 - x1) / (y2 - y1)).toBeCloseTo(215.9 / 279.4, 2)
  })
})
