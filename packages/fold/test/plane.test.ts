import { describe, expect, it } from 'vitest'
import { type FoldSequenceInput, boundingBox, checkState, foldSequence, isFlat, runFoldSequence } from '../src'
import { foldedPositionOf } from '../src/state'

// US Letter, portrait. A top left, B top right, C bottom right, D bottom left; AB is the nose.
const W = 215.9
const H = 279.4
const paper = { widthMm: W, heightMm: H }
const meet = (crease: string, a: string, b: string) => ({ intersect: [{ crease }, { through: [a, b] }] as [{ crease: string }, { through: [string, string] }] })

const steps: FoldSequenceInput['steps'] = [
  { step: '1', actions: [{ kind: 'valley', name: 'c', line: { bring: 'A', to: 'B' } }, { kind: 'unfold', creases: ['c'] }] },
  {
    step: '2',
    actions: [
      { kind: 'valley', name: 'k1', line: { bringEdge: ['AB', 'A'], to: { crease: 'c' } } },
      { kind: 'valley', name: 'k2', line: { bringEdge: ['AB', 'B'], to: { crease: 'c' } } },
    ],
  },
  {
    step: '3',
    actions: [
      { kind: 'valley', name: 's1', line: { bringEdge: ['AB', meet('k1', 'A', 'D')], to: { crease: 'c' } } },
      { kind: 'valley', name: 's2', line: { bringEdge: ['AB', meet('k2', 'B', 'C')], to: { crease: 'c' } } },
    ],
  },
  { step: '4', actions: [{ kind: 'mountain', name: 'h', line: { crease: 'c' }, moving: 'D' }] },
]
// The wing line goes through the nose and halves the 22.5° between the slanted edge and the centre crease.
const wing = (layers: 'top' | 'above'): FoldSequenceInput['steps'][number] => ({
  step: '5',
  actions: [{ kind: 'valley', name: 'w1', line: { pivot: 'AB', angleDeg: -78.75 }, moving: 'C', layers }],
})
const upTo = (n: number) => foldSequence({ paper, steps: steps.slice(0, n) }).final
const at = (state: ReturnType<typeof upTo>, name: string) => foldedPositionOf(state, state.points[name]!)!

describe('the paper dart on a rectangle', () => {
  it('Step 2: each top corner lands on the centre crease, W/2 = 107.95 mm below the top edge', () => {
    const state = upTo(2)
    expect(checkState(state)).toEqual([])
    for (const corner of ['A', 'B']) {
      expect(at(state, corner).x, corner).toBeCloseTo(W / 2, 6)
      expect(at(state, corner).y, corner).toBeCloseTo(H - W / 2, 6)
    }
    expect(at(state, 'AB').x).toBeCloseTo(W / 2, 6)
    expect(at(state, 'AB').y).toBeCloseTo(H, 6)
  })

  it('Step 4: flat and narrow (a point at the nose, a short straight tail), the centre crease along one long edge, W/2 wide and H long', () => {
    const state = upTo(4)
    expect(isFlat(state)).toBe(true)
    expect(checkState(state)).toEqual([])
    const box = boundingBox(state)
    expect(box.widthMm).toBeCloseTo(W / 2, 6)
    expect(box.heightMm).toBeCloseTo(H, 6)
    // The centre crease runs from the nose (AB) to the middle of the tail (CD), along one long edge.
    const xs = state.folded.map((p) => p.x)
    const edgeX = [Math.min(...xs), Math.max(...xs)]
    expect(at(state, 'AB').x).toBeCloseTo(at(state, 'CD').x, 6)
    expect(edgeX.some((x) => Math.abs(x - at(state, 'AB').x) < 1e-6)).toBe(true)
    expect(Math.abs(at(state, 'AB').y - at(state, 'CD').y)).toBeCloseTo(H, 6)
    // The back half lies under the front half, corner on corner.
    expect(at(state, 'D').x).toBeCloseTo(at(state, 'C').x, 6)
    expect(at(state, 'D').y).toBeCloseTo(at(state, 'C').y, 6)
  })

  it('Step 5: a `top` fold of the wing is blocked by the loose flaps on it; `above` folds them with the wing', () => {
    const top = runFoldSequence({ paper, steps: [...steps, wing('top')] })
    expect(top.ok).toBe(false)
    if (!top.ok) expect(top.issue).toMatchObject({ check: 'layers', step: '5' })

    const above = runFoldSequence({ paper, steps: [...steps, wing('above')] })
    expect(above.ok).toBe(true)
    if (!above.ok) return
    const state = above.final
    expect(checkState(state)).toEqual([])
    // Corner C (the wing's tail corner) is mirrored across the wing line through the nose N.
    const t = (11.25 * Math.PI) / 180
    const d = { x: Math.sin(t), y: -Math.cos(t) }
    const v = { x: W - W / 2, y: 0 - H }
    const along = v.x * d.x + v.y * d.y
    const mirror = { x: W / 2 + 2 * along * d.x - v.x, y: H + 2 * along * d.y - v.y }
    expect(at(state, 'C').x).toBeCloseTo(mirror.x, 6)
    expect(at(state, 'C').y).toBeCloseTo(mirror.y, 6)
    // Only the front half moved: the back half's corner D is where Step 4 left it.
    const before = upTo(4)
    expect(at(state, 'D').x).toBeCloseTo(at(before, 'D').x, 6)
    expect(at(state, 'D').y).toBeCloseTo(at(before, 'D').y, 6)
  })
})
