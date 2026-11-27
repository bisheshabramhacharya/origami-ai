import { describe, expect, it } from 'vitest'
import { type FoldState, checkState, foldSequence, outline, runFoldSequence, stackAt } from '../src'
import { centroid, pointInConvex } from '../src/geometry'
import { flatPolygon, foldedPositionOf } from '../src/state'
import { birdBase, head, neckAndTail, thin, withSteps } from './fixtures'

const at = (state: FoldState, name: string) => {
  const p = foldedPositionOf(state, state.points[name]!)!
  return { x: p.x, y: p.y }
}
const width = (state: FoldState) => {
  const xs = outline(state).map((p) => p.x)
  return Math.max(...xs) - Math.min(...xs)
}
/** Faces the named fold moved, judged on the flat sheet. */
const movedBy = (state: FoldState, fold: string) => {
  const record = state.folds.find((r) => r.name === fold)!
  return new Set(
    state.faces
      .map((_, f) => f)
      .filter((f) => record.moved.some((poly) => pointInConvex(poly, centroid(flatPolygon(state, f)), false, 1e-6))),
  )
}
const deg = (v: { x: number; y: number }) => (Math.atan2(v.y, v.x) * 180) / Math.PI

describe('thin body and reverse folds (crane Steps 11 to 13)', () => {
  const step10 = foldSequence(withSteps(...birdBase)).final
  const step11 = foldSequence(withSteps(...birdBase, thin)).final
  const step12 = foldSequence(withSteps(...birdBase, thin, neckAndTail())).final
  const step13 = foldSequence(withSteps(...birdBase, thin, neckAndTail(), head)).final

  it('Step 11: the lower edges of the front and the back meet the centre line, and the body is thinner', () => {
    expect(checkState(step11)).toEqual([])
    const cx = at(step11, 'A').x
    // The four side corners of the bird base end on the centre line.
    for (const corner of [['k1', 'b1'], ['k2', 'b2'], ['k3', 'b2'], ['k4', 'b1']] as const) {
      const flat = step11.vertices.find((_, vi) =>
        [corner[0], corner[1]].every((c) => step11.edges.some((e) => e.creases.includes(c) && e.vertices.includes(vi))),
      )!
      expect(foldedPositionOf(step11, flat)!.x, corner.join('×')).toBeCloseTo(cx, 6)
    }
    // Worked by hand: each lower edge is 22.5° from the centre line, so the new crease is 11.25° from it.
    // That crease meets the upper edge of the wing (22.5° from the centre line, from the top point
    // 75 mm above the side corner) at x = 20.157 mm from the centre: the new width is 40.314 mm.
    expect(width(step10)).toBeCloseTo(62.132, 3)
    expect(width(step11)).toBeCloseTo(40.314, 3)
  })

  it('Step 12: neck and tail point up at the same angle, between the body layers', () => {
    expect(checkState(step12)).toEqual([])
    const m = at(step12, 'DA')
    const neck = deg({ x: at(step12, 'D').x - m.x, y: at(step12, 'D').y - m.y })
    const tail = deg({ x: at(step12, 'B').x - m.x, y: at(step12, 'B').y - m.y })
    expect(neck).toBeCloseTo(120, 6) // up and to the left, 30° from upright
    expect(tail).toBeCloseTo(60, 6) // the mirror image
    // Inside: where the neck crosses the wing, neck layers are neither the top nor the bottom layer.
    const neckFaces = movedBy(step12, 'r1')
    const stack = stackAt(step12, { x: 45, y: 110 })
    const where = stack.map((f, i) => (neckFaces.has(f) ? i : -1)).filter((i) => i >= 0)
    expect(where.length).toBeGreaterThan(0)
    expect(Math.min(...where)).toBeGreaterThan(0)
    expect(Math.max(...where)).toBeLessThan(stack.length - 1)
  })

  it('an outside reverse fold where the Step needs an inside one is told apart: it fails a named check', () => {
    // The neck turns back over the body, so its spine lands inside the body. Wrapping it around the
    // outside would make it cross the body layers: the layer check fails.
    const outside = runFoldSequence(withSteps(...birdBase, thin, neckAndTail('outside-reverse')))
    expect(outside.ok).toBe(false)
    if (!outside.ok) expect(outside.issue).toMatchObject({ step: '12', action: 1, check: 'layers', at: 'r1' })
  })

  it('on a flap folded in half, the engine tells inside from outside by where the spine lands', () => {
    const book = (kind: 'inside-reverse' | 'outside-reverse', angleDeg: number) =>
      runFoldSequence({
        paper: { widthMm: 150, heightMm: 150 },
        steps: [
          {
            step: '1',
            actions: [
              { kind: 'valley', name: 'h', line: { bring: 'A', to: 'D' } },
              { kind, name: 'r', line: { pivot: 'O', angleDeg }, flap: 'C', moving: 'C' },
            ],
          },
        ],
      })
    // Tip turned down into the flap: only an inside reverse fold can do it, with two valley hinges.
    const down = book('inside-reverse', -60)
    expect(down.ok).toBe(true)
    if (down.ok) {
      expect(checkState(down.final)).toEqual([])
      expect(down.final.edges.filter((e) => e.creases.includes('r')).map((e) => e.assignment)).toEqual(['V', 'V'])
    }
    expect(book('outside-reverse', -60).ok).toBe(false)
    // Tip turned up over the spine: only an outside reverse fold can do it, with two mountain hinges.
    const up = book('outside-reverse', 60)
    expect(up.ok).toBe(true)
    if (up.ok) expect(up.final.edges.filter((e) => e.creases.includes('r')).map((e) => e.assignment)).toEqual(['M', 'M'])
    expect(book('inside-reverse', 60).ok).toBe(false)
  })

  it('Step 13: the head points down at a sharp angle and goes inside the neck', () => {
    expect(checkState(step13)).toEqual([])
    const m = at(step13, 'DA')
    const neckDir = { x: at(step12, 'D').x - m.x, y: at(step12, 'D').y - m.y }
    // The head turns at a crease across the neck, 18.75 mm from its tip.
    const len = Math.hypot(neckDir.x, neckDir.y)
    const bend = { x: m.x + (neckDir.x * (len - 18.75)) / len, y: m.y + (neckDir.y * (len - 18.75)) / len }
    const tip = at(step13, 'D')
    const headAngle = deg({ x: tip.x - bend.x, y: tip.y - bend.y })
    expect(tip.y).toBeLessThan(bend.y) // points down
    expect(headAngle).toBeCloseTo(-120, 0) // down and to the left: 120° from the line of the neck
    const headFaces = movedBy(step13, 'h1')
    // Just past the bend the head and the neck overlap: the head layers are between the neck layers.
    const probe = { x: bend.x + 2 * Math.cos((-2 * Math.PI) / 3), y: bend.y + 2 * Math.sin((-2 * Math.PI) / 3) }
    const stack = stackAt(step13, probe)
    const where = stack.map((f, i) => (headFaces.has(f) ? i : -1)).filter((i) => i >= 0)
    expect(where.length).toBeGreaterThan(0)
    expect(Math.min(...where)).toBeGreaterThan(0)
    expect(Math.max(...where)).toBeLessThan(stack.length - 1)
  })
})
