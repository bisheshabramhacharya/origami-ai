/**
 * Small, exact-enough plane and space geometry for the fold engine.
 * All lengths are millimetres. TOLERANCE_MM is the one place "same point" and "same length" is decided.
 */

export const TOLERANCE_MM = 1e-6
/** Smallest overlap area (mm²) that counts as two faces really lying on top of each other. */
export const AREA_TOLERANCE_MM2 = 1e-4

export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export const v2 = (x: number, y: number): Vec2 => ({ x, y })
export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

export const add2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale2 = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const dot2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const cross2 = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x
export const len2 = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
export const norm2 = (a: Vec2): Vec2 => {
  const l = len2(a)
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}
export const same2 = (a: Vec2, b: Vec2, tol = TOLERANCE_MM * 10): boolean => dist2(a, b) <= tol

export const add3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
export const sub3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
export const scale3 = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s })
export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
export const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
export const len3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z)
export const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
})
export const norm3 = (a: Vec3): Vec3 => {
  const l = len3(a)
  return l === 0 ? { x: 0, y: 0, z: 0 } : { x: a.x / l, y: a.y / l, z: a.z / l }
}

/** Rotate point p about the axis through `origin` with unit direction `axis`, by `angle` radians (right hand rule). */
export function rotateAbout(p: Vec3, origin: Vec3, axis: Vec3, angle: number): Vec3 {
  const v = sub3(p, origin)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = axis
  const kv = cross3(k, v)
  const kdv = dot3(k, v)
  const r = {
    x: v.x * c + kv.x * s + k.x * kdv * (1 - c),
    y: v.y * c + kv.y * s + k.y * kdv * (1 - c),
    z: v.z * c + kv.z * s + k.z * kdv * (1 - c),
  }
  return add3(r, origin)
}

/** A line in the plane: a point and a unit direction. */
export interface Line2 {
  origin: Vec2
  dir: Vec2
}

export function lineThrough(a: Vec2, b: Vec2): Line2 {
  return { origin: a, dir: norm2(sub2(b, a)) }
}

/** Signed distance of p from the line; positive on the left of the direction. */
export function sideOf(line: Line2, p: Vec2): number {
  return cross2(line.dir, sub2(p, line.origin))
}

export function reflectAcross(line: Line2, p: Vec2): Vec2 {
  const d = sub2(p, line.origin)
  const along = dot2(d, line.dir)
  const foot = add2(line.origin, scale2(line.dir, along))
  return sub2(scale2(foot, 2), p)
}

export function intersectLines(a: Line2, b: Line2): Vec2 | null {
  const denom = cross2(a.dir, b.dir)
  if (Math.abs(denom) < 1e-12) return null
  const t = cross2(sub2(b.origin, a.origin), b.dir) / denom
  return add2(a.origin, scale2(a.dir, t))
}

export function linesParallel(a: Line2, b: Line2): boolean {
  return Math.abs(cross2(a.dir, b.dir)) < 1e-9
}

export function sameLine(a: Line2, b: Line2, tol = TOLERANCE_MM * 100): boolean {
  return linesParallel(a, b) && Math.abs(sideOf(a, b.origin)) <= tol
}

/** Signed area, positive when the points run counter-clockwise. */
export function signedArea(points: Vec2[]): number {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    total += a.x * b.y - b.x * a.y
  }
  return total / 2
}

export function centroid(points: Vec2[]): Vec2 {
  // Area centroid; falls back to the vertex mean for a degenerate polygon.
  const area = signedArea(points)
  if (Math.abs(area) < 1e-12) {
    const s = points.reduce((acc, p) => add2(acc, p), v2(0, 0))
    return scale2(s, 1 / points.length)
  }
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    const f = a.x * b.y - b.x * a.y
    cx += (a.x + b.x) * f
    cy += (a.y + b.y) * f
  }
  return v2(cx / (6 * area), cy / (6 * area))
}

/** Clip a convex polygon to the left half-plane of a line (keeps sideOf >= -tol). */
export function clipHalfPlane(poly: Vec2[], line: Line2, keepLeft = true): Vec2[] {
  const out: Vec2[] = []
  const s = (p: Vec2) => (keepLeft ? sideOf(line, p) : -sideOf(line, p))
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const sa = s(a)
    const sb = s(b)
    if (sa >= 0) out.push(a)
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb)
      out.push(lerp2(a, b, t))
    }
  }
  return out
}

/** Intersection of two convex polygons (any orientation). */
export function clipConvex(subject: Vec2[], clip: Vec2[]): Vec2[] {
  const ccw = signedArea(clip) >= 0
  let out = subject
  for (let i = 0; i < clip.length && out.length > 0; i += 1) {
    const a = clip[i]!
    const b = clip[(i + 1) % clip.length]!
    if (dist2(a, b) < 1e-12) continue
    out = clipHalfPlane(out, lineThrough(a, b), ccw)
  }
  return out
}

export function overlapArea(a: Vec2[], b: Vec2[]): number {
  const clipped = clipConvex(a, b)
  return clipped.length < 3 ? 0 : Math.abs(signedArea(clipped))
}

export interface Box2 {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boxOf(points: Vec2[]): Box2 {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

export function boxesOverlap(a: Box2, b: Box2, tol = TOLERANCE_MM): boolean {
  return a.minX < b.maxX - tol && b.minX < a.maxX - tol && a.minY < b.maxY - tol && b.minY < a.maxY - tol
}

/** Point in convex polygon. `strict` excludes the boundary. */
export function pointInConvex(poly: Vec2[], p: Vec2, strict = false, tol = TOLERANCE_MM * 100): boolean {
  const ccw = signedArea(poly) >= 0
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    if (dist2(a, b) < 1e-12) continue
    const s = sideOf(lineThrough(a, b), p) * (ccw ? 1 : -1)
    if (strict ? s <= tol : s < -tol) return false
  }
  return true
}

export function pointOnSegment(p: Vec2, a: Vec2, b: Vec2, tol = TOLERANCE_MM * 100): boolean {
  const ab = sub2(b, a)
  const l = len2(ab)
  if (l < 1e-12) return dist2(p, a) <= tol
  const t = dot2(sub2(p, a), ab) / (l * l)
  if (t < -tol / l || t > 1 + tol / l) return false
  return Math.abs(cross2(ab, sub2(p, a))) / l <= tol
}

/** Convex hull (Andrew's monotone chain), counter-clockwise, collinear points dropped. */
export function convexHull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const unique: Vec2[] = []
  for (const p of pts) if (!unique.some((q) => same2(p, q, 1e-6))) unique.push(p)
  if (unique.length < 3) return unique
  const turn = (o: Vec2, a: Vec2, b: Vec2) => cross2(sub2(a, o), sub2(b, o))
  const lower: Vec2[] = []
  for (const p of unique) {
    while (lower.length >= 2 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 1e-7) lower.pop()
    lower.push(p)
  }
  const upper: Vec2[] = []
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const p = unique[i]!
    while (upper.length >= 2 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 1e-7) upper.pop()
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  return [...lower, ...upper]
}

export const DEG = Math.PI / 180
