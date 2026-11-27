import {
  type Vec2,
  type Vec3,
  TOLERANCE_MM,
  add3,
  centroid,
  dist2,
  dist3,
  lerp2,
  lerp3,
  pointInConvex,
  scale3,
  signedArea,
  sub3,
  v2,
  v3,
} from './geometry'
import type { Paper } from './language'

/** FOLD edge assignments: Boundary, Valley, Mountain, Flat (a crease line with no fold). */
export type Assignment = 'B' | 'V' | 'M' | 'F'

export interface Edge {
  vertices: [number, number]
  assignment: Assignment
  /** Degrees. +180 is a flat valley, -180 a flat mountain, 0 unfolded. Seen from the coloured side. */
  foldAngle: number
  /** Names of the creases this edge belongs to. */
  creases: string[]
}

export interface FoldRecord {
  name: string
  /** A point (on the flat sheet) inside a face that did not move in this fold. */
  fixedPoint: Vec2
  /** The faces that moved in this fold, as polygons on the flat sheet. */
  moved: Vec2[][]
}

/**
 * A folded state: the crease pattern on the flat sheet, where every vertex sits now, and which
 * layer is above which.
 *
 * Frames:
 * - `vertices` are on the flat sheet in mm, x to the right, y up, coloured side toward you.
 * - `folded` is the viewer's frame in mm: x to the right, y up, z toward the viewer.
 */
export interface FoldState {
  paper: Paper
  vertices: Vec2[]
  edges: Edge[]
  /** Vertex indices, counter-clockwise on the flat sheet. Every face is convex. */
  faces: number[][]
  folded: Vec3[]
  /** [upper, lower]: face pairs that overlap in a flat state, upper nearer the viewer. */
  above: Array<[number, number]>
  /** Named points on the flat sheet. */
  points: Record<string, Vec2>
  /** Named folds in the order they were made. */
  folds: FoldRecord[]
  /** Per face: +1 when its coloured side faced the viewer in the last flat state, -1 otherwise. */
  faceSides: Array<1 | -1>
}

export function makeSheet(paper: Paper): FoldState {
  const w = paper.widthMm
  const h = paper.heightMm
  const vertices = [v2(0, 0), v2(w, 0), v2(w, h), v2(0, h)] // D, C, B, A
  return {
    paper: { ...paper },
    vertices,
    edges: [
      { vertices: [0, 1], assignment: 'B', foldAngle: 0, creases: [] },
      { vertices: [1, 2], assignment: 'B', foldAngle: 0, creases: [] },
      { vertices: [2, 3], assignment: 'B', foldAngle: 0, creases: [] },
      { vertices: [3, 0], assignment: 'B', foldAngle: 0, creases: [] },
    ],
    faces: [[0, 1, 2, 3]],
    folded: vertices.map((p) => v3(p.x, p.y, 0)),
    above: [],
    points: {
      A: v2(0, h),
      B: v2(w, h),
      C: v2(w, 0),
      D: v2(0, 0),
      AB: v2(w / 2, h),
      BC: v2(w, h / 2),
      CD: v2(w / 2, 0),
      DA: v2(0, h / 2),
      O: v2(w / 2, h / 2),
    },
    folds: [],
    faceSides: [1],
  }
}

export function cloneState(state: FoldState): FoldState {
  return {
    paper: { ...state.paper },
    vertices: state.vertices.map((p) => ({ ...p })),
    edges: state.edges.map((e) => ({ ...e, vertices: [...e.vertices] as [number, number], creases: [...e.creases] })),
    faces: state.faces.map((f) => [...f]),
    folded: state.folded.map((p) => ({ ...p })),
    above: state.above.map((pair) => [...pair] as [number, number]),
    points: Object.fromEntries(Object.entries(state.points).map(([k, p]) => [k, { ...p }])),
    folds: state.folds.map((r) => ({ name: r.name, fixedPoint: { ...r.fixedPoint }, moved: r.moved.map((poly) => poly.map((p) => ({ ...p }))) })),
    faceSides: [...state.faceSides],
  }
}

export const edgeKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`)

export function findEdge(state: FoldState, a: number, b: number): number {
  return state.edges.findIndex(
    (e) => (e.vertices[0] === a && e.vertices[1] === b) || (e.vertices[0] === b && e.vertices[1] === a),
  )
}

/** Map from edge key to the faces that use the edge. */
export function edgeFaces(state: FoldState): Map<string, number[]> {
  const map = new Map<string, number[]>()
  state.faces.forEach((face, fi) => {
    for (let i = 0; i < face.length; i += 1) {
      const key = edgeKey(face[i]!, face[(i + 1) % face.length]!)
      const list = map.get(key)
      if (list) list.push(fi)
      else map.set(key, [fi])
    }
  })
  return map
}

export function flatPolygon(state: FoldState, face: number): Vec2[] {
  return state.faces[face]!.map((vi) => state.vertices[vi]!)
}

export function foldedPolygon(state: FoldState, face: number): Vec2[] {
  return state.faces[face]!.map((vi) => {
    const p = state.folded[vi]!
    return v2(p.x, p.y)
  })
}

export function foldedPolygon3(state: FoldState, face: number): Vec3[] {
  return state.faces[face]!.map((vi) => state.folded[vi]!)
}

export function isFlat(state: FoldState): boolean {
  return state.folded.every((p) => Math.abs(p.z) <= TOLERANCE_MM * 100)
}

/** Unit normal of the coloured side of a face, in the viewer's frame. */
export function faceNormal(state: FoldState, face: number): Vec3 {
  const pts = foldedPolygon3(state, face)
  // Newell's method, robust for any planar polygon.
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    nx += (a.y - b.y) * (a.z + b.z)
    ny += (a.z - b.z) * (a.x + b.x)
    nz += (a.x - b.x) * (a.y + b.y)
  }
  const l = Math.hypot(nx, ny, nz) || 1
  return v3(nx / l, ny / l, nz / l)
}

/** In a flat state: true when the face shows its back (white) side to the viewer. */
export function isFlipped(state: FoldState, face: number): boolean {
  return signedArea(foldedPolygon(state, face)) < 0
}

/**
 * Affine map of a face from the flat sheet to the viewer frame, from three of its vertices.
 * Returns `toFolded` and, for flat states, `toFlat` (the inverse in the plane).
 */
export function faceMap(state: FoldState, face: number) {
  const ids = state.faces[face]!
  // Pick three vertices that span the most area, for a well-conditioned map.
  let best: [number, number, number] = [ids[0]!, ids[1]!, ids[2]!]
  let bestArea = 0
  for (let i = 1; i < ids.length - 1; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = Math.abs(signedArea([state.vertices[ids[0]!]!, state.vertices[ids[i]!]!, state.vertices[ids[j]!]!]))
      if (a > bestArea) {
        bestArea = a
        best = [ids[0]!, ids[i]!, ids[j]!]
      }
    }
  }
  const [i0, i1, i2] = best
  const p0 = state.vertices[i0]!
  const e1 = { x: state.vertices[i1]!.x - p0.x, y: state.vertices[i1]!.y - p0.y }
  const e2 = { x: state.vertices[i2]!.x - p0.x, y: state.vertices[i2]!.y - p0.y }
  const q0 = state.folded[i0]!
  const f1 = sub3(state.folded[i1]!, q0)
  const f2 = sub3(state.folded[i2]!, q0)
  const det = e1.x * e2.y - e1.y * e2.x
  const toFolded = (p: Vec2): Vec3 => {
    const dx = p.x - p0.x
    const dy = p.y - p0.y
    const a = (dx * e2.y - dy * e2.x) / det
    const b = (e1.x * dy - e1.y * dx) / det
    return add3(q0, add3(scale3(f1, a), scale3(f2, b)))
  }
  const fdet = f1.x * f2.y - f1.y * f2.x
  const toFlat = (q: Vec2): Vec2 => {
    const dx = q.x - q0.x
    const dy = q.y - q0.y
    const a = (dx * f2.y - dy * f2.x) / fdet
    const b = (f1.x * dy - f1.y * dx) / fdet
    return v2(p0.x + e1.x * a + e2.x * b, p0.y + e1.y * a + e2.y * b)
  }
  return { toFolded, toFlat }
}

/** Faces whose flat polygon holds the flat point (boundary included). */
export function facesAtFlatPoint(state: FoldState, p: Vec2): number[] {
  const out: number[] = []
  state.faces.forEach((_, fi) => {
    if (pointInConvex(flatPolygon(state, fi), p)) out.push(fi)
  })
  return out
}

/** Where a point of the flat sheet is now, or null when it is not on the paper. */
export function foldedPositionOf(state: FoldState, p: Vec2): Vec3 | null {
  for (let vi = 0; vi < state.vertices.length; vi += 1) {
    if (dist2(state.vertices[vi]!, p) <= TOLERANCE_MM * 10) return state.folded[vi]!
  }
  const faces = facesAtFlatPoint(state, p)
  if (faces.length === 0) return null
  return faceMap(state, faces[0]!).toFolded(p)
}

/**
 * Add a vertex at a flat point, reusing an existing vertex within tolerance.
 * `folded` is its position now.
 */
export function addVertex(state: FoldState, flat: Vec2, folded: Vec3): number {
  for (let vi = 0; vi < state.vertices.length; vi += 1) {
    if (dist2(state.vertices[vi]!, flat) <= TOLERANCE_MM * 10) return vi
  }
  state.vertices.push(flat)
  state.folded.push(folded)
  return state.vertices.length - 1
}

/** Split edge (a, b) at a new vertex w that lies on it. Faces that use the edge get w too. */
export function splitEdgeAt(state: FoldState, a: number, b: number, w: number): void {
  const ei = findEdge(state, a, b)
  if (ei < 0) throw new Error(`No edge between vertices ${a} and ${b}`)
  const edge = state.edges[ei]!
  state.edges[ei] = { ...edge, vertices: [a, w], creases: [...edge.creases] }
  state.edges.push({ ...edge, vertices: [w, b], creases: [...edge.creases] })
  for (const face of state.faces) {
    for (let i = 0; i < face.length; i += 1) {
      const u = face[i]!
      const v = face[(i + 1) % face.length]!
      if ((u === a && v === b) || (u === b && v === a)) {
        face.splice(i + 1, 0, w)
        break
      }
    }
  }
}

/** Point on a flat edge at parameter t, with its folded position. */
export function pointOnEdge(state: FoldState, a: number, b: number, t: number): { flat: Vec2; folded: Vec3 } {
  return {
    flat: lerp2(state.vertices[a]!, state.vertices[b]!, t),
    folded: lerp3(state.folded[a]!, state.folded[b]!, t),
  }
}

export function faceCentroidFlat(state: FoldState, face: number): Vec2 {
  return centroid(flatPolygon(state, face))
}

/** Pairs of the layer order as a lookup: 1 when a is above b, -1 when below, 0 unknown. */
export function orderLookup(state: FoldState): (a: number, b: number) => number {
  const map = new Map<string, number>()
  for (const [u, l] of state.above) {
    map.set(`${u}>${l}`, 1)
    map.set(`${l}>${u}`, -1)
  }
  return (a, b) => map.get(`${a}>${b}`) ?? 0
}

/** Display level of each face: how many layers it sits on, from the layer order (0 = bottom). */
export function faceLevels(state: FoldState): number[] {
  const below = new Map<number, number[]>()
  for (const [u, l] of state.above) {
    const list = below.get(u)
    if (list) list.push(l)
    else below.set(u, [l])
  }
  const levels = new Array<number>(state.faces.length).fill(-1)
  const visiting = new Set<number>()
  const level = (f: number): number => {
    if (levels[f]! >= 0) return levels[f]!
    if (visiting.has(f)) return 0
    visiting.add(f)
    let best = 0
    for (const l of below.get(f) ?? []) best = Math.max(best, level(l) + 1)
    visiting.delete(f)
    levels[f] = best
    return best
  }
  for (let f = 0; f < state.faces.length; f += 1) level(f)
  return levels
}

export function maxVertexMismatch(a: Vec3[], b: Vec3[]): number {
  let worst = 0
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) worst = Math.max(worst, dist3(a[i]!, b[i]!))
  return worst
}
