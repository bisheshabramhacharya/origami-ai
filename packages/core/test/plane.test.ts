import { describe, expect, it } from 'vitest'
import { type Model, SEED_LIBRARY, auditFoldSequence, auditModel, evaluateConstraints, findOptions, foldedStateForStep, getModel, parseBriefHeuristic, stepPlayback } from '../src'

const dart = () => getModel('paper-plane-dart')!

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

  it('once a person has folded it (validated), it comes first for a paper airplane', () => {
    const folded: Model = {
      ...dart(),
      validation: { status: 'validated', checkedBy: 'a person', checkedAt: '2026-11-28', checks: ['Folded end to end'], foldableByHand: true },
    }
    const library = SEED_LIBRARY.map((m) => (m.id === folded.id ? folded : m))
    for (const request of ['paper airplane', 'a plane for my kid']) {
      const options = findOptions(parseBriefHeuristic(request), library)
      expect(options[0]?.model.id, request).toBe('paper-plane-dart')
    }
  })
})

describe("the dart's fold sequence", () => {
  it('passes the engine and the grounded check for Steps 1 to 5', () => {
    const model = dart()
    expect(auditFoldSequence(model)).toEqual([])
    for (const id of ['dart-1', 'dart-2', 'dart-3', 'dart-4', 'dart-5']) {
      expect(foldedStateForStep(model, id), id).not.toBeNull()
      const playback = stepPlayback(model, id)
      expect(playback?.motions.length, id).toBeGreaterThan(0)
    }
  })

  it('fails the grounded check when Step 4 does not declare its mountain fold', () => {
    const model = dart()
    const broken: Model = { ...model, steps: model.steps.map((s) => (s.id === 'dart-4' ? { ...s, operations: ['press-flat'] } : s)) }
    const messages = auditFoldSequence(broken).map((issue) => issue.message)
    expect(messages).toEqual([expect.stringContaining('"mountain-fold"')])
  })
})
