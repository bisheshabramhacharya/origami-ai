import { describe, expect, it } from 'vitest'
import { checkState, outline } from '@origami/fold'
import {
  SEED_LIBRARY,
  type Model,
  auditFoldSequence,
  auditLibrary,
  foldModel,
  foldedStateBeforeStep,
  foldedStateForStep,
  foldedStates,
  getModel,
  hasFoldSequence,
} from '../src'

const crane = getModel('origami-crane')!

const area = (pts: Array<{ x: number; y: number }>) =>
  Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * p.y, 0)) / 2

describe('fold sequences on Models', () => {
  it('the crane has a fold sequence and passes the Library audit with it', () => {
    expect(hasFoldSequence(crane)).toBe(true)
    expect(auditLibrary(SEED_LIBRARY).issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(foldModel(crane)?.ok).toBe(true)
  })

  it('gives the folded state for each of the crane Steps 1 to 4', () => {
    const states = foldedStates(crane)
    for (const id of ['crane-1', 'crane-2', 'crane-3', 'crane-4']) expect(states.has(id), id).toBe(true)
    const step4 = foldedStateForStep(crane, 'crane-4')!
    // Still a flat 150 mm square, now with four creases through the centre.
    expect(area(outline(step4))).toBeCloseTo(150 * 150, 6)
    const named = new Set(step4.edges.flatMap((e) => e.creases))
    expect([...named].sort()).toEqual(['b1', 'b2', 'd1', 'd2'])
    expect(step4.edges.filter((e) => e.creases.length > 0).every((e) => e.assignment === 'F')).toBe(true)
    // Turned over: the white side faces the learner.
    expect(step4.faceSides.every((s) => s === -1)).toBe(true)
    expect(foldedStateBeforeStep(crane, 'crane-1')!.faces).toHaveLength(1)
  })

  it('fails the audit for a Model whose fold sequence has an impossible fold', () => {
    const broken: Model = {
      ...crane,
      foldSequence: {
        paper: { widthMm: 150, heightMm: 150 },
        steps: [
          { step: 'crane-1', actions: [] },
          {
            step: 'crane-2',
            actions: [
              { kind: 'valley', name: 'd1', line: { bring: 'B', to: 'D' }, layers: 'all', degrees: 180 },
              { kind: 'unfold', creases: ['d1'] },
              { kind: 'valley', name: 'd2', line: { bring: 'A', to: 'C' }, layers: 'all', degrees: 180 },
              { kind: 'unfold', creases: ['d2'] },
              // Both diagonals as valleys at once cannot fold flat.
              { kind: 'collapse', set: [{ crease: 'd1', assignment: 'V' }, { crease: 'd2', assignment: 'V' }] },
            ],
          },
        ],
      },
    }
    const errors = auditLibrary([broken]).issues.filter((issue) => issue.severity === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0]!.message).toContain('Step crane-2, action 5')
  })

  it('fails the audit when a fold sequence names a Step the Model does not have', () => {
    const broken: Model = { ...crane, foldSequence: { paper: { widthMm: 150, heightMm: 150 }, steps: [{ step: 'crane-99', actions: [] }] } }
    expect(auditFoldSequence(broken).some((issue) => issue.message.includes('crane-99'))).toBe(true)
  })

  it('invariant: every Model with a fold sequence gives one checked state per fold Step and no failed check', () => {
    for (const model of SEED_LIBRARY.filter(hasFoldSequence)) {
      const result = foldModel(model)!
      expect(result.ok, model.id).toBe(true)
      if (!result.ok) continue
      expect(result.steps.map((s) => s.step), model.id).toEqual(model.foldSequence!.steps.map((s) => s.step))
      for (const step of result.steps) expect(checkState(step.state), `${model.id} ${step.step}`).toEqual([])
    }
  })

  it('leaves Models without a fold sequence as they were', () => {
    const others = SEED_LIBRARY.filter((model) => !hasFoldSequence(model))
    expect(others.length).toBe(SEED_LIBRARY.length - 1)
    for (const model of others) expect(foldedStates(model).size).toBe(0)
  })
})
