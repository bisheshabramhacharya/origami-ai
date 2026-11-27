import { type Affine3, affineFromFaceMap, apply3, compose3, flatTo3, rotation3 } from './affine'
import { DEG, type Vec2, type Vec3, centroid, dist3, lineThrough, sideOf, sub2, v3 } from './geometry'
import { type FoldState, edgeKey, faceMap, flatPolygon } from './state'

export interface GeometryResult {
  folded: Vec3[]
  /** Per face: its map from the flat sheet to the viewer frame. */
  transforms: Affine3[]
  /** The worst disagreement between two paths of faces around a vertex, in mm. */
  mismatch: number
  mismatchVertex: number
}

/**
 * Work out where every vertex sits from the fold angles of the creases.
 * Starts at `root` with the given map and walks across shared edges.
 */
export function geometryFromAngles(state: FoldState, root: number, rootMap?: Affine3): GeometryResult {
  const n = state.faces.length
  const edgeIndex = new Map<string, number>()
  state.edges.forEach((e, i) => edgeIndex.set(edgeKey(e.vertices[0], e.vertices[1]), i))
  const byEdge = new Map<string, number[]>()
  state.faces.forEach((face, f) => {
    for (let i = 0; i < face.length; i += 1) {
      const key = edgeKey(face[i]!, face[(i + 1) % face.length]!)
      const list = byEdge.get(key)
      if (list) list.push(f)
      else byEdge.set(key, [f])
    }
  })
  const centroids = state.faces.map((_, f) => centroid(flatPolygon(state, f)))

  const transforms: Array<Affine3 | null> = new Array(n).fill(null)
  transforms[root] = rootMap ?? affineFromFaceMap(faceMap(state, root).toFolded)
  const queue = [root]
  const folded: Array<Vec3 | null> = new Array(state.vertices.length).fill(null)
  let mismatch = 0
  let mismatchVertex = -1
  while (queue.length > 0) {
    const f = queue.shift()!
    const t = transforms[f]!
    const face = state.faces[f]!
    for (const vi of face) {
      const p = apply3(t, flatTo3(state.vertices[vi]!))
      const known = folded[vi]
      if (!known) folded[vi] = p
      else {
        const d = dist3(known, p)
        if (d > mismatch) {
          mismatch = d
          mismatchVertex = vi
        }
      }
    }
    for (let i = 0; i < face.length; i += 1) {
      const u = face[i]!
      const w = face[(i + 1) % face.length]!
      const key = edgeKey(u, w)
      for (const g of byEdge.get(key) ?? []) {
        if (g === f || transforms[g]) continue
        const edge = state.edges[edgeIndex.get(key)!]!
        const p = state.vertices[u]!
        const q = state.vertices[w]!
        const left = sideOf(lineThrough(p, q), centroids[g]!) > 0
        const angle = edge.foldAngle * DEG * (left ? 1 : -1)
        const d: Vec2 = sub2(q, p)
        const r = rotation3(flatTo3(p), v3(d.x, d.y, 0), angle)
        transforms[g] = compose3(t, r)
        queue.push(g)
      }
    }
  }
  // Faces not reached (should not happen on one sheet) keep their place.
  for (let vi = 0; vi < folded.length; vi += 1) if (!folded[vi]) folded[vi] = state.folded[vi]!
  return {
    folded: folded.map((p) => cleanZ(p!)),
    transforms: transforms.map((t, f) => t ?? affineFromFaceMap(faceMap(state, f).toFolded)),
    mismatch,
    mismatchVertex,
  }
}

export function cleanZ(p: Vec3): Vec3 {
  return Math.abs(p.z) < 1e-9 ? v3(p.x, p.y, 0) : p
}

/**
 * Best rotation (about z) and shift that moves `from` onto `to`, applied to `from`.
 * Keeps the model in its place on the table after a compound fold.
 */
export function alignInPlane(from: Vec3[], to: Vec3[]): Vec3[] {
  const n = Math.min(from.length, to.length)
  if (n === 0) return from
  let fx = 0
  let fy = 0
  let tx = 0
  let ty = 0
  for (let i = 0; i < n; i += 1) {
    fx += from[i]!.x
    fy += from[i]!.y
    tx += to[i]!.x
    ty += to[i]!.y
  }
  fx /= n
  fy /= n
  tx /= n
  ty /= n
  let sDot = 0
  let sCross = 0
  for (let i = 0; i < n; i += 1) {
    const ax = from[i]!.x - fx
    const ay = from[i]!.y - fy
    const bx = to[i]!.x - tx
    const by = to[i]!.y - ty
    sDot += ax * bx + ay * by
    sCross += ax * by - ay * bx
  }
  const theta = Math.atan2(sCross, sDot)
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return from.map((p) => {
    const x = p.x - fx
    const y = p.y - fy
    return v3(c * x - s * y + tx, s * x + c * y + ty, p.z)
  })
}
