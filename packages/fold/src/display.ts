import { type Vec2, type Vec3, add3, boxOf, convexHull, pointInConvex, scale3, v2 } from './geometry'
import { type FoldState, faceLevels, faceNormal, foldedPolygon, isFlat } from './state'

export type DisplayEdgeKind = 'valley' | 'mountain' | 'crease'

export interface DisplayFace {
  index: number
  /** Corners in the viewer frame (mm), lifted by the face's layer so layers do not fight. */
  points: Vec3[]
  /** The same corners on the flat sheet (mm), for texture or pattern drawing. */
  flat: Vec2[]
  /** Unit normal of the coloured side in the viewer frame. */
  normal: Vec3
}

export interface DisplayEdge {
  kind: DisplayEdgeKind
  from: Vec3
  to: Vec3
}

export interface DisplayMesh {
  faces: DisplayFace[]
  /** Creases to draw on the paper: flat creases, and valley or mountain creases not yet folded flat. */
  edges: DisplayEdge[]
  /** Paper size, so a viewer can scale and centre the model. */
  box: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }
}

export interface DisplayOptions {
  /** Space between layers in mm. */
  layerGapMm?: number
}

/** A mesh a 3D view can draw directly. No geometry happens in the app. */
export function displayMesh(state: FoldState, options: DisplayOptions = {}): DisplayMesh {
  const gap = options.layerGapMm ?? 0.2
  const levels = faceLevels(state)
  const flat = isFlat(state)
  const faces: DisplayFace[] = state.faces.map((face, f) => {
    const normal = faceNormal(state, f)
    const towardViewer = flat ? { x: 0, y: 0, z: 1 } : scale3(normal, state.faceSides[f] ?? 1)
    const lift = scale3(towardViewer, levels[f]! * gap)
    return {
      index: f,
      points: face.map((vi) => add3(state.folded[vi]!, lift)),
      flat: face.map((vi) => ({ ...state.vertices[vi]! })),
      normal,
    }
  })
  const edges: DisplayEdge[] = []
  const faceOfEdge = new Map<string, number>()
  state.faces.forEach((face, f) => {
    for (let i = 0; i < face.length; i += 1) {
      const a = face[i]!
      const b = face[(i + 1) % face.length]!
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      if (!faceOfEdge.has(key) || levels[f]! > levels[faceOfEdge.get(key)!]!) faceOfEdge.set(key, f)
    }
  })
  for (const edge of state.edges) {
    let kind: DisplayEdgeKind | null = null
    if (edge.assignment === 'F' && edge.creases.length > 0) kind = 'crease'
    else if ((edge.assignment === 'V' || edge.assignment === 'M') && Math.abs(edge.foldAngle) < 179.999) {
      kind = edge.assignment === 'V' ? 'valley' : 'mountain'
    }
    if (!kind) continue
    const [a, b] = edge.vertices
    const f = faceOfEdge.get(a < b ? `${a}-${b}` : `${b}-${a}`)
    const lift = f === undefined ? { x: 0, y: 0, z: 0 } : scale3({ x: 0, y: 0, z: 1 }, flat ? levels[f]! * gap + gap / 2 : 0)
    edges.push({ kind, from: add3(state.folded[a]!, lift), to: add3(state.folded[b]!, lift) })
  }
  const all = faces.flatMap((f) => f.points)
  const box2 = boxOf(all.map((p) => v2(p.x, p.y)))
  const zs = all.map((p) => p.z)
  return {
    faces,
    edges,
    box: { minX: box2.minX, minY: box2.minY, minZ: Math.min(...zs), maxX: box2.maxX, maxY: box2.maxY, maxZ: Math.max(...zs) },
  }
}

/** Width and height of the folded model as it lies on the table, in mm. */
export function boundingBox(state: FoldState): { widthMm: number; heightMm: number; depthMm: number } {
  const b = boxOf(state.folded.map((p) => v2(p.x, p.y)))
  const zs = state.folded.map((p) => p.z)
  return { widthMm: b.maxX - b.minX, heightMm: b.maxY - b.minY, depthMm: Math.max(...zs) - Math.min(...zs) }
}

/** The outline of the model seen from the viewer (convex hull). */
export function outline(state: FoldState): Vec2[] {
  return convexHull(state.folded.map((p) => v2(p.x, p.y)))
}

/** The faces at a point of the folded model, from the top layer down. A point on an edge counts only the faces it is inside. */
export function stackAt(state: FoldState, at: Vec2): number[] {
  const levels = faceLevels(state)
  return state.faces
    .map((_, f) => f)
    .filter((f) => pointInConvex(foldedPolygon(state, f), at, false))
    .sort((a, b) => levels[b]! - levels[a]!)
}

/** How many layers of paper are under a point of the viewer's plane. */
export function layersAt(state: FoldState, at: Vec2): number {
  return state.faces.filter((_, f) => pointInConvex(foldedPolygon(state, f), at, true)).length
}
