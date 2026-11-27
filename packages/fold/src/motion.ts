import { type Affine3, affineFromFaceMap, apply3, compose3, rotation3 } from './affine'
import { type Vec3, centroid, dist3, lerp3, pointOnSegment, signedArea, sub3, v3 } from './geometry'
import { geometryFromAngles } from './geometry-solve'
import type { FoldKind } from './language'
import { type FoldState, cloneState, faceMap, flatPolygon, foldedPositionOf } from './state'

/** How the paper moves during one action, from the state before it to the state after it. */
export interface ActionMotion {
  kind: FoldKind
  /**
   * True when the motion is the real one: every face turns rigidly about its creases, so no face
   * changes shape on the way (simple folds, unfolds, opening, turning over, rotating). False for
   * compound folds, where the motion is a blend of positions between the two states.
   */
  exact: boolean
  /** The paper at time t, from 0 (before the action) to 1 (after it), on the faces of the state after. */
  stateAt(t: number): FoldState
}

/** The times at which a motion is checked for exactness, and at which a view's frame is measured. */
export const MOTION_SAMPLES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
const TOLERANCE = 1e-3

/** The rotation part of an affine map as a unit quaternion [w, x, y, z] with w >= 0. */
function quaternion(m: number[]): [number, number, number, number] {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m as [number, number, number, number, number, number, number, number, number]
  const tr = m00 + m11 + m22
  let q: [number, number, number, number]
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    q = [s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s]
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    q = [(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s]
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    q = [(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s]
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4]
  }
  return q[0] < 0 ? [-q[0], -q[1], -q[2], -q[3]] : q
}

const transpose = (m: number[]) => [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!]

/**
 * The rigid path of one face from map `a` to map `b`: it turns about one axis through its centre
 * while the centre moves in a straight line.
 */
function rigidPath(a: Affine3, b: Affine3, centreFlat: Vec3, turnDegrees?: number): (t: number) => Affine3 {
  let half: number
  let axis: Vec3
  if (turnDegrees !== undefined) {
    // A rotation on the table: turn about the viewer's axis the way and the amount the action says,
    // which can be more than half a turn.
    half = (turnDegrees * Math.PI) / 360
    axis = v3(0, 0, 1)
  } else {
    // Otherwise the shortest turn from one map to the other.
    const r = compose3({ m: b.m, t: v3(0, 0, 0) }, { m: transpose(a.m), t: v3(0, 0, 0) }).m
    const [w, x, y, z] = quaternion(r)
    half = Math.acos(Math.min(1, w))
    const s = Math.sin(half)
    axis = s < 1e-12 ? v3(0, 0, 1) : v3(x / s, y / s, z / s)
  }
  const c0 = apply3(a, centreFlat)
  const c1 = apply3(b, centreFlat)
  return (t) => {
    const turn = rotation3(v3(0, 0, 0), axis, 2 * half * t)
    const c = lerp3(c0, c1, t)
    const shift = sub3(c, apply3(turn, c0))
    return compose3({ m: turn.m, t: shift }, a)
  }
}

/** The fold angle each edge of `after` had in `before`: the angle of the edge it lay on, or 0 inside a face. */
function anglesBefore(before: FoldState, after: FoldState): number[] {
  return after.edges.map((edge) => {
    const p = after.vertices[edge.vertices[0]]!
    const q = after.vertices[edge.vertices[1]]!
    for (const old of before.edges) {
      const a = before.vertices[old.vertices[0]]!
      const b = before.vertices[old.vertices[1]]!
      if (pointOnSegment(p, a, b) && pointOnSegment(q, a, b)) return old.foldAngle
    }
    return 0
  })
}

const maxDistance = (a: Vec3[], b: Vec3[]) => a.reduce((m, p, i) => Math.max(m, dist3(p, b[i]!)), 0)

/**
 * The motion of one action. Both states come from the engine: `after` is `before` with the action
 * applied. The motion runs on the faces of `after`, so a crease the action makes is there from the start.
 */
export function actionMotion(
  before: FoldState,
  after: FoldState,
  kind: FoldKind,
  options: {
    /** For a `rotate` action: its degrees, counter-clockwise as the viewer sees it, so a turn of more than 180° plays the long way. */
    turnDegrees?: number
  } = {},
): ActionMotion {
  const startPositions = after.vertices.map((p, vi) => foldedPositionOf(before, p) ?? after.folded[vi]!)
  const startAngles = anglesBefore(before, after)
  const endAngles = after.edges.map((e) => e.foldAngle)
  const start = cloneState(after)
  start.folded = startPositions
  start.edges.forEach((e, i) => (e.foldAngle = startAngles[i]!))

  // The root face: the largest face that does not move, else the largest face.
  const area = (f: number) => Math.abs(signedArea(flatPolygon(after, f)))
  const faces = after.faces.map((_, f) => f)
  const still = faces.filter((f) => after.faces[f]!.every((vi) => dist3(startPositions[vi]!, after.folded[vi]!) < 1e-6))
  const pool = still.length > 0 ? still : faces
  const root = pool.reduce((best, f) => (area(f) > area(best) ? f : best), pool[0]!)
  const c = centroid(flatPolygon(after, root))
  const rootPath = rigidPath(
    affineFromFaceMap(faceMap(start, root).toFolded),
    affineFromFaceMap(faceMap(after, root).toFolded),
    v3(c.x, c.y, 0),
    options.turnDegrees,
  )

  const anglesAt = (t: number) => startAngles.map((a, i) => a + (endAngles[i]! - a) * t)
  const rigidAt = (t: number) => {
    const trial = cloneState(after)
    const angles = anglesAt(t)
    trial.edges.forEach((e, i) => (e.foldAngle = angles[i]!))
    return { state: trial, result: geometryFromAngles(trial, root, rootPath(t)) }
  }
  // The rigid motion is the real one when it starts and ends at the engine's states and the creases
  // agree with each other all the way.
  const exact =
    maxDistance(rigidAt(0).result.folded, startPositions) < TOLERANCE &&
    maxDistance(rigidAt(1).result.folded, after.folded) < TOLERANCE &&
    MOTION_SAMPLES.every((t) => rigidAt(t).result.mismatch < TOLERANCE)

  return {
    kind,
    exact,
    stateAt(t) {
      const u = Math.min(1, Math.max(0, t))
      if (u === 1) return cloneState(after)
      if (u === 0) return cloneState(start)
      if (exact) {
        const { state, result } = rigidAt(u)
        state.folded = result.folded
        return state
      }
      const state = cloneState(after)
      const angles = anglesAt(u)
      state.edges.forEach((e, i) => (e.foldAngle = angles[i]!))
      state.folded = startPositions.map((p, vi) => lerp3(p, after.folded[vi]!, u))
      return state
    },
  }
}
