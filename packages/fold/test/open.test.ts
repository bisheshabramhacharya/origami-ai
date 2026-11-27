import { describe, expect, it } from 'vitest'
import { type FoldSequenceInput, checkState, foldSequence, isFlat, runFoldSequence } from '../src'
import { foldedPositionOf } from '../src/state'
import { birdBase, kites, neckAndTail, petalFront, thin, topFold, withSteps } from './fixtures'

const paper = { widthMm: 150, heightMm: 150 }
// Fold the top half down onto the bottom half: crease h on y = 75, corner A comes down onto D.
const half: FoldSequenceInput['steps'][number] = {
  step: 'half',
  actions: [{ kind: 'valley', name: 'h', line: { bring: 'A', to: 'D' } }],
}
const open = (degrees: number, creases = ['h']): FoldSequenceInput => ({
  paper,
  steps: [half, { step: 'open', actions: [{ kind: 'open', creases, degrees }] }],
})
const at = (state: ReturnType<typeof foldSequence>['final'], name: string) => foldedPositionOf(state, state.points[name]!)!

describe('open: turn a flap on its hinge crease to an angle that is not flat', () => {
  it('turns the flap to 90° as a rigid turn about the hinge, and the paper does not stretch', () => {
    const state = foldSequence(open(90)).final
    expect(isFlat(state)).toBe(false)
    expect(checkState(state)).toEqual([])
    // The half that stayed is still on the table.
    expect(at(state, 'D')).toMatchObject({ x: 0, y: 0, z: 0 })
    // Worked by hand: corner A is 75 mm from the hinge, so at 90° it stands 75 mm straight up from y = 75.
    const a = at(state, 'A')
    expect(a.x).toBeCloseTo(0, 6)
    expect(a.y).toBeCloseTo(75, 6)
    expect(Math.abs(a.z)).toBeCloseTo(75, 6)
  })

  it('at 180° the flap lies flat again, with the same layers as before', () => {
    const folded = foldSequence({ paper, steps: [half] }).final
    const again = foldSequence(open(180)).final
    expect(isFlat(again)).toBe(true)
    expect(checkState(again)).toEqual([])
    for (const name of ['A', 'B', 'C', 'D']) {
      expect(at(again, name).x, name).toBeCloseTo(at(folded, name).x, 6)
      expect(at(again, name).y, name).toBeCloseTo(at(folded, name).y, 6)
    }
  })

  it('at 0° the sheet lies open', () => {
    const state = foldSequence(open(0)).final
    expect(at(state, 'A')).toMatchObject({ x: 0, y: 150 })
  })

  it('fails with a references error for a crease that does not exist or is not folded', () => {
    const missing = runFoldSequence(open(90, ['nope']))
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.issue).toMatchObject({ check: 'references', step: 'open', action: 1 })
    const notFolded = runFoldSequence({
      paper,
      steps: [half, { step: 'open', actions: [{ kind: 'unfold', creases: ['h'] }, { kind: 'open', creases: ['h'], degrees: 90 }] }],
    })
    expect(notFolded.ok).toBe(false)
    if (!notFolded.ok) expect(notFolded.issue.message).toContain('not folded now')
  })

  it('at 60° the flap is 60° up from the open sheet, toward the viewer', () => {
    const state = foldSequence(open(60)).final
    expect(checkState(state)).toEqual([])
    const a = at(state, 'A')
    // The degrees are the fold angle: 0° is the open sheet and 180° is folded flat. A valley lifts toward the viewer (z > 0).
    expect(a.z).toBeCloseTo(75 * Math.sin((60 * Math.PI) / 180), 6)
    expect(a.y).toBeCloseTo(75 + 75 * Math.cos((60 * Math.PI) / 180), 6)
  })

  it('at 180° the layer order is the one the fold made', () => {
    const folded = foldSequence({ paper, steps: [half] }).final
    const again = foldSequence(open(180)).final
    const key = (pairs: Array<[number, number]>) => pairs.map(([u, l]) => `${u}>${l}`).sort()
    expect(key(again.above)).toEqual(key(folded.above))
  })

  it('fails with a clear message for a crease folded inside a compound fold', () => {
    const result = runFoldSequence(withSteps(...kites, topFold, petalFront(), { step: 'o', actions: [{ kind: 'open', creases: ['k1'], degrees: 90 }] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issue.message).toContain('compound fold')
  })
})

describe('open: a flap cannot turn through layers that stay', () => {
  it('fails when the flap is wrapped inside a later fold of the whole stack', () => {
    const result = runFoldSequence({
      paper,
      steps: [
        half,
        { step: 'v', actions: [{ kind: 'valley', name: 'v', line: { bring: 'C', to: 'D' }, layers: 'all' }] },
        { step: 'o', actions: [{ kind: 'open', creases: ['h'], degrees: 90 }] },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issue).toMatchObject({ check: 'layers', step: 'o' })
  })

  it('fails for the neck or the tail, which sit between the body layers', () => {
    const base = withSteps(...birdBase, thin, neckAndTail())
    for (const crease of ['r1', 'r2']) {
      const result = runFoldSequence({ ...base, steps: [...base.steps, { step: 'o', actions: [{ kind: 'open', creases: [crease], degrees: 90 }] }] })
      expect(result.ok, crease).toBe(false)
      if (!result.ok) expect(result.issue.check, crease).toBe('layers')
    }
  })
})
