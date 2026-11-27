import { fail } from './errors'
import {
  type Line2,
  type Vec2,
  type Vec3,
  TOLERANCE_MM,
  convexHull,
  dist2,
  dist3,
  intersectLines,
  lineThrough,
  pointInConvex,
  pointOnSegment,
  sideOf,
  v2,
} from './geometry'
import type { LineRef, PointRef } from './language'
import { type FoldState, facesAtFlatPoint, foldedPolygon, foldedPositionOf, isFlat, orderLookup } from './state'

export interface ResolvedPoint {
  flat: Vec2
  folded: Vec3
  label: string
}

export interface ResolvedLine {
  /** The line in the viewer's plane. */
  line: Line2
  /** For a crease: its segments in the viewer's plane. */
  segments?: Array<[Vec2, Vec2]>
  label: string
}

export function pointLabel(ref: PointRef): string {
  if (typeof ref === 'string') return ref
  if ('along' in ref) return `the point ${ref.fraction} of the way from ${pointLabel(ref.along[0])} to ${pointLabel(ref.along[1])}`
  return `the meeting point of ${lineLabel(ref.intersect[0])} and ${lineLabel(ref.intersect[1])}`
}

export function lineLabel(ref: LineRef): string {
  if ('crease' in ref) return `crease ${ref.crease}`
  return `the line through ${pointLabel(ref.through[0])} and ${pointLabel(ref.through[1])}`
}

/** Edges that belong to a named crease. */
export function creaseEdges(state: FoldState, name: string): number[] {
  const out: number[] = []
  state.edges.forEach((edge, i) => {
    if (edge.creases.includes(name)) out.push(i)
  })
  return out
}

type FlatShape = { segments: Array<[Vec2, Vec2]> } | { line: Line2 }

function flatShape(state: FoldState, ref: LineRef): FlatShape {
  if ('crease' in ref) {
    const edges = creaseEdges(state, ref.crease)
    if (edges.length === 0) fail('references', `Crease "${ref.crease}" does not exist.`, ref.crease)
    return {
      segments: edges.map((ei) => {
        const [a, b] = state.edges[ei]!.vertices
        return [state.vertices[a]!, state.vertices[b]!] as [Vec2, Vec2]
      }),
    }
  }
  const p = resolvePoint(state, ref.through[0])
  const q = resolvePoint(state, ref.through[1])
  if (dist2(p.flat, q.flat) < TOLERANCE_MM * 10) fail('references', `${lineLabel(ref)} needs two different points.`, lineLabel(ref))
  return { line: lineThrough(p.flat, q.flat) }
}

function shapeIntersections(a: FlatShape, b: FlatShape): Vec2[] {
  const out: Vec2[] = []
  const segsA = 'segments' in a ? a.segments : null
  const segsB = 'segments' in b ? b.segments : null
  const lineA = 'line' in a ? a.line : null
  const lineB = 'line' in b ? b.line : null
  const push = (p: Vec2 | null) => {
    if (p && !out.some((q) => dist2(p, q) < TOLERANCE_MM * 100)) out.push(p)
  }
  if (lineA && lineB) push(intersectLines(lineA, lineB))
  if (lineA && segsB) for (const [p, q] of segsB) {
    const x = intersectLines(lineA, lineThrough(p, q))
    if (x && pointOnSegment(x, p, q)) push(x)
  }
  if (segsA && lineB) for (const [p, q] of segsA) {
    const x = intersectLines(lineB, lineThrough(p, q))
    if (x && pointOnSegment(x, p, q)) push(x)
  }
  if (segsA && segsB) {
    for (const [p, q] of segsA) {
      for (const [r, s] of segsB) {
        const x = intersectLines(lineThrough(p, q), lineThrough(r, s))
        if (x && pointOnSegment(x, p, q) && pointOnSegment(x, r, s)) push(x)
      }
    }
  }
  return out
}

export function resolvePoint(state: FoldState, ref: PointRef): ResolvedPoint {
  if (typeof ref === 'string') {
    const flat = state.points[ref]
    if (!flat) fail('references', `Point "${ref}" does not exist.`, ref)
    const folded = foldedPositionOf(state, flat)
    if (!folded) fail('references', `Point "${ref}" is not on the paper.`, ref)
    return { flat, folded, label: ref }
  }
  const label = pointLabel(ref)
  if ('along' in ref) {
    const p = resolvePoint(state, ref.along[0])
    const q = resolvePoint(state, ref.along[1])
    const flat = v2(p.flat.x + (q.flat.x - p.flat.x) * ref.fraction, p.flat.y + (q.flat.y - p.flat.y) * ref.fraction)
    const folded = foldedPositionOf(state, flat)
    if (!folded) fail('references', `${label} is not on the paper.`, label)
    return { flat, folded, label }
  }
  const hits = shapeIntersections(flatShape(state, ref.intersect[0]), flatShape(state, ref.intersect[1]))
    .map((flat) => ({ flat, folded: foldedPositionOf(state, flat) }))
    .filter((hit): hit is { flat: Vec2; folded: Vec3 } => hit.folded !== null)
  if (hits.length === 0) fail('references', `${lineLabel(ref.intersect[0])} and ${lineLabel(ref.intersect[1])} do not meet on the paper.`, label)
  const first = hits[0]!
  if (hits.some((h) => dist3(h.folded, first.folded) > 1e-3)) {
    fail('references', `${lineLabel(ref.intersect[0])} and ${lineLabel(ref.intersect[1])} meet at more than one place.`, label)
  }
  return { flat: first.flat, folded: first.folded, label }
}

export function resolveLine(state: FoldState, ref: LineRef): ResolvedLine {
  const label = lineLabel(ref)
  if ('crease' in ref) {
    const edges = creaseEdges(state, ref.crease)
    if (edges.length === 0) fail('references', `Crease "${ref.crease}" does not exist.`, ref.crease)
    const segments = edges.map((ei) => {
      const [a, b] = state.edges[ei]!.vertices
      const p = state.folded[a]!
      const q = state.folded[b]!
      return [v2(p.x, p.y), v2(q.x, q.y)] as [Vec2, Vec2]
    })
    // The longest segment sets the line; every other segment must lie on it.
    let longest = segments[0]!
    for (const s of segments) if (dist2(s[0], s[1]) > dist2(longest[0], longest[1])) longest = s
    const line = lineThrough(longest[0], longest[1])
    for (const [p, q] of segments) {
      if (Math.abs(sideOf(line, p)) > 1e-3 || Math.abs(sideOf(line, q)) > 1e-3) {
        fail('references', `Crease "${ref.crease}" is not one straight line in the folded state. Name two points on the part you mean.`, ref.crease)
      }
    }
    return { line, segments, label }
  }
  const p = resolvePoint(state, ref.through[0])
  const q = resolvePoint(state, ref.through[1])
  if (dist2(v2(p.folded.x, p.folded.y), v2(q.folded.x, q.folded.y)) < TOLERANCE_MM * 100) {
    fail('references', `${label} needs two points that are apart in the folded state.`, label)
  }
  return { line: lineThrough(v2(p.folded.x, p.folded.y), v2(q.folded.x, q.folded.y)), label }
}

/**
 * A point a fold uses must be reachable: on the outline of the model, or on a layer with nothing
 * above it at that spot. A point under other layers is hidden.
 */
export function assertReachable(state: FoldState, point: ResolvedPoint): void {
  if (!isFlat(state)) return
  const at = v2(point.folded.x, point.folded.y)
  const hull = convexHull(state.folded.map((p) => v2(p.x, p.y)))
  if (hull.length >= 3 && !pointInConvex(hull, at, true)) return
  const carriers = facesAtFlatPoint(state, point.flat)
  const order = orderLookup(state)
  const covers = state.faces
    .map((_, f) => f)
    .filter((f) => !carriers.includes(f) && pointInConvex(foldedPolygon(state, f), at, true))
  // Reachable when at least one face that carries the point has nothing above it there.
  const covered = carriers.every((c) => covers.some((f) => order(f, c) === 1))
  if (covered) {
    const name = point.label.startsWith('the ') ? `T${point.label.slice(1)}` : `Point ${point.label}`
    fail('references', `${name} is hidden under other layers.`, point.label)
  }
}
