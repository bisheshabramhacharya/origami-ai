import { affineFromFaceMap } from './affine'
import { fail } from './errors'
import {
  AREA_TOLERANCE_MM2,
  DEG,
  type Line2,
  type Vec2,
  type Vec3,
  TOLERANCE_MM,
  boxOf,
  centroid,
  clipHalfPlane,
  dist2,
  intersectLines,
  lerp2,
  lerp3,
  lineThrough,
  linesParallel,
  norm2,
  overlapArea,
  pointInConvex,
  pointOnSegment,
  reflectAcross,
  rotateAbout,
  sideOf,
  signedArea,
  sub2,
  v2,
  v3,
} from './geometry'
import { alignInPlane, cleanZ, geometryFromAngles } from './geometry-solve'
import type { Compound, FoldAction, FoldKind, Open, Reverse, SimpleFold } from './language'
import { solveLayers } from './layers'
import { assertReachable, creaseEdges, resolveLine, resolvePoint } from './refs'
import {
  type Assignment,
  type FoldState,
  addVertex,
  cloneState,
  edgeKey,
  faceLevels,
  facesAtFlatPoint,
  faceMap,
  findEdge,
  flatPolygon,
  foldedPolygon,
  isFlat,
  isFlipped,
  orderLookup,
  splitEdgeAt,
} from './state'

const SIDE_TOLERANCE_MM = TOLERANCE_MM * 100

export interface ActionResult {
  state: FoldState
  kind: FoldKind
}

/** Apply one action to a state. The input state does not change. Throws FoldCheckError. */
export function applyAction(input: FoldState, action: FoldAction): ActionResult {
  const state = cloneState(input)
  switch (action.kind) {
    case 'valley':
    case 'mountain':
      return { state: simpleFold(state, action), kind: action.kind }
    case 'unfold':
      return { state: unfold(state, action.last, action.creases), kind: 'unfold' }
    case 'turn-over':
      return { state: turnOver(state, action.axis), kind: 'turn-over' }
    case 'rotate':
      return { state: rotate(state, action.degrees), kind: 'rotate' }
    case 'collapse':
    case 'squash':
    case 'petal':
      return { state: compound(state, action), kind: action.kind }
    case 'inside-reverse':
    case 'outside-reverse':
      return { state: reverseFold(state, action), kind: action.kind }
    case 'open':
      return { state: openFlaps(state, action), kind: 'open' }
  }
}

// ---------------------------------------------------------------------------------------------
// Fold lines

interface FoldLineResult {
  line: Line2
  /** A point on the side that moves (viewer frame). */
  movingAt: Vec2 | null
  /** A flat-sheet point on the paper that moves, used to find the layer that moves. */
  seed: { flat: Vec2; folded: Vec2 } | null
}

const flat2 = (p: Vec3): Vec2 => v2(p.x, p.y)

function resolveFoldLine(state: FoldState, line: SimpleFold['line'], moving: SimpleFold['moving']): FoldLineResult {
  if ('bring' in line) {
    const p = resolvePoint(state, line.bring)
    const q = resolvePoint(state, line.to)
    const a = flat2(p.folded)
    const b = flat2(q.folded)
    if (dist2(a, b) < SIDE_TOLERANCE_MM) fail('axiom', `${p.label} is already on ${q.label}.`, p.label)
    assertReachable(state, p)
    const mid = lerp2(a, b, 0.5)
    const d = norm2(sub2(b, a))
    return { line: { origin: mid, dir: v2(-d.y, d.x) }, movingAt: a, seed: { flat: p.flat, folded: a } }
  }
  if ('bringEdge' in line) {
    const p1 = resolvePoint(state, line.bringEdge[0])
    const p2 = resolvePoint(state, line.bringEdge[1])
    const target = resolveLine(state, line.to)
    const a = flat2(p1.folded)
    const b = flat2(p2.folded)
    if (dist2(a, b) < SIDE_TOLERANCE_MM) fail('axiom', `${p1.label} and ${p2.label} are at the same place.`, p2.label)
    const edge = lineThrough(a, b)
    const candidates: Line2[] = []
    if (linesParallel(edge, target.line)) {
      // The crease is halfway between the edge and the target line: a quarter of the way to a's mirror image.
      const mirror = reflectAcross(target.line, a)
      candidates.push({ origin: lerp2(a, mirror, 0.25), dir: edge.dir })
    } else {
      const x = intersectLines(edge, target.line)!
      const u = edge.dir
      for (const w of [target.line.dir, v2(-target.line.dir.x, -target.line.dir.y)]) {
        const s = v2(u.x + w.x, u.y + w.y)
        if (Math.hypot(s.x, s.y) < 1e-9) continue
        candidates.push({ origin: x, dir: norm2(s) })
      }
    }
    const scored = candidates
      .map((c) => {
        const image = reflectAcross(c, b)
        const onTarget = target.segments ? target.segments.some(([s, t]) => pointOnSegment(image, s, t, 1e-3)) : true
        return { c, onTarget, travel: dist2(image, b) }
      })
      .filter((s) => s.travel > SIDE_TOLERANCE_MM)
      .sort((x, y) => Number(y.onTarget) - Number(x.onTarget) || x.travel - y.travel)
    if (scored.length === 0) fail('axiom', `The edge ${p1.label}–${p2.label} is already on ${target.label}.`, p2.label)
    return { line: scored[0]!.c, movingAt: b, seed: { flat: p2.flat, folded: b } }
  }
  let resolved: Line2
  if ('pivot' in line) {
    const p = resolvePoint(state, line.pivot)
    const a = line.angleDeg * DEG
    resolved = { origin: flat2(p.folded), dir: v2(Math.cos(a), Math.sin(a)) }
  } else if ('through' in line) {
    resolved = resolveLine(state, { through: line.through }).line
  } else {
    resolved = resolveLine(state, { crease: line.crease }).line
  }
  if (moving !== undefined) {
    const m = resolvePoint(state, moving)
    const at = flat2(m.folded)
    if (Math.abs(sideOf(resolved, at)) < SIDE_TOLERANCE_MM) fail('axiom', `${m.label} is on the fold line, so it cannot say which side moves.`, m.label)
    return { line: resolved, movingAt: at, seed: { flat: m.flat, folded: at } }
  }
  return { line: resolved, movingAt: null, seed: null }
}

/** Paper area on each side of a line, in the viewer frame. */
function areaBySide(state: FoldState, line: Line2): { left: number; right: number } {
  let left = 0
  let right = 0
  state.faces.forEach((_, f) => {
    const poly = foldedPolygon(state, f)
    left += Math.abs(signedArea(clipHalfPlane(poly, line, true)))
    right += Math.abs(signedArea(clipHalfPlane(poly, line, false)))
  })
  return { left, right }
}

// ---------------------------------------------------------------------------------------------
// Splitting faces along a line

/** Signed side of a vertex (viewer frame), 0 when on the line. */
function vertexSide(state: FoldState, line: Line2, vi: number): number {
  const s = sideOf(line, flat2(state.folded[vi]!))
  return Math.abs(s) <= SIDE_TOLERANCE_MM ? 0 : Math.sign(s)
}

function faceTouches(state: FoldState, line: Line2, f: number, side: number): boolean {
  return state.faces[f]!.some((vi) => vertexSide(state, line, vi) === side)
}

/**
 * Split the given faces where the line crosses them. New faces are appended and inherit layer
 * order. Returns the parent of every face (old faces are their own parent).
 */
function splitFaces(state: FoldState, line: Line2, which: Set<number>): number[] {
  const parent = state.faces.map((_, f) => f)
  for (const f of [...which].sort((a, b) => a - b)) {
    if (!faceTouches(state, line, f, 1) || !faceTouches(state, line, f, -1)) continue
    // 1. Put a vertex where the line crosses each edge of the face.
    const face = [...state.faces[f]!]
    for (let i = 0; i < face.length; i += 1) {
      const u = face[i]!
      const w = face[(i + 1) % face.length]!
      const su = sideOf(line, flat2(state.folded[u]!))
      const sw = sideOf(line, flat2(state.folded[w]!))
      if (vertexSide(state, line, u) * vertexSide(state, line, w) >= 0) continue
      const t = su / (su - sw)
      const flat = lerp2(state.vertices[u]!, state.vertices[w]!, t)
      const folded = lerp3(state.folded[u]!, state.folded[w]!, t)
      const nv = addVertex(state, flat, folded)
      if (nv !== u && nv !== w && findEdge(state, u, w) >= 0) splitEdgeAt(state, u, w, nv)
    }
    // 2. Cut the face between its two vertices on the line.
    const ring = state.faces[f]!
    const onLine = ring.map((vi, i) => (vertexSide(state, line, vi) === 0 ? i : -1)).filter((i) => i >= 0)
    if (onLine.length !== 2) fail('axiom', 'The fold line crosses a layer in a way the engine cannot cut.', `face ${f}`)
    const [i, j] = onLine as [number, number]
    const first = ring.slice(i, j + 1)
    const second = [...ring.slice(j), ...ring.slice(0, i + 1)]
    state.faces[f] = first
    state.faces.push(second)
    const g = state.faces.length - 1
    parent.push(f)
    state.faceSides.push(state.faceSides[f]!)
    state.edges.push({ vertices: [ring[i]!, ring[j]!], assignment: 'F', foldAngle: 0, creases: [] })
    const inherited: Array<[number, number]> = []
    for (const [u, l] of state.above) {
      if (u === f) inherited.push([g, l])
      if (l === f) inherited.push([u, g])
    }
    state.above.push(...inherited)
  }
  return parent
}

// ---------------------------------------------------------------------------------------------
// Simple folds

function topmost(state: FoldState, candidates: number[]): number | null {
  if (candidates.length === 0) return null
  const order = orderLookup(state)
  for (const c of candidates) {
    if (!candidates.some((o) => o !== c && order(o, c) === 1)) return c
  }
  return candidates[0]!
}

/** Faces that touch the moving side and are joined to the seed faces across that side. */
function movingComponent(state: FoldState, line: Line2, side: number, seeds: number[]): Set<number> {
  const touching = new Set(state.faces.map((_, f) => f).filter((f) => faceTouches(state, line, f, side)))
  const byEdge = new Map<string, number[]>()
  state.faces.forEach((face, f) => {
    if (!touching.has(f)) return
    for (let i = 0; i < face.length; i += 1) {
      const u = face[i]!
      const w = face[(i + 1) % face.length]!
      if (vertexSide(state, line, u) !== side && vertexSide(state, line, w) !== side) continue
      const key = edgeKey(u, w)
      const list = byEdge.get(key)
      if (list) list.push(f)
      else byEdge.set(key, [f])
    }
  })
  const out = new Set<number>()
  const queue = seeds.filter((s) => touching.has(s))
  for (const s of queue) out.add(s)
  while (queue.length > 0) {
    const f = queue.pop()!
    const face = state.faces[f]!
    for (let i = 0; i < face.length; i += 1) {
      for (const g of byEdge.get(edgeKey(face[i]!, face[(i + 1) % face.length]!)) ?? []) {
        if (out.has(g)) continue
        out.add(g)
        queue.push(g)
      }
    }
  }
  return out
}

interface FoldPlan {
  line: Line2
  /** +1 when the left side of the line moves. */
  side: number
  /** Faces that move, after splitting. */
  moving: Set<number>
}

function planFold(
  state: FoldState,
  resolved: FoldLineResult,
  layers: SimpleFold['layers'],
  what: string,
): FoldPlan {
  const { line } = resolved
  let side: number
  if (resolved.movingAt) {
    side = Math.sign(sideOf(line, resolved.movingAt))
    if (side === 0) fail('axiom', `The point that moves is on the fold line.`, what)
  } else {
    const { left, right } = areaBySide(state, line)
    if (left <= AREA_TOLERANCE_MM2 || right <= AREA_TOLERANCE_MM2) fail('axiom', `The fold line ${what} does not cross the paper.`, what)
    side = left <= right ? 1 : -1
  }
  const all = state.faces.map((_, f) => f)
  if (!all.some((f) => faceTouches(state, line, f, side))) fail('axiom', `No paper is on the side of ${what} that moves.`, what)

  let component: Set<number>
  if (layers === 'all') {
    component = new Set(all.filter((f) => faceTouches(state, line, f, side)))
  } else if (layers === 'top') {
    const seed = resolved.seed
    let candidates: number[]
    if (seed) {
      // The layer that moves is the top one of the layers that carry the point that is brought,
      // not the top layer at that place (another layer may lie over the point).
      const carriers = new Set(facesAtFlatPoint(state, seed.flat))
      candidates = all.filter((f) => carriers.has(f) && faceTouches(state, line, f, side))
    } else {
      // No point given: the top layer anywhere on the moving side.
      candidates = all.filter((f) => faceTouches(state, line, f, side))
    }
    const top = topmost(state, candidates)
    if (top === null) fail('references', `No layer is under the point that moves.`, what)
    component = movingComponent(state, line, side, [top])
  } else {
    const flap = resolvePoint(state, layers.flap)
    const seeds = all.filter((f) => faceTouches(state, line, f, side) && pointInConvex(flatPolygon(state, f), flap.flat))
    if (seeds.length === 0) fail('references', `Flap ${flap.label} is not on the side that moves.`, flap.label)
    component = movingComponent(state, line, side, seeds)
  }

  const parent = splitFaces(state, line, component)
  const moving = new Set<number>()
  state.faces.forEach((_, f) => {
    if (!component.has(parent[f]!)) return
    if (faceTouches(state, line, f, side)) moving.add(f)
  })
  return { line, side, moving }
}

/** Throw when moving and still paper share a vertex off the fold line: the fold would tear it. */
function assertNoTear(state: FoldState, line: Line2, moving: Set<number>, what: string) {
  const movingVertices = new Set<number>()
  const stillVertices = new Set<number>()
  state.faces.forEach((face, f) => {
    for (const vi of face) (moving.has(f) ? movingVertices : stillVertices).add(vi)
  })
  for (const vi of movingVertices) {
    if (stillVertices.has(vi) && vertexSide(state, line, vi) !== 0) {
      fail('no-stretch', `The fold ${what} would tear the paper: the layers that move are joined to layers that stay.`, what)
    }
  }
}

/** Throw when a layer that stays is above (valley) or below (mountain) a layer that moves. */
function assertNotBlocked(state: FoldState, moving: Set<number>, up: boolean, what: string) {
  const order = orderLookup(state)
  for (const m of moving) {
    const pm = foldedPolygon(state, m)
    for (let f = 0; f < state.faces.length; f += 1) {
      if (moving.has(f)) continue
      const rel = order(f, m)
      if (rel === 0) continue
      if ((up && rel === 1) || (!up && rel === -1)) {
        if (overlapArea(pm, foldedPolygon(state, f)) <= AREA_TOLERANCE_MM2) continue
        fail('layers', `The fold ${what} would pass through a layer that stays ${up ? 'on top of' : 'under'} the paper that moves.`, what)
      }
    }
  }
}

function rotateFaces(state: FoldState, moving: Set<number>, line: Line2, angle: number) {
  const vs = new Set<number>()
  for (const f of moving) for (const vi of state.faces[f]!) vs.add(vi)
  const origin = v3(line.origin.x, line.origin.y, 0)
  const axis = v3(line.dir.x, line.dir.y, 0)
  for (const vi of vs) {
    if (vertexSide(state, line, vi) === 0) continue
    state.folded[vi] = cleanZ(rotateAbout(state.folded[vi]!, origin, axis, angle))
  }
}

/** A name for an unnamed fold. */
function autoName(state: FoldState): string {
  let i = state.folds.length + 1
  const used = new Set(state.edges.flatMap((e) => e.creases))
  while (used.has(`fold-${i}`)) i += 1
  return `fold-${i}`
}

function largestFace(state: FoldState, faces: number[]): number {
  let best = faces[0]!
  let bestArea = -1
  for (const f of faces) {
    const a = Math.abs(signedArea(flatPolygon(state, f)))
    if (a > bestArea) {
      bestArea = a
      best = f
    }
  }
  return best
}

function recordFold(state: FoldState, name: string, moving: Set<number>) {
  const still = state.faces.map((_, f) => f).filter((f) => !moving.has(f))
  const root = still.length > 0 ? largestFace(state, still) : 0
  state.folds.push({
    name,
    fixedPoint: centroid(flatPolygon(state, root)),
    moved: [...moving].map((f) => flatPolygon(state, f).map((p) => ({ ...p }))),
  })
}

function refreshSides(state: FoldState) {
  if (!isFlat(state)) return
  state.faceSides = state.faces.map((_, f) => (isFlipped(state, f) ? -1 : 1))
}

function solveAfterFold(state: FoldState, before: Array<[number, number]>, moving: Set<number>, up: boolean, what: string) {
  const fixed: Array<[number, number]> = []
  const order = new Map<string, boolean>()
  for (const [u, l] of before) order.set(`${u},${l}`, true)
  const n = state.faces.length
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      const am = moving.has(a)
      const bm = moving.has(b)
      const aAbove = order.has(`${a},${b}`)
      const bAbove = order.has(`${b},${a}`)
      if (am && bm) {
        if (aAbove) fixed.push([b, a])
        else if (bAbove) fixed.push([a, b])
      } else if (!am && !bm) {
        if (aAbove) fixed.push([a, b])
        else if (bAbove) fixed.push([b, a])
      } else {
        const m = am ? a : b
        const s = am ? b : a
        fixed.push(up ? [m, s] : [s, m])
      }
    }
  }
  const result = solveLayers(state, { fixed })
  if (!result.ok) fail('layers', `After the fold ${what}, the layers would cross: ${result.message}`, what)
  state.above = result.above
}

function simpleFold(state: FoldState, action: SimpleFold): FoldState {
  if (!isFlat(state)) fail('axiom', 'A valley or mountain fold needs the model to lie flat first.', action.name)
  const resolved = resolveFoldLine(state, action.line, action.moving)
  const name = action.name ?? autoName(state)
  const plan = planFold(state, resolved, action.layers, name)
  const up = action.kind === 'valley'
  assertNoTear(state, plan.line, plan.moving, name)
  assertNotBlocked(state, plan.moving, up, name)

  // Hinges: edges on the line between a face that moves and one that stays.
  const owners = new Map<string, number[]>()
  state.faces.forEach((face, f) => {
    for (let i = 0; i < face.length; i += 1) {
      const key = edgeKey(face[i]!, face[(i + 1) % face.length]!)
      const list = owners.get(key)
      if (list) list.push(f)
      else owners.set(key, [f])
    }
  })
  const degrees = action.degrees
  let hinges = 0
  state.edges.forEach((edge) => {
    const [a, b] = edge.vertices
    if (vertexSide(state, plan.line, a) !== 0 || vertexSide(state, plan.line, b) !== 0) return
    const fs = owners.get(edgeKey(a, b)) ?? []
    if (fs.length !== 2) return
    const [f, g] = fs as [number, number]
    if (plan.moving.has(f) === plan.moving.has(g)) return
    const still = plan.moving.has(f) ? g : f
    const valleyOnColour = up !== isFlipped(state, still)
    edge.assignment = valleyOnColour ? 'V' : 'M'
    edge.foldAngle = valleyOnColour ? degrees : -degrees
    if (!edge.creases.includes(name)) edge.creases.push(name)
    hinges += 1
  })
  if (hinges === 0) fail('axiom', `The fold ${name} moves no paper about a crease.`, name)

  const before = state.above.map((p) => [...p] as [number, number])
  // Left side moves toward the viewer with a positive angle about the line direction.
  const angle = degrees * DEG * plan.side * (up ? 1 : -1)
  rotateFaces(state, plan.moving, plan.line, angle)
  recordFold(state, name, plan.moving)
  if (degrees === 180) {
    solveAfterFold(state, before, plan.moving, up, name)
    refreshSides(state)
  }
  return state
}

// ---------------------------------------------------------------------------------------------
// Unfold

function inAny(polys: Vec2[][], p: Vec2): boolean {
  return polys.some((poly) => pointInConvex(poly, p, false, 1e-6))
}

function rebuildFromAngles(state: FoldState, root: number, what: string) {
  const result = geometryFromAngles(state, root)
  if (result.mismatch > 1e-3) {
    const vi = result.mismatchVertex
    const p = state.vertices[vi]!
    fail('no-stretch', `The creases cannot all fold this way at once: the paper at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) mm would need to be in two places.`, what)
  }
  state.folded = result.folded
}

function unfold(state: FoldState, last: number | undefined, creases: string[] | undefined): FoldState {
  let names: string[]
  if (last !== undefined) {
    if (last > state.folds.length) fail('references', `There are only ${state.folds.length} folds to unfold, not ${last}.`, `last ${last}`)
    names = state.folds.slice(state.folds.length - last).map((r) => r.name)
  } else {
    names = creases!
    for (const n of names) {
      if (creaseEdges(state, n).length === 0) fail('references', `Crease "${n}" does not exist.`, n)
      if (!state.folds.some((r) => r.name === n)) fail('references', `Crease "${n}" is not folded now, so it cannot be unfolded.`, n)
    }
  }
  // An edge can carry an older crease and a later fold. Open it only when no fold that stays carries it.
  const staying = new Set(state.folds.map((r) => r.name).filter((n) => !names.includes(n)))
  const records = state.folds.filter((r) => names.includes(r.name))
  const moved = records.flatMap((r) => r.moved)
  const all = state.faces.map((_, f) => f)
  const still = all.filter((f) => !inAny(moved, centroid(flatPolygon(state, f))))
  let root: number
  if (still.length > 0) root = largestFace(state, still)
  else {
    const first = records[0]
    const fs = first ? all.filter((f) => pointInConvex(flatPolygon(state, f), first.fixedPoint)) : []
    root = fs[0] ?? 0
  }
  for (const edge of state.edges) {
    if (!edge.creases.some((c) => names.includes(c))) continue
    if (edge.creases.some((c) => staying.has(c))) continue
    if (edge.assignment === 'B') continue
    edge.assignment = 'F'
    edge.foldAngle = 0
  }
  const before = state.above
  rebuildFromAngles(state, root, names.join(', '))
  state.folds = state.folds.filter((r) => !names.includes(r.name))
  if (isFlat(state)) {
    const result = solveLayers(state, { prefer: before })
    if (!result.ok) fail('layers', `After unfolding ${names.join(', ')}, the layers would cross: ${result.message}`, names.join(', '))
    state.above = result.above
    refreshSides(state)
  }
  return state
}

// ---------------------------------------------------------------------------------------------
// Turn over and rotate

function centre(state: FoldState): Vec2 {
  const box = boxOf(state.folded.map(flat2))
  return v2((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2)
}

function turnOver(state: FoldState, axis: 'vertical' | 'horizontal'): FoldState {
  const c = centre(state)
  state.folded = state.folded.map((p) =>
    axis === 'vertical' ? cleanZ(v3(2 * c.x - p.x, p.y, -p.z)) : cleanZ(v3(p.x, 2 * c.y - p.y, -p.z)),
  )
  state.above = state.above.map(([u, l]) => [l, u])
  state.faceSides = state.faceSides.map((s) => (s === 1 ? -1 : 1))
  return state
}

function rotate(state: FoldState, degrees: number): FoldState {
  const c = centre(state)
  const a = degrees * DEG
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  state.folded = state.folded.map((p) => {
    const x = p.x - c.x
    const y = p.y - c.y
    return v3(c.x + cos * x - sin * y, c.y + sin * x + cos * y, p.z)
  })
  return state
}

// ---------------------------------------------------------------------------------------------
// Compound folds: collapse, squash, petal

function setAssignment(state: FoldState, crease: string, assignment: Assignment, from?: Vec2, to?: Vec2) {
  const edges = creaseEdges(state, crease)
  if (edges.length === 0) fail('references', `Crease "${crease}" does not exist.`, crease)
  let changed = 0
  for (const ei of edges) {
    const edge = state.edges[ei]!
    if (from && to) {
      const [a, b] = edge.vertices
      if (!pointOnSegment(state.vertices[a]!, from, to, 1e-3) || !pointOnSegment(state.vertices[b]!, from, to, 1e-3)) continue
    }
    edge.assignment = assignment
    edge.foldAngle = assignment === 'V' ? 180 : assignment === 'M' ? -180 : 0
    changed += 1
  }
  if (changed === 0) fail('references', `No part of crease "${crease}" lies between the points given.`, crease)
}

function compound(state: FoldState, action: Compound): FoldState {
  const before = state.folded
  const beforeAbove = state.above
  for (const change of action.set) {
    if ((change.from === undefined) !== (change.to === undefined)) {
      fail('schema', `A crease change gives both "from" and "to", or neither.`, change.crease)
    }
    const from = change.from !== undefined ? resolvePoint(state, change.from).flat : undefined
    const to = change.to !== undefined ? resolvePoint(state, change.to).flat : undefined
    setAssignment(state, change.crease, change.assignment, from, to)
  }
  let root = 0
  let keepPlace = false
  if (action.keep !== undefined) {
    const k = resolvePoint(state, action.keep)
    const fs = state.faces.map((_, f) => f).filter((f) => pointInConvex(flatPolygon(state, f), k.flat))
    if (fs.length === 0) fail('references', `Point ${k.label} is not on the paper.`, k.label)
    root = fs[0]!
    keepPlace = true
  } else {
    root = largestFace(state, state.faces.map((_, f) => f))
  }
  const rootMap = affineFromFaceMap(faceMap(state, root).toFolded)
  const result = geometryFromAngles(state, root, rootMap)
  if (result.mismatch > 1e-3) {
    const p = state.vertices[result.mismatchVertex]!
    fail(
      'no-stretch',
      `The ${action.kind} fold cannot happen with these creases: the paper at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) mm would need to be in two places.`,
      action.kind,
    )
  }
  state.folded = keepPlace ? result.folded : alignInPlane(result.folded, before).map(cleanZ)
  if (isFlat(state)) {
    const solved = solveLayers(state, { prefer: beforeAbove })
    if (!solved.ok) fail('layers', `The ${action.kind} fold makes layers cross: ${solved.message}`, action.kind)
    state.above = solved.above
    refreshSides(state)
  }
  return state
}

// ---------------------------------------------------------------------------------------------
// Reverse folds and open: added with tickets 05 and 06.

/**
 * Reverse fold of a flap that is folded in half along a spine. The flap is cut along the line; the part
 * beyond it turns over the line. Inside: each half of the part goes into the middle of the flap, so it
 * ends between the two halves. Outside: each half wraps around the outside. Either way the spine of the
 * part that moves changes from mountain to valley or back, and the two halves keep their order.
 */
function reverseFold(state: FoldState, action: Reverse): FoldState {
  if (!isFlat(state)) fail('axiom', 'A reverse fold needs the model to lie flat first.', action.name)
  const resolved = resolveFoldLine(state, action.line, action.moving)
  const name = action.name ?? autoName(state)
  const plan = planFold(state, resolved, { flap: action.flap }, name)
  assertNoTear(state, plan.line, plan.moving, name)
  const inside = action.kind === 'inside-reverse'

  const owners = new Map<string, number[]>()
  state.faces.forEach((face, f) => {
    for (let i = 0; i < face.length; i += 1) {
      const key = edgeKey(face[i]!, face[(i + 1) % face.length]!)
      const list = owners.get(key)
      if (list) list.push(f)
      else owners.set(key, [f])
    }
  })
  // Hinges: edges on the line between a face that moves and one that stays.
  const hinges: Array<{ edge: number; still: number; moving: number }> = []
  state.edges.forEach((edge, ei) => {
    const [a, b] = edge.vertices
    if (vertexSide(state, plan.line, a) !== 0 || vertexSide(state, plan.line, b) !== 0) return
    const fs = owners.get(edgeKey(a, b)) ?? []
    if (fs.length !== 2) return
    const [f, g] = fs as [number, number]
    if (plan.moving.has(f) === plan.moving.has(g)) return
    hinges.push({ edge: ei, still: plan.moving.has(f) ? g : f, moving: plan.moving.has(f) ? f : g })
  })
  if (hinges.length === 0) fail('axiom', `The reverse fold ${name} moves no paper about a crease.`, name)

  // The stack where most hinges overlap on the line; its top half and bottom half are the flap's halves.
  const along = (vi: number) => {
    const p = flat2(state.folded[vi]!)
    return (p.x - plan.line.origin.x) * plan.line.dir.x + (p.y - plan.line.origin.y) * plan.line.dir.y
  }
  const spans = hinges.map((h) => {
    const [a, b] = state.edges[h.edge]!.vertices
    const ta = along(a)
    const tb = along(b)
    return [Math.min(ta, tb), Math.max(ta, tb)] as [number, number]
  })
  let bestT = 0
  let bestCount = -1
  for (const [lo, hi] of spans) {
    const t = (lo + hi) / 2
    const count = spans.filter(([l, h]) => l < t - 1e-6 && h > t + 1e-6).length
    if (count > bestCount) {
      bestCount = count
      bestT = t
    }
  }
  const order = orderLookup(state)
  const stack = [...new Set(hinges.filter((_, i) => spans[i]![0] < bestT - 1e-6 && spans[i]![1] > bestT + 1e-6).map((h) => h.moving))]
  stack.sort((x, y) => (order(x, y) === 1 ? -1 : order(y, x) === 1 ? 1 : 0))
  if (stack.length < 2 || stack.length % 2 === 1) {
    fail('axiom', `The flap at ${name} has ${stack.length} layers at the fold. A reverse fold needs a flap folded in half.`, name)
  }
  const half = new Map<number, 0 | 1>() // 0: front half, 1: back half
  stack.forEach((f, i) => half.set(f, i < stack.length / 2 ? 0 : 1))
  // The spine: a folded edge that joins a layer of the front half to a layer of the back half (after an
  // earlier reverse fold it can be on the outside of the stack). Every folded edge on its flat line is spine.
  let shared: number[] = []
  for (const f of stack.slice(0, stack.length / 2)) {
    for (const g of stack.slice(stack.length / 2)) {
      const common = state.faces[f]!.filter((vi) => state.faces[g]!.includes(vi))
      if (common.length === 2 && shared.length === 0) shared = common
    }
  }
  if (shared.length !== 2) fail('axiom', `The two halves of the flap at ${name} are not joined by a fold, so there is no spine to reverse.`, name)
  const spineLine = lineThrough(state.vertices[shared[0]!]!, state.vertices[shared[1]!]!)
  const isSpine = (u: number, w: number) =>
    Math.abs(sideOf(spineLine, state.vertices[u]!)) < 1e-6 && Math.abs(sideOf(spineLine, state.vertices[w]!)) < 1e-6
  // Spread the halves over every face that moves: crossing the spine changes half, crossing any other edge does not.
  const queue = [...half.keys()]
  while (queue.length > 0) {
    const f = queue.shift()!
    const face = state.faces[f]!
    for (let i = 0; i < face.length; i += 1) {
      const u = face[i]!
      const w = face[(i + 1) % face.length]!
      for (const g of owners.get(edgeKey(u, w)) ?? []) {
        if (g === f || !plan.moving.has(g)) continue
        const want = (isSpine(u, w) ? 1 - half.get(f)! : half.get(f)!) as 0 | 1
        const has = half.get(g)
        if (has === undefined) {
          half.set(g, want)
          queue.push(g)
        } else if (has !== want) {
          fail('axiom', `The flap at ${name} is not one flap folded in half along a spine.`, name)
        }
      }
    }
  }
  for (const f of plan.moving) if (!half.has(f)) fail('axiom', `Part of the flap at ${name} is not joined to the rest.`, name)

  // Faces that stay but belong to the flap take the half of the face across their hinge.
  const stillHalf = new Map<number, 0 | 1>()
  for (const h of hinges) stillHalf.set(h.still, half.get(h.moving)!)

  // New crease: each half turns toward the middle (inside) or away from it (outside).
  for (const h of hinges) {
    const edge = state.edges[h.edge]!
    const front = half.get(h.moving) === 0
    const up = inside ? !front : front
    const valleyOnColour = up !== isFlipped(state, h.still)
    edge.assignment = valleyOnColour ? 'V' : 'M'
    edge.foldAngle = valleyOnColour ? 180 : -180
    if (!edge.creases.includes(name)) edge.creases.push(name)
  }
  // The spine of the part that moves turns the other way.
  state.edges.forEach((edge) => {
    const [a, b] = edge.vertices
    const fs = owners.get(edgeKey(a, b)) ?? []
    if (fs.length !== 2 || !fs.every((f) => plan.moving.has(f))) return
    if (half.get(fs[0]!) === half.get(fs[1]!)) return
    if (edge.assignment === 'V' || edge.assignment === 'M') {
      edge.assignment = edge.assignment === 'V' ? 'M' : 'V'
      edge.foldAngle = -edge.foldAngle
    }
  })

  const before = state.above.map((p) => [...p] as [number, number])
  // Where in the old order the flap opens: between the lowest layer of its front half and the highest
  // layer of its back half. Other layers that stay are tried on the same side of the opening as before.
  const levelsBefore = faceLevels(state)
  const opening = (levelsBefore[stack[stack.length / 2 - 1]!]! + levelsBefore[stack[stack.length / 2]!]!) / 2
  rotateFaces(state, plan.moving, plan.line, Math.PI)
  recordFold(state, name, plan.moving)

  // Layer order: each half turns over on its own; the halves keep their order; the part that moves
  // goes between the halves (inside) or around them (outside).
  const was = new Set(before.map(([u, l]) => `${u},${l}`))
  const fixed: Array<[number, number]> = []
  const prefer: Array<[number, number]> = []
  const n = state.faces.length
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      const am = plan.moving.has(a)
      const bm = plan.moving.has(b)
      const aAbove = was.has(`${a},${b}`)
      const bAbove = was.has(`${b},${a}`)
      if (am !== bm) {
        const m = am ? a : b
        const s = am ? b : a
        if (!stillHalf.has(s)) {
          if (inside) prefer.push((levelsBefore[s] ?? 0) > opening ? [s, m] : [m, s])
          else prefer.push(half.get(m) === 0 ? [m, s] : [s, m])
        }
      }
      if (am && bm) {
        const sameHalf = half.get(a) === half.get(b)
        if (aAbove) fixed.push(sameHalf ? [b, a] : [a, b])
        else if (bAbove) fixed.push(sameHalf ? [a, b] : [b, a])
      } else if (!am && !bm) {
        if (aAbove) fixed.push([a, b])
        else if (bAbove) fixed.push([b, a])
      } else {
        const m = am ? a : b
        const s = am ? b : a
        const sh = stillHalf.get(s)
        if (sh === undefined) continue
        const sFront = sh === 0
        if (inside) fixed.push(sFront ? [s, m] : [m, s])
        else fixed.push(half.get(m) === 0 ? [m, s] : [s, m])
      }
    }
  }
  const result = solveLayers(state, { fixed, prefer })
  if (!result.ok) fail('layers', `After the ${action.kind} fold ${name}, the layers would cross: ${result.message}`, name)
  state.above = result.above
  refreshSides(state)
  return state
}

function openFlaps(_state: FoldState, action: Open): FoldState {
  fail('axiom', 'Opening flaps is not supported yet.', action.creases.join(', '))
}
