import { describe, expect, it } from 'vitest'
import { type FoldState, checkState, foldSequence, outline, runFoldSequence } from '../src'
import { kites, squareBase, topFold, withSteps } from './fixtures'

const named = (state: FoldState, name: string) => state.edges.filter((e) => e.creases.includes(name))
const pointIn = (poly: Array<{ x: number; y: number }>, p: { x: number; y: number }) => {
  let inside = true
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < -1e-6) inside = false
  }
  return inside
}

describe('folds on the top flap', () => {
  const base = foldSequence(squareBase).final
  const kite = foldSequence(withSteps(kites[0]!)).final

  it('a kite fold moves only the top flap', () => {
    expect(checkState(kite)).toEqual([])
    // Every vertex of the square base that is not on the front right quarter stays where it was.
    const front = [base.points.O!, base.points.C!, base.points.BC!]
    const frontBack = [base.points.BC!, base.points.B!, base.points.O!]
    let moved = 0
    base.vertices.forEach((v, vi) => {
      const now = kite.vertices.findIndex((w) => Math.hypot(w.x - v.x, w.y - v.y) < 1e-9)
      const d = Math.hypot(kite.folded[now]!.x - base.folded[vi]!.x, kite.folded[now]!.y - base.folded[vi]!.y)
      if (d > 1e-6) {
        moved += 1
        expect(pointIn(front, v) || pointIn(frontBack, v)).toBe(true)
      }
    })
    expect(moved).toBe(1) // only BC, the flap's side corner, moves
    // The new crease is only on the faces of the flap that moved (two layers joined at the top edge).
    for (const e of named(kite, 'k1')) {
      const mid = {
        x: (kite.vertices[e.vertices[0]]!.x + kite.vertices[e.vertices[1]]!.x) / 2,
        y: (kite.vertices[e.vertices[0]]!.y + kite.vertices[e.vertices[1]]!.y) / 2,
      }
      expect(pointIn(front, mid) || pointIn(frontBack, mid)).toBe(true)
    }
    expect(named(kite, 'k1').length).toBe(2)
  })

  it('brings the edge onto the centre line, with the corner at 75 mm above the bottom point', () => {
    const bc = kite.vertices.findIndex((v) => Math.hypot(v.x - 150, v.y - 75) < 1e-9)
    const c = kite.vertices.findIndex((v) => Math.hypot(v.x - 150, v.y) < 1e-9)
    expect(kite.folded[bc]!.x).toBeCloseTo(kite.folded[c]!.x, 6)
    expect(kite.folded[bc]!.y - kite.folded[c]!.y).toBeCloseTo(75, 6)
  })

  it('fails with a named error when the moving flap would pass through a layer above it', () => {
    const result = runFoldSequence(
      withSteps({ step: '6', actions: [{ kind: 'valley', name: 'x', line: { bringEdge: ['C', 'BC'], to: { crease: 'd1' } }, layers: { flap: 'AB' } }] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issue).toMatchObject({ step: '6', action: 1, check: 'layers', at: 'x' })
      expect(result.issue.message).toContain('pass through a layer')
    }
  })

  it('after folding the top down and unfolding the last three folds, the square base is back with three flat creases', () => {
    const after = foldSequence(withSteps(...kites, topFold)).final
    const hullBase = outline(base)
    const hullAfter = outline(after)
    expect(hullAfter).toHaveLength(4)
    hullBase.forEach((p) => expect(hullAfter.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6)).toBe(true))
    for (const name of ['k1', 'k2', 't1']) {
      expect(named(after, name).length, name).toBeGreaterThan(0)
      expect(named(after, name).every((e) => e.assignment === 'F'), name).toBe(true)
    }
    expect(after.folds).toEqual([])
    expect(checkState(after)).toEqual([])
  })

  it('unfold names more folds than were made', () => {
    const result = runFoldSequence(withSteps({ step: '6', actions: [{ kind: 'unfold', last: 4 }] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issue.check).toBe('references')
  })
})
