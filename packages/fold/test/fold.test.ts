import { describe, expect, it } from 'vitest'
import {
  type FoldSequenceInput,
  type PointRef,
  applyAction,
  boundingBox,
  checkNoStretch,
  checkState,
  cloneState,
  displayMesh,
  foldSequence,
  fromFold,
  isFlat,
  layersAt,
  makeSheet,
  outline,
  runFoldSequence,
  toFold,
} from '../src'

const kami = { widthMm: 150, heightMm: 150 }
const area = (pts: Array<{ x: number; y: number }>) =>
  Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * p.y, 0)) / 2

const diagonal: FoldSequenceInput = {
  paper: kami,
  steps: [{ step: '1', actions: [{ kind: 'valley', name: 'd2', line: { bring: 'A', to: 'C' } }] }],
}

describe('a simple valley fold', () => {
  it('bring A to C gives a right triangle of two layers with 150 mm legs', () => {
    const { final } = foldSequence(diagonal)
    expect(isFlat(final)).toBe(true)
    const hull = outline(final)
    expect(hull).toHaveLength(3)
    expect(area(hull)).toBeCloseTo((150 * 150) / 2, 6)
    const box = boundingBox(final)
    expect(box.widthMm).toBeCloseTo(150, 6)
    expect(box.heightMm).toBeCloseTo(150, 6)
    // The right angle is at the corner that did not move: C stays at (150, 0), and B at (150, 150).
    expect(layersAt(final, { x: 120, y: 30 })).toBe(2)
    expect(checkState(final)).toEqual([])
    // The crease is a valley on the coloured side, folded flat.
    const crease = final.edges.filter((e) => e.creases.includes('d2'))
    expect(crease).toHaveLength(1)
    expect(crease[0]!.assignment).toBe('V')
    expect(crease[0]!.foldAngle).toBe(180)
    // The moving layer (A's half) is on top and shows its white side.
    expect(final.above).toHaveLength(1)
  })

  it('a mountain fold sends the paper behind', () => {
    const { final } = foldSequence({
      paper: kami,
      steps: [{ step: '1', actions: [{ kind: 'mountain', name: 'm', line: { bring: 'A', to: 'C' } }] }],
    })
    const edge = final.edges.find((e) => e.creases.includes('m'))!
    expect(edge.assignment).toBe('M')
    expect(checkState(final)).toEqual([])
  })

  it('unfolding gives the flat square back with the crease kept', () => {
    const { final } = foldSequence({
      paper: kami,
      steps: [
        { step: '2', actions: [{ kind: 'valley', name: 'd1', line: { bring: 'B', to: 'D' } }, { kind: 'unfold', last: 1 }] },
      ],
    })
    expect(isFlat(final)).toBe(true)
    expect(area(outline(final))).toBeCloseTo(150 * 150, 6)
    expect(final.above).toEqual([])
    const crease = final.edges.filter((e) => e.creases.includes('d1'))
    expect(crease).toHaveLength(1)
    expect(crease[0]!.assignment).toBe('F')
    const sheet = makeSheet(kami)
    for (const name of ['A', 'B', 'C', 'D']) {
      const p = sheet.points[name]!
      const vi = final.vertices.findIndex((v) => Math.hypot(v.x - p.x, v.y - p.y) < 1e-9)
      expect(final.folded[vi]!.x).toBeCloseTo(p.x, 9)
      expect(final.folded[vi]!.y).toBeCloseTo(p.y, 9)
    }
  })

  it('folds through every layer and keeps the layer order consistent', () => {
    const { final } = foldSequence({
      paper: kami,
      steps: [
        {
          step: '1',
          actions: [
            { kind: 'valley', name: 'half', line: { bring: 'A', to: 'D' } },
            { kind: 'valley', name: 'quarter', line: { bring: 'B', to: 'A' } },
          ],
        },
      ],
    })
    expect(area(outline(final))).toBeCloseTo(75 * 75, 6)
    expect(layersAt(final, { x: 37.5, y: 37.5 })).toBe(4)
    expect(checkState(final)).toEqual([])
  })
})

describe('errors name the Step, the action, the check and the point', () => {
  it('a missing point', () => {
    const result = runFoldSequence({
      paper: kami,
      steps: [
        { step: '1', actions: [] },
        { step: '2', actions: [{ kind: 'valley', line: { bring: 'A', to: 'C' } }, { kind: 'valley', line: { bring: 'Z', to: 'C' } }] },
      ],
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issue.step).toBe('2')
    expect(result.issue.action).toBe(2)
    expect(result.issue.check).toBe('references')
    expect(result.issue.at).toBe('Z')
    expect(result.issue.message).toContain('Z')
  })

  it('a schema error names the Step and action', () => {
    const result = runFoldSequence({
      paper: kami,
      steps: [{ step: '1', actions: [{ kind: 'valley', line: { bring: 'A' } } as never] }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issue.check).toBe('schema')
      expect(result.issue.step).toBe('1')
      expect(result.issue.action).toBe(1)
    }
  })

  it('a crease that does not exist', () => {
    const result = runFoldSequence({ paper: kami, steps: [{ step: '3', actions: [{ kind: 'unfold', creases: ['nope'] }] }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issue).toMatchObject({ step: '3', action: 1, check: 'references', at: 'nope' })
  })

  it('a point hidden under other layers cannot be brought', () => {
    // Fold the right half over the left half. The point (50, 50) of the left half is now under it.
    const hiddenPoint: PointRef = { intersect: [{ through: ['D', 'B'] }, { through: ['DA', 'C'] }] }
    const result = runFoldSequence({
      paper: kami,
      steps: [
        {
          step: '1',
          actions: [
            { kind: 'valley', name: 'half', line: { bring: 'B', to: 'A' } },
            { kind: 'valley', line: { bring: hiddenPoint, to: 'D' }, layers: 'top' },
          ],
        },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issue.check).toBe('references')
      expect(result.issue.message).toContain('hidden')
    }
  })
})

describe('the no-stretch check', () => {
  it('passes on a folded state and fails on a stretched one', () => {
    const { final } = foldSequence(diagonal)
    expect(checkNoStretch(final)).toEqual([])
    const broken = cloneState(final)
    broken.folded[0] = { ...broken.folded[0]!, x: broken.folded[0]!.x + 5 }
    const issues = checkNoStretch(broken)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.check).toBe('no-stretch')
    expect(issues[0]!.at).toContain('D')
  })
})

describe('turn over and rotate', () => {
  it('turning over shows the other side and keeps the shape', () => {
    const sheet = makeSheet(kami)
    const { state } = applyAction(sheet, { kind: 'turn-over', axis: 'vertical' })
    const a = state.vertices.findIndex((v) => v.x === 0 && v.y === 150)
    expect(state.folded[a]).toMatchObject({ x: 150, y: 150 })
    expect(state.faceSides[0]).toBe(-1)
    expect(checkState(state)).toEqual([])
  })
})

describe('FOLD export', () => {
  it('writes the FOLD fields and reads them back', () => {
    const { final } = foldSequence(diagonal)
    const file = toFold(final)
    expect(file.file_spec).toBe(1.1)
    expect(file.frame_classes).toEqual(['foldedForm'])
    expect(file.file_frames[0]!.frame_classes).toEqual(['creasePattern'])
    expect(file.vertices_coords).toHaveLength(final.vertices.length)
    expect(file.edges_vertices).toHaveLength(final.edges.length)
    expect(file.edges_assignment).toContain('V')
    expect(file.faceOrders).toHaveLength(1)
    const json = JSON.parse(JSON.stringify(file))
    expect(fromFold(json)).toEqual(final)
  })
})

describe('the display mesh', () => {
  it('lifts upper layers above lower ones', () => {
    const { final } = foldSequence(diagonal)
    const mesh = displayMesh(final)
    expect(mesh.faces).toHaveLength(2)
    const [upper, lower] = final.above[0]!
    const z = (f: number) => mesh.faces[f]!.points[0]!.z
    expect(z(upper)).toBeGreaterThan(z(lower))
  })
})
