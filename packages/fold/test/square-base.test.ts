import { describe, expect, it } from 'vitest'
import {
  type FoldSequenceInput,
  type FoldState,
  checkKawasaki,
  checkLayers,
  checkMaekawa,
  checkState,
  cloneState,
  faceLevels,
  foldSequence,
  layersAt,
  outline,
  toFold,
} from '../src'

const creases: FoldSequenceInput['steps'] = [
  { step: '2', actions: [{ kind: 'valley', name: 'd1', line: { bring: 'B', to: 'D' } }, { kind: 'unfold', creases: ['d1'] }] },
  { step: '3', actions: [{ kind: 'valley', name: 'd2', line: { bring: 'A', to: 'C' } }, { kind: 'unfold', creases: ['d2'] }] },
  {
    step: '4',
    actions: [
      { kind: 'turn-over' },
      { kind: 'valley', name: 'b1', line: { bring: 'A', to: 'D' } },
      { kind: 'unfold', creases: ['b1'] },
      { kind: 'valley', name: 'b2', line: { bring: 'A', to: 'B' } },
      { kind: 'unfold', creases: ['b2'] },
    ],
  },
]

const squareBase: FoldSequenceInput = {
  paper: { widthMm: 150, heightMm: 150 },
  steps: [
    ...creases,
    {
      step: '5',
      actions: [
        { kind: 'collapse', set: [{ crease: 'd2', assignment: 'V' }, { crease: 'b1', assignment: 'M' }, { crease: 'b2', assignment: 'M' }] },
        { kind: 'rotate', degrees: -135 },
      ],
    },
  ],
}

const where = (state: FoldState, name: string) => {
  const p = state.points[name]!
  const vi = state.vertices.findIndex((v) => Math.hypot(v.x - p.x, v.y - p.y) < 1e-6)
  return state.folded[vi]!
}

const creased = () => foldSequence({ paper: { widthMm: 150, heightMm: 150 }, steps: creases }).final

describe('the square base collapse', () => {
  const { final } = foldSequence(squareBase)

  it('is a square with 75 mm sides, standing as a diamond', () => {
    const hull = outline(final)
    expect(hull).toHaveLength(4)
    for (let i = 0; i < 4; i += 1) {
      const a = hull[i]!
      const b = hull[(i + 1) % 4]!
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(75, 6)
    }
    expect(checkState(final)).toEqual([])
  })

  it('stacks all 8 triangles of the sheet, four layers on each half', () => {
    expect(final.faces).toHaveLength(8)
    const o = where(final, 'O')
    const corner = where(final, 'A')
    // The halves are left and right of the line from the hinge to the open end.
    const mid = { x: (o.x + corner.x) / 2, y: (o.y + corner.y) / 2 }
    expect(layersAt(final, { x: mid.x - 10, y: mid.y })).toBe(4)
    expect(layersAt(final, { x: mid.x + 10, y: mid.y })).toBe(4)
    expect(final.above).toHaveLength(12)
  })

  it('has the hinge (the centre) at the top and the four corners together at the open end, down', () => {
    const o = where(final, 'O')
    for (const c of ['A', 'B', 'C', 'D']) {
      const p = where(final, c)
      expect(p.x).toBeCloseTo(o.x, 6)
      expect(o.y - p.y).toBeCloseTo(75 * Math.SQRT2, 6)
    }
  })

  it('shows the coloured side on the outside', () => {
    const levels = faceLevels(final)
    const top = final.faces.map((_, f) => f).filter((f) => levels[f] === 3)
    expect(top.map((f) => final.faceSides[f])).toEqual([1, 1])
  })

  it('exports its layer order as FOLD faceOrders', () => {
    const file = toFold(final)
    expect(file.faceOrders).toHaveLength(12)
    for (const [f, g, s] of file.faceOrders) {
      expect(final.above).toContainEqual([f, g])
      expect([1, -1]).toContain(s)
    }
  })
})

describe('the flat-foldability checks name the vertex', () => {
  it('Maekawa fails for four valleys and no mountain at the centre', () => {
    const state = cloneState(creased())
    for (const e of state.edges) {
      if (e.creases.includes('b1') || e.creases.includes('b2')) {
        e.assignment = 'V'
        e.foldAngle = 180
      }
    }
    const issues = checkMaekawa(state)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ check: 'maekawa', at: 'O' })
    expect(issues[0]!.message).toContain('0 mountain and 4 valley')
  })

  it('Kawasaki fails when alternate angles do not sum to 180°', () => {
    const state = cloneState(creased())
    // Fold the four rays of d1 and b1 (at 0°, 45°, 180° and 225°): 3 mountains and 1 valley pass
    // Maekawa, but the alternate angles are 45° + 45° = 90°.
    let first = true
    for (const e of state.edges) {
      if (!e.creases.includes('d1') && !e.creases.includes('b1')) continue
      e.assignment = first ? 'V' : 'M'
      e.foldAngle = first ? 180 : -180
      first = false
    }
    expect(checkMaekawa(state)).toEqual([])
    const issues = checkKawasaki(state)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ check: 'kawasaki', at: 'O' })
    expect(issues[0]!.message).toContain('90.00°')
  })
})

describe('the layers-do-not-cross check', () => {
  it('fails with a named error for a crease assignment with no layer order', () => {
    const state = cloneState(foldSequence(squareBase).final)
    // Turn one folded book crease from mountain to valley without moving the paper.
    const edge = state.edges.find((e) => e.creases.includes('b1') && e.assignment === 'M')!
    edge.assignment = 'V'
    edge.foldAngle = 180
    const issues = checkLayers(state)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.check).toBe('layers')
    expect(issues[0]!.message).toMatch(/^Layers cross/)
    expect(issues[0]!.at).toMatch(/face \d+, face \d+/)
  })
})
