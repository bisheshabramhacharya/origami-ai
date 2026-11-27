import { describe, expect, it } from 'vitest'
import { type FoldState, checkState, foldSequence, runFoldSequence } from '../src'
import { foldedPositionOf } from '../src/state'
import { kites, petalBack, petalFront, squareBase, topFold, withSteps } from './fixtures'

const at = (state: FoldState, name: string) => {
  const p = foldedPositionOf(state, state.points[name]!)!
  return { x: p.x, y: p.y }
}
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6

describe('petal folds (crane Steps 9 and 10)', () => {
  const base = foldSequence(squareBase).final
  const step9 = foldSequence(withSteps(...kites, topFold, petalFront())).final
  const step10 = foldSequence(withSteps(...kites, topFold, petalFront(), petalBack)).final

  it('Step 9: the front is a long diamond as long as the sheet side, and the back is still the square base', () => {
    expect(checkState(step9)).toEqual([])
    const tip = at(step9, 'C')
    const bottom = at(base, 'A')
    // Worked by hand: the square base is 75√2 = 106.07 mm tall, the tip rises 0.414 × 106.07 = 43.93 mm
    // above its top, and 106.07 + 43.93 = 150 mm, the sheet side.
    expect(tip.y - bottom.y).toBeCloseTo(150, 6)
    expect(tip.y - at(base, 'O').y).toBeCloseTo((Math.SQRT2 - 1) * 75 * Math.SQRT2, 6)
    // The sides of the flap meet on the centre line.
    expect(at(step9, 'BC').x).toBeCloseTo(tip.x, 6)
    expect(at(step9, 'CD').x).toBeCloseTo(tip.x, 6)
    // The back flap did not move.
    for (const name of ['A', 'AB', 'DA', 'O', 'B', 'D']) expect(close(at(step9, name), at(base, name)), name).toBe(true)
  })

  it('Step 10: the bird base is symmetric front and back, with two long thin points of the same length', () => {
    expect(checkState(step10)).toEqual([])
    const a = at(step10, 'A')
    const c = at(step10, 'C')
    expect(close(a, c)).toBe(true)
    const bottom = at(step10, 'B')
    expect(close(bottom, at(step10, 'D'))).toBe(true)
    expect(a.y - bottom.y).toBeCloseTo(150, 6)
    // Each flap's side corners meet on the centre line at the same place, front and back.
    for (const name of ['AB', 'BC', 'CD', 'DA']) expect(close(at(step10, name), at(step10, 'BC')), name).toBe(true)
    // Mirror symmetric about the centre line.
    const cx = a.x
    for (const p of step10.folded) {
      expect(step10.folded.some((q) => Math.abs(q.x - (2 * cx - p.x)) < 1e-6 && Math.abs(q.y - p.y) < 1e-6)).toBe(true)
    }
  })

  it('a petal fold with one crease set to the wrong assignment fails a named check', () => {
    const result = runFoldSequence(withSteps(...kites, topFold, petalFront('M')))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issue.step).toBe('9')
      expect(['maekawa', 'kawasaki', 'layers', 'no-stretch']).toContain(result.issue.check)
    }
  })
})
