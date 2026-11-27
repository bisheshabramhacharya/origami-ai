import { describe, expect, it } from 'vitest'
import { type FoldSequenceInput, type FoldState, actionMotion, checkNoStretch, foldSequence, foldedPositionOf } from '@origami/fold'
import { foldedStateBeforeStep, foldedStateForStep, getModel, stepPlayback } from '../src'

const crane = getModel('origami-crane')!

const positionsOf = (state: FoldState, on: FoldState) =>
  on.vertices.map((p) => foldedPositionOf(state, p)!)
const far = (a: Array<{ x: number; y: number; z: number }>, b: Array<{ x: number; y: number; z: number }>) =>
  a.reduce((m, p, i) => Math.max(m, Math.hypot(p.x - b[i]!.x, p.y - b[i]!.y, p.z - b[i]!.z)), 0)
// Every distance inside every face, so a face that changes shape shows.
const shapeError = (state: FoldState, flat: FoldState) => {
  let worst = 0
  for (const face of state.faces) {
    for (const a of face) {
      for (const b of face) {
        const sheet = Math.hypot(flat.vertices[a]!.x - flat.vertices[b]!.x, flat.vertices[a]!.y - flat.vertices[b]!.y)
        const now = Math.hypot(state.folded[a]!.x - state.folded[b]!.x, state.folded[a]!.y - state.folded[b]!.y, state.folded[a]!.z - state.folded[b]!.z)
        worst = Math.max(worst, Math.abs(sheet - now))
      }
    }
  }
  return worst
}

describe('Step playback for the 3D player', () => {
  it('gives each of crane Steps 2 to 4 the state before, a motion per action, and the state after', () => {
    for (const id of ['crane-2', 'crane-3', 'crane-4']) {
      const playback = stepPlayback(crane, id)!
      const step = crane.foldSequence!.steps.find((s) => s.step === id)!
      expect(playback.motions.map((m) => m.kind), id).toEqual(step.actions.map((a) => a.kind))
      expect(playback.before, id).toBe(foldedStateBeforeStep(crane, id))
      expect(playback.after, id).toBe(foldedStateForStep(crane, id))
      // The first motion starts where the Step starts, and the last one ends where it ends.
      const first = playback.motions[0]!.stateAt(0)
      expect(far(first.folded, positionsOf(playback.before, first)), id).toBeLessThan(1e-6)
      const last = playback.motions.at(-1)!.stateAt(1)
      expect(far(last.folded, playback.after.folded), id).toBeLessThan(1e-9)
    }
  })

  it('moves simple folds, unfolds and turning over exactly: no face changes shape on the way', () => {
    for (const id of ['crane-2', 'crane-3', 'crane-4']) {
      for (const motion of stepPlayback(crane, id)!.motions) {
        expect(motion.exact, `${id} ${motion.kind}`).toBe(true)
        for (const t of [0.1, 0.33, 0.5, 0.9]) {
          const state = motion.stateAt(t)
          expect(checkNoStretch(state), `${id} ${motion.kind} ${t}`).toEqual([])
          expect(shapeError(state, state), `${id} ${motion.kind} ${t}`).toBeLessThan(1e-6)
        }
      }
    }
  })

  it('a valley fold turns the moving half about the hinge: halfway, it stands at 90°', () => {
    const fold = stepPlayback(crane, 'crane-2')!.motions[0]!
    const halfway = fold.stateAt(0.5)
    const zs = halfway.folded.map((p) => Math.abs(p.z))
    // Worked by hand: the far corner of a 150 mm square folded on its diagonal is 75√2 = 106.07 mm from
    // the hinge, so at 90° it stands 106.07 mm off the table.
    expect(Math.max(...zs)).toBeCloseTo(75 * Math.SQRT2, 6)
  })

  it('blends a compound fold and marks it approximate', () => {
    const collapse = crane.foldSequence!.steps.find((s) => s.actions.some((a) => a.kind === 'collapse'))!
    const motion = stepPlayback(crane, collapse.step)!.motions.find((m) => m.kind === 'collapse')!
    expect(motion.exact).toBe(false)
    const a = motion.stateAt(0)
    const b = motion.stateAt(1)
    const mid = motion.stateAt(0.5)
    mid.folded.forEach((p, i) => {
      expect(p.x).toBeCloseTo((a.folded[i]!.x + b.folded[i]!.x) / 2, 9)
      expect(p.z).toBeCloseTo((a.folded[i]!.z + b.folded[i]!.z) / 2, 9)
    })
  })

  it('invariant: every crane Step has a playback whose motions chain end to end', () => {
    for (const step of crane.steps) {
      const playback = stepPlayback(crane, step.id)
      expect(playback, step.id).not.toBeNull()
      let from = playback!.before
      for (const motion of playback!.motions) {
        const start = motion.stateAt(0)
        expect(far(start.folded, positionsOf(from, start)), `${step.id} ${motion.kind}`).toBeLessThan(1e-6)
        from = motion.stateAt(1)
      }
      expect(far(from.folded, playback!.after.folded), step.id).toBeLessThan(1e-9)
    }
  })

  it('rotating, opening and unfolding are exact too, and checked at every tenth of the way', () => {
    const kinds = new Set<string>()
    for (const id of ['crane-2', 'crane-5', 'crane-13']) {
      for (const motion of stepPlayback(crane, id)!.motions) {
        if (!['rotate', 'open', 'unfold'].includes(motion.kind)) continue
        kinds.add(motion.kind)
        expect(motion.exact, `${id} ${motion.kind}`).toBe(true)
        for (let t = 0.05; t < 1; t += 0.1) expect(checkNoStretch(motion.stateAt(t)), `${id} ${motion.kind} ${t}`).toEqual([])
      }
    }
    expect([...kinds].sort()).toEqual(['open', 'rotate', 'unfold'])
  })

  it('a rotation of more than half a turn plays the long way round', () => {
    const paper = { widthMm: 100, heightMm: 100 }
    const steps: FoldSequenceInput['steps'] = [{ step: 'r', actions: [{ kind: 'rotate', degrees: 270 }] }]
    const run = foldSequence({ paper, steps })
    const before = foldSequence({ paper, steps: [{ step: 'none', actions: [] }] }).final
    const after = run.final
    const motion = actionMotion(before, after, 'rotate', { turnDegrees: 270 })
    expect(motion.exact).toBe(true)
    // Halfway, corner B (top right, at (100, 100) from the centre (50, 50)) has turned 135° counter-clockwise.
    const halfway = motion.stateAt(0.5)
    const b = foldedPositionOf(halfway, halfway.points.B!)!
    const angle = (p: { x: number; y: number }) => Math.atan2(p.y - 50, p.x - 50)
    const start = Math.atan2(50, 50)
    const turned = (((angle(b) - start) * 180) / Math.PI + 360) % 360
    expect(turned).toBeCloseTo(135, 3)
    // The shortest turn would have gone 45° the other way at halfway.
    expect(Math.abs(turned - 315)).toBeGreaterThan(1)
  })
})
