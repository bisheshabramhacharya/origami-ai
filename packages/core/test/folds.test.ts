import { describe, expect, it } from 'vitest'
import { type FoldSequenceInput, boundingBox, checkState, foldedPositionOf, isFlat, outline, runFoldSequence } from '@origami/fold'
import { CRANE_FOLD_SEQUENCE, CRANE_WING_DEGREES } from '../src/data/crane-folds'
import {
  SEED_LIBRARY,
  type Model,
  auditFoldSequence,
  auditLibrary,
  finishedSizeFor,
  finishedSizeLabel,
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

  it('gives the square base for Step 5: a 75 mm diamond of 8 stacked triangles', () => {
    const step5 = foldedStateForStep(crane, 'crane-5')!
    expect(step5.faces).toHaveLength(8)
    expect(area(outline(step5))).toBeCloseTo(75 * 75, 6)
    expect(checkState(step5)).toEqual([])
  })

  it('folds the kites and the top point on the front flap (Steps 6 to 8), then opens them again', () => {
    for (const id of ['crane-6', 'crane-7', 'crane-8']) expect(checkState(foldedStateForStep(crane, id)!), id).toEqual([])
    const step8 = foldedStateForStep(crane, 'crane-8')!
    expect(area(outline(step8))).toBeCloseTo(75 * 75, 6)
    const flat = step8.edges.filter((e) => e.creases.some((c) => ['k1', 'k2', 't1'].includes(c)))
    expect(flat.length).toBeGreaterThan(0)
    expect(flat.every((e) => e.assignment === 'F')).toBe(true)
  })

  it('folds the bird base in Steps 9 and 10: a 150 mm long diamond, the same front and back', () => {
    const step9 = foldedStateForStep(crane, 'crane-9')!
    const step10 = foldedStateForStep(crane, 'crane-10')!
    expect(checkState(step9)).toEqual([])
    expect(checkState(step10)).toEqual([])
    const height = (s: typeof step9) => {
      const ys = outline(s).map((p) => p.y)
      return Math.max(...ys) - Math.min(...ys)
    }
    expect(height(step9)).toBeCloseTo(150, 6)
    expect(height(step10)).toBeCloseTo(150, 6)
    for (const id of ['crane-9', 'crane-10']) expect(crane.steps.find((s) => s.id === id)!.operations).toContain('petal-fold')
  })

  it('thins the body and folds the neck, tail and head in Steps 11 to 13', () => {
    for (const id of ['crane-11', 'crane-12', 'crane-13']) expect(checkState(foldedStateForStep(crane, id)!), id).toEqual([])
    const width = (id: string) => {
      const xs = outline(foldedStateForStep(crane, id)!).map((p) => p.x)
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(width('crane-11')).toBeLessThan(width('crane-10'))
    // Neck and tail go up and out: the model is wider than the thin body again.
    expect(width('crane-12')).toBeGreaterThan(width('crane-11'))
    for (const id of ['crane-12', 'crane-13']) expect(crane.steps.find((s) => s.id === id)!.operations).toContain('reverse-fold')
  })

  it('opens both wings level and symmetric at the end of Step 13, each turned on its hinge to the set angle', () => {
    const state = foldedStateForStep(crane, 'crane-13')!
    expect(isFlat(state)).toBe(false)
    expect(checkState(state)).toEqual([])
    const p = (name: string) => foldedPositionOf(state, state.points[name]!)!
    // Each wing turns about a level hinge through the centre of the sheet, O.
    const hingeY = p('O').y
    // Worked by hand: the wing tip is 75 × (2 − √2) = 43.93 mm past the hinge (Step 9: the tip rises
    // 0.414 × 106.07 mm above the top of the square base, and the hinge is on that top).
    const wing = 75 * (2 - Math.SQRT2)
    const turn = (CRANE_WING_DEGREES * Math.PI) / 180
    const front = p('C')
    const back = p('A')
    for (const tip of [front, back]) {
      expect(tip.y - hingeY).toBeCloseTo(wing * Math.cos(turn), 6)
      expect(Math.abs(tip.z)).toBeCloseTo(wing * Math.sin(turn), 6)
    }
    // Level: both tips at the same height and the same place along the body; symmetric: one each side.
    expect(front.y).toBeCloseTo(back.y, 6)
    expect(front.x).toBeCloseTo(back.x, 6)
    expect(front.z).toBeCloseTo(-back.z, 6)
    // The front wing lay on top, so it lifts toward the viewer; the back wing goes away from the viewer.
    expect(front.z).toBeGreaterThan(0)
    expect(back.z).toBeLessThan(0)
    for (const name of ['w1', 'w2']) {
      const hinges = state.edges.filter((e) => e.creases.includes(name))
      expect(hinges.length, name).toBeGreaterThan(0)
      for (const e of hinges) expect(Math.abs(e.foldAngle), name).toBeCloseTo(CRANE_WING_DEGREES, 9)
    }
  })

  it('Step 14 keeps the state of Step 13, with a note that the body is rounded by hand', () => {
    expect(foldedStateForStep(crane, 'crane-14')).toBe(foldedStateForStep(crane, 'crane-13'))
    const step14 = crane.foldSequence!.steps.find((s) => s.step === 'crane-14')!
    expect(step14.actions).toEqual([])
    expect(step14.note).toMatch(/by hand/)
    // The fold sequence covers all 14 Steps.
    expect(crane.foldSequence!.steps.map((s) => s.step)).toEqual(crane.steps.map((s) => s.id))
  })

  it('the finished crane from a 150 mm sheet has the size worked by hand, and it scales with the sheet', () => {
    const boxFor = (side: number) => {
      const sequence: FoldSequenceInput = { ...CRANE_FOLD_SEQUENCE, paper: { widthMm: side, heightMm: side } }
      const result = runFoldSequence(sequence)
      if (!result.ok) throw new Error(result.issue.message)
      return boundingBox(result.final)
    }
    const box = boxFor(150)
    // Wingspan (across the wings, z): two wings of 75 × (2 − √2) mm = 150 × (2 − √2) = 87.87 mm.
    expect(box.depthMm).toBeCloseTo(150 * (2 - Math.SQRT2), 6)
    // Neck tip to tail tip (x): each is a 75 mm flap turned 30° from upright, so 2 × 75 × sin 30° = 75 mm.
    // The head is a reverse fold on a level line, so its tip keeps the neck tip's x.
    expect(box.widthMm).toBeCloseTo(75, 6)
    // The Model's stated finished size is the engine's, to a hundredth of a mm.
    expect(crane.finishedSize).toMatchObject({ fromSheetMm: 150 })
    expect(crane.finishedSize!.widthMm).toBeCloseTo(box.depthMm, 2)
    expect(crane.finishedSize!.lengthMm).toBeCloseTo(box.widthMm, 2)
    expect(crane.finishedSize!.heightMm).toBeCloseTo(box.heightMm, 2)
    for (const side of [75, 300]) {
      const other = boxFor(side)
      const k = side / 150
      expect(other.widthMm, `${side}`).toBeCloseTo(box.widthMm * k, 6)
      expect(other.heightMm, `${side}`).toBeCloseTo(box.heightMm * k, 6)
      expect(other.depthMm, `${side}`).toBeCloseTo(box.depthMm * k, 6)
      const scaled = finishedSizeFor(crane.finishedSize!, side)
      expect(scaled.widthMm, `${side}`).toBeCloseTo(other.depthMm, 1)
    }
    expect(finishedSizeLabel(crane)).toBe('About 9 cm wide from a 15 cm sheet')
    expect(finishedSizeLabel(crane, 75)).toBe('About 4.5 cm wide from a 7.5 cm sheet')
    expect(finishedSizeLabel(getModel('flapping-bird')!)).toBeNull()
    // The sheet is shown to 0.1 cm: a US Letter short side is 21.59 cm.
    expect(finishedSizeLabel(crane, 215.9)).toBe('About 12.5 cm wide from a 21.6 cm sheet')
    expect(() => finishedSizeLabel(crane, 0)).toThrow(RangeError)
    expect(() => finishedSizeLabel(crane, -10)).toThrow(RangeError)
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
