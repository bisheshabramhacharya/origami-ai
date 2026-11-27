import type { Vec2, Vec3 } from './geometry'
import type { Paper } from './language'
import type { Assignment, Edge, FoldRecord, FoldState } from './state'

/**
 * FOLD 1.1 export (https://github.com/edemaine/fold). The top level is the folded form; frame 1
 * (`file_frames[0]`) is the crease pattern on the flat sheet. Engine data the format has no field
 * for is kept under `origami:` keys, so a state survives a round trip.
 */
export interface FoldFile {
  file_spec: number
  file_creator: string
  file_classes: string[]
  frame_classes: string[]
  frame_unit: string
  vertices_coords: number[][]
  edges_vertices: number[][]
  edges_assignment: string[]
  edges_foldAngle: number[]
  faces_vertices: number[][]
  faceOrders: number[][]
  file_frames: Array<{
    frame_classes: string[]
    frame_parent: number
    frame_inherit: boolean
    vertices_coords: number[][]
  }>
  'origami:paper': Paper
  'origami:edges_creases': string[][]
  'origami:points': Record<string, [number, number]>
  'origami:folds': Array<{ name: string; fixedPoint: [number, number]; moved: number[][][] }>
  'origami:faceSides': number[]
}

const pt2 = (p: Vec2): [number, number] => [p.x, p.y]

export function toFold(state: FoldState): FoldFile {
  // FOLD faceOrders: [f, g, s], s = +1 when f is on the side g's normal points to.
  const normalTowardViewer = state.faces.map((_, f) => state.faceSides[f] === 1)
  return {
    file_spec: 1.1,
    file_creator: '@origami/fold',
    file_classes: ['singleModel'],
    frame_classes: ['foldedForm'],
    frame_unit: 'mm',
    vertices_coords: state.folded.map((p) => [p.x, p.y, p.z]),
    edges_vertices: state.edges.map((e) => [...e.vertices]),
    edges_assignment: state.edges.map((e) => e.assignment),
    edges_foldAngle: state.edges.map((e) => e.foldAngle),
    faces_vertices: state.faces.map((f) => [...f]),
    faceOrders: state.above.map(([u, l]) => [u, l, normalTowardViewer[l] ? 1 : -1]),
    file_frames: [
      {
        frame_classes: ['creasePattern'],
        frame_parent: 0,
        frame_inherit: true,
        vertices_coords: state.vertices.map(pt2),
      },
    ],
    'origami:paper': { ...state.paper },
    'origami:edges_creases': state.edges.map((e) => [...e.creases]),
    'origami:points': Object.fromEntries(Object.entries(state.points).map(([k, p]) => [k, pt2(p)])),
    'origami:folds': state.folds.map((r) => ({ name: r.name, fixedPoint: pt2(r.fixedPoint), moved: r.moved.map((poly) => poly.map(pt2)) })),
    'origami:faceSides': [...state.faceSides],
  }
}

const vec2 = (c: number[]): Vec2 => ({ x: c[0]!, y: c[1]! })
const vec3 = (c: number[]): Vec3 => ({ x: c[0]!, y: c[1]!, z: c[2] ?? 0 })

export function fromFold(file: FoldFile): FoldState {
  const cp = file.file_frames[0]
  if (!cp) throw new Error('This FOLD file has no crease pattern frame.')
  const creases = file['origami:edges_creases'] ?? []
  const faceSides = (file['origami:faceSides'] ?? file.faces_vertices.map(() => 1)) as Array<1 | -1>
  const edges: Edge[] = file.edges_vertices.map((ev, i) => ({
    vertices: [ev[0]!, ev[1]!],
    assignment: (file.edges_assignment[i] ?? 'F') as Assignment,
    foldAngle: file.edges_foldAngle[i] ?? 0,
    creases: [...(creases[i] ?? [])],
  }))
  const folds: FoldRecord[] = (file['origami:folds'] ?? []).map((r) => ({
    name: r.name,
    fixedPoint: vec2(r.fixedPoint),
    moved: r.moved.map((poly) => poly.map(vec2)),
  }))
  return {
    paper: { ...file['origami:paper'] },
    vertices: cp.vertices_coords.map(vec2),
    edges,
    faces: file.faces_vertices.map((f) => [...f]),
    folded: file.vertices_coords.map(vec3),
    above: file.faceOrders.map(([f, g, s]) =>
      (s === 1) === (faceSides[g!] === 1) ? ([f!, g!] as [number, number]) : ([g!, f!] as [number, number]),
    ),
    points: Object.fromEntries(Object.entries(file['origami:points'] ?? {}).map(([k, p]) => [k, vec2(p)])),
    folds,
    faceSides,
  }
}
