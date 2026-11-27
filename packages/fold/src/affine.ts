import { type Vec2, type Vec3, add3, cross3, norm3, rotateAbout, sub3, v3 } from './geometry'

/** A rigid map of 3D space: p -> m·p + t, with m a 3×3 matrix in row-major order. */
export interface Affine3 {
  m: number[]
  t: Vec3
}

export const identity3: Affine3 = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: v3(0, 0, 0) }

export function apply3(a: Affine3, p: Vec3): Vec3 {
  const m = a.m
  return v3(
    m[0]! * p.x + m[1]! * p.y + m[2]! * p.z + a.t.x,
    m[3]! * p.x + m[4]! * p.y + m[5]! * p.z + a.t.y,
    m[6]! * p.x + m[7]! * p.y + m[8]! * p.z + a.t.z,
  )
}

export function compose3(a: Affine3, b: Affine3): Affine3 {
  const m = new Array<number>(9).fill(0)
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      let s = 0
      for (let k = 0; k < 3; k += 1) s += a.m[r * 3 + k]! * b.m[k * 3 + c]!
      m[r * 3 + c] = s
    }
  }
  return { m, t: apply3(a, b.t) }
}

/** Rotation by `angle` radians about the axis through `origin` with direction `axis`. */
export function rotation3(origin: Vec3, axis: Vec3, angle: number): Affine3 {
  const k = norm3(axis)
  const o = v3(0, 0, 0)
  const cols = [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].map((e) => rotateAbout(e, o, k, angle))
  const m = [cols[0]!.x, cols[1]!.x, cols[2]!.x, cols[0]!.y, cols[1]!.y, cols[2]!.y, cols[0]!.z, cols[1]!.z, cols[2]!.z]
  // p -> R(p - o) + o  =>  t = o - R o
  const r = { m, t: v3(0, 0, 0) }
  const ro = apply3(r, origin)
  return { m, t: sub3(origin, ro) }
}

/** The affine map of a face from its flat-sheet map (flat point -> viewer point). */
export function affineFromFaceMap(toFolded: (p: Vec2) => Vec3): Affine3 {
  const o = toFolded({ x: 0, y: 0 })
  const ex = sub3(toFolded({ x: 1, y: 0 }), o)
  const ey = sub3(toFolded({ x: 0, y: 1 }), o)
  const ez = norm3(cross3(ex, ey))
  return { m: [ex.x, ey.x, ez.x, ex.y, ey.y, ez.y, ex.z, ey.z, ez.z], t: o }
}

export const flatTo3 = (p: Vec2): Vec3 => v3(p.x, p.y, 0)
export { add3 }
