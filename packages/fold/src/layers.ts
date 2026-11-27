import {
  AREA_TOLERANCE_MM2,
  type Box2,
  type Line2,
  type Vec2,
  TOLERANCE_MM,
  boxOf,
  boxesOverlap,
  centroid,
  clipConvex,
  dist2,
  dot2,
  lerp2,
  lineThrough,
  overlapArea,
  pointInConvex,
  sideOf,
  signedArea,
  sub2,
} from './geometry'
import { type FoldState, edgeFaces, edgeKey, foldedPolygon, isFlipped } from './state'

/**
 * The layer order of a flat state, as a constraint problem.
 *
 * One boolean variable per pair of faces that overlap: is the lower-numbered face above the other?
 * Constraints:
 * - adjacency: two faces joined by a folded crease have a fixed order (valley or mountain);
 * - taco-taco: two folded creases on the same line, opening the same way, do not interleave;
 * - taco-tortilla: a face that spans a folded crease is not between its two faces;
 * - tortilla-tortilla: two flat creases on the same line keep the same order on both sides;
 * - transitivity: three faces over one spot have no cycle.
 * Solved by unit propagation and depth-first search.
 */

interface Constraint {
  vars: number[]
  /** For each local pair, true when the local "first above second" is the variable's value 0. */
  flips: boolean[]
  /** Allowed bit patterns over the local pairs (bit i = local pair i's first face is above). */
  allowed: number[]
  kind: string
  faces: number[]
}

export interface LayerProblem {
  faceCount: number
  pairs: Array<[number, number]>
  pairIndex: Map<string, number>
  constraints: Constraint[]
  /** Variables fixed by folded creases (adjacent faces). */
  adjacency: Map<number, number>
}

const pairKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const perm of permutations(rest)) out.push([item, ...perm])
  })
  return out
}

/** Patterns over local pairs (0,1),(0,2),(1,2),(0,3),(1,3),(2,3) allowed by orders of k faces. */
const LOCAL_PAIRS: Record<number, Array<[number, number]>> = {
  3: [
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  4: [
    [0, 1],
    [0, 2],
    [1, 2],
    [0, 3],
    [1, 3],
    [2, 3],
  ],
}

function patternsFrom(k: number, keep: (position: number[]) => boolean): number[] {
  const pairs = LOCAL_PAIRS[k]!
  const set = new Set<number>()
  for (const perm of permutations([...Array(k).keys()])) {
    // perm lists faces from top to bottom; position[f] = depth.
    const position = new Array<number>(k)
    perm.forEach((f, depth) => {
      position[f] = depth
    })
    if (!keep(position)) continue
    let mask = 0
    pairs.forEach(([a, b], i) => {
      if (position[a]! < position[b]!) mask |= 1 << i
    })
    set.add(mask)
  }
  return [...set]
}

const between = (p: number[], x: number, a: number, b: number) =>
  (p[x]! > p[a]! && p[x]! < p[b]!) || (p[x]! < p[a]! && p[x]! > p[b]!)

const TRANSITIVE = patternsFrom(3, () => true)
// faces: a, b (the taco), t (the tortilla)
const TACO_TORTILLA = patternsFrom(3, (p) => !between(p, 2, 0, 1))
// faces: a, b (first taco), c, d (second taco)
const TACO_TACO = patternsFrom(4, (p) => between(p, 2, 0, 1) === between(p, 3, 0, 1))

interface FoldedEdge {
  a: number
  b: number
  p: Vec2
  q: Vec2
  line: Line2
  taco: boolean
  /** Side of the line each face lies on (+1 left, -1 right). */
  sideA: number
  sideB: number
}

function faceSide(poly: Vec2[], line: Line2): number {
  return sideOf(line, centroid(poly)) >= 0 ? 1 : -1
}

/** Overlap of two collinear segments, as a sub-segment, or null. */
function collinearOverlap(e: FoldedEdge, f: FoldedEdge): [Vec2, Vec2] | null {
  if (Math.abs(sideOf(e.line, f.p)) > TOLERANCE_MM * 100 || Math.abs(sideOf(e.line, f.q)) > TOLERANCE_MM * 100) return null
  const t = (v: Vec2) => dot2(sub2(v, e.line.origin), e.line.dir)
  const [e0, e1] = [t(e.p), t(e.q)].sort((x, y) => x - y)
  const [f0, f1] = [t(f.p), t(f.q)].sort((x, y) => x - y)
  const lo = Math.max(e0!, f0!)
  const hi = Math.min(e1!, f1!)
  if (hi - lo <= TOLERANCE_MM * 100) return null
  const at = (s: number) => ({ x: e.line.origin.x + e.line.dir.x * s, y: e.line.origin.y + e.line.dir.y * s })
  return [at(lo), at(hi)]
}

export function buildLayerProblem(state: FoldState): LayerProblem {
  const n = state.faces.length
  const polys = state.faces.map((_, f) => foldedPolygon(state, f))
  const boxes: Box2[] = polys.map((p) => boxOf(p))
  const flipped = state.faces.map((_, f) => isFlipped(state, f))

  const pairs: Array<[number, number]> = []
  const pairIndex = new Map<string, number>()
  const neighbours: Array<Set<number>> = Array.from({ length: n }, () => new Set<number>())
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (!boxesOverlap(boxes[i]!, boxes[j]!)) continue
      if (overlapArea(polys[i]!, polys[j]!) <= AREA_TOLERANCE_MM2) continue
      pairIndex.set(pairKey(i, j), pairs.length)
      pairs.push([i, j])
      neighbours[i]!.add(j)
      neighbours[j]!.add(i)
    }
  }
  const varOf = (a: number, b: number) => pairIndex.get(pairKey(a, b))

  const constraints: Constraint[] = []
  const add = (kind: string, faces: number[], allowed: number[]) => {
    const local = LOCAL_PAIRS[faces.length]!
    const vars: number[] = []
    const flips: boolean[] = []
    for (const [x, y] of local) {
      const v = varOf(faces[x]!, faces[y]!)
      if (v === undefined) return
      vars.push(v)
      flips.push(faces[x]! > faces[y]!)
    }
    constraints.push({ vars, flips, allowed, kind, faces })
  }

  // Folded and flat edges between two faces.
  const edges: FoldedEdge[] = []
  const adjacency = new Map<number, number>()
  const owners = edgeFaces(state)
  for (const edge of state.edges) {
    const fs = owners.get(edgeKey(edge.vertices[0], edge.vertices[1]))
    if (!fs || fs.length !== 2) continue
    const [a, b] = fs as [number, number]
    const p3 = state.folded[edge.vertices[0]]!
    const q3 = state.folded[edge.vertices[1]]!
    const p = { x: p3.x, y: p3.y }
    const q = { x: q3.x, y: q3.y }
    if (dist2(p, q) < TOLERANCE_MM) continue
    const line = lineThrough(p, q)
    const folded = (edge.assignment === 'V' || edge.assignment === 'M') && Math.abs(Math.abs(edge.foldAngle) - 180) < 1e-6
    const sideA = faceSide(polys[a]!, line)
    const sideB = faceSide(polys[b]!, line)
    edges.push({ a, b, p, q, line, taco: folded, sideA, sideB })
    if (folded) {
      const v = varOf(a, b)
      if (v === undefined) continue
      // Valley seen from the coloured side: the other face comes toward the coloured side.
      const bAboveA = (edge.assignment === 'V') !== flipped[a]!
      const aAboveB = !bAboveA
      // variable value 1 = lower index above.
      const value = a < b ? (aAboveB ? 1 : 0) : bAboveA ? 1 : 0
      adjacency.set(v, value)
    }
  }

  // Pairs of edges on the same line.
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]!
    for (let j = i + 1; j < edges.length; j += 1) {
      const f = edges[j]!
      if (new Set([e.a, e.b, f.a, f.b]).size < 4) continue
      if (!collinearOverlap(e, f)) continue
      // Sides must be measured against one line: use e's line for both.
      const fSideA = faceSide(polys[f.a]!, e.line)
      const fSideB = faceSide(polys[f.b]!, e.line)
      const eSideA = e.sideA
      const eSideB = e.sideB
      if (e.taco && f.taco) {
        if (eSideA === fSideA) add('taco-taco', [e.a, e.b, f.a, f.b], TACO_TACO)
      } else if (e.taco && !f.taco) {
        const t = fSideA === eSideA ? f.a : f.b
        add('taco-tortilla', [e.a, e.b, t], TACO_TORTILLA)
      } else if (!e.taco && f.taco) {
        const t = eSideA === fSideA ? e.a : e.b
        add('taco-tortilla', [f.a, f.b, t], TACO_TORTILLA)
      } else {
        // tortilla-tortilla: (e.a vs same-side f face) equals (e.b vs other f face)
        const fa = fSideA === eSideA ? f.a : f.b
        const fb = fa === f.a ? f.b : f.a
        if (eSideB === eSideA) continue
        const v1 = varOf(e.a, fa)
        const v2 = varOf(e.b, fb)
        if (v1 === undefined || v2 === undefined) continue
        constraints.push({
          vars: [v1, v2],
          flips: [e.a > fa, e.b > fb],
          allowed: [0b00, 0b11],
          kind: 'tortilla-tortilla',
          faces: [e.a, fa, e.b, fb],
        })
      }
    }
  }

  // A face that spans a folded crease in its interior.
  for (const e of edges) {
    if (!e.taco) continue
    for (let t = 0; t < n; t += 1) {
      if (t === e.a || t === e.b) continue
      if (!neighbours[e.a]!.has(t) && !neighbours[e.b]!.has(t)) continue
      const poly = polys[t]!
      if (!boxesOverlap(boxOf([e.p, e.q]), boxes[t]!, -TOLERANCE_MM)) continue
      // Sample the segment inside the face; require a point strictly inside.
      let inside = false
      for (const s of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        if (pointInConvex(poly, lerp2(e.p, e.q, s), true)) {
          inside = true
          break
        }
      }
      if (!inside) continue
      add('taco-tortilla', [e.a, e.b, t], TACO_TORTILLA)
    }
  }

  // Transitivity over three faces with a common spot.
  for (const [i, j] of pairs) {
    const ij = clipConvex(polys[i]!, polys[j]!)
    if (ij.length < 3) continue
    for (const k of neighbours[i]!) {
      if (k <= j || !neighbours[j]!.has(k)) continue
      const ijk = clipConvex(ij, polys[k]!)
      if (ijk.length < 3 || Math.abs(signedArea(ijk)) <= AREA_TOLERANCE_MM2) continue
      add('transitivity', [i, j, k], TRANSITIVE)
    }
  }

  return { faceCount: n, pairs, pairIndex, constraints, adjacency }
}

export interface LayerSolveOptions {
  /** Pairs that must keep an order: [upper, lower]. */
  fixed?: Array<[number, number]>
  /** Pairs to try first in the search: [upper, lower]. */
  prefer?: Array<[number, number]>
}

export type LayerSolveResult =
  | { ok: true; above: Array<[number, number]> }
  | { ok: false; message: string; faces: number[] }

export function solveLayers(state: FoldState, options: LayerSolveOptions = {}, problem = buildLayerProblem(state)): LayerSolveResult {
  const { pairs, constraints } = problem
  const nv = pairs.length
  const value = new Int8Array(nv).fill(-1)
  const byVar: number[][] = Array.from({ length: nv }, () => [])
  constraints.forEach((c, ci) => c.vars.forEach((v) => byVar[v]!.push(ci)))

  const trail: number[] = []
  let conflict: Constraint | null = null

  const assign = (v: number, val: number, queue: number[]): boolean => {
    if (value[v] === val) return true
    if (value[v] !== -1) return false
    value[v] = val
    trail.push(v)
    queue.push(v)
    return true
  }

  const propagate = (queue: number[]): boolean => {
    while (queue.length > 0) {
      const v = queue.pop()!
      for (const ci of byVar[v]!) {
        const c = constraints[ci]!
        let knownMask = 0
        let knownBits = 0
        for (let i = 0; i < c.vars.length; i += 1) {
          const val = value[c.vars[i]!]!
          if (val === -1) continue
          knownMask |= 1 << i
          const local = c.flips[i] ? 1 - val : val
          if (local) knownBits |= 1 << i
        }
        let common1 = -1
        let common0 = -1
        let count = 0
        for (const pattern of c.allowed) {
          if ((pattern & knownMask) !== knownBits) continue
          count += 1
          common1 &= pattern
          common0 &= ~pattern
        }
        if (count === 0) {
          conflict = c
          return false
        }
        for (let i = 0; i < c.vars.length; i += 1) {
          if (knownMask & (1 << i)) continue
          let local = -1
          if (common1 & (1 << i)) local = 1
          else if (common0 & (1 << i)) local = 0
          if (local === -1) continue
          const val = c.flips[i] ? 1 - local : local
          if (!assign(c.vars[i]!, val, queue)) {
            conflict = c
            return false
          }
        }
      }
    }
    return true
  }

  const undoTo = (mark: number) => {
    while (trail.length > mark) value[trail.pop()!] = -1
  }

  const toValue = (upper: number, lower: number): [number, number] | null => {
    const v = problem.pairIndex.get(pairKey(upper, lower))
    if (v === undefined) return null
    return [v, upper < lower ? 1 : 0]
  }

  const initial: number[] = []
  for (const [v, val] of problem.adjacency) {
    if (!assign(v, val, initial)) {
      return { ok: false, message: 'Two folded creases ask for opposite layer orders.', faces: [...pairs[v]!] }
    }
  }
  for (const [upper, lower] of options.fixed ?? []) {
    const vv = toValue(upper, lower)
    if (!vv) continue
    if (!assign(vv[0], vv[1], initial)) {
      return { ok: false, message: `Face ${upper} cannot stay above face ${lower}.`, faces: [upper, lower] }
    }
  }
  if (!propagate(initial)) {
    const c = conflict as Constraint | null
    return { ok: false, message: `No layer order exists (${c?.kind ?? 'constraint'} conflict).`, faces: c?.faces ?? [] }
  }

  const preferred = new Map<number, number>()
  for (const [upper, lower] of options.prefer ?? []) {
    const vv = toValue(upper, lower)
    if (vv) preferred.set(vv[0], vv[1])
  }

  let steps = 0
  const MAX_STEPS = 200000
  const search = (): boolean => {
    let v = -1
    for (let i = 0; i < nv; i += 1) {
      if (value[i] === -1) {
        v = i
        break
      }
    }
    if (v === -1) return true
    steps += 1
    if (steps > MAX_STEPS) return false
    const first = preferred.get(v) ?? 1
    for (const val of [first, 1 - first]) {
      const mark = trail.length
      const queue: number[] = []
      assign(v, val, queue)
      if (propagate(queue) && search()) return true
      undoTo(mark)
    }
    return false
  }

  if (!search()) {
    const c = conflict as Constraint | null
    return { ok: false, message: `No layer order exists (${c?.kind ?? 'constraint'} conflict).`, faces: c?.faces ?? [] }
  }

  const above: Array<[number, number]> = pairs.map(([a, b], v) => (value[v] === 1 ? [a, b] : [b, a]))
  return { ok: true, above }
}

/** Check a given layer order against every constraint. Returns a problem description or null. */
export function verifyLayers(state: FoldState): { message: string; faces: number[] } | null {
  const problem = buildLayerProblem(state)
  const known = new Map<string, [number, number]>()
  for (const pair of state.above) known.set(pairKey(pair[0], pair[1]), pair)
  for (const [a, b] of problem.pairs) {
    if (!known.has(pairKey(a, b))) return { message: `Faces ${a} and ${b} overlap but have no layer order.`, faces: [a, b] }
  }
  const result = solveLayers(state, { fixed: state.above }, problem)
  if (result.ok) return null
  return { message: result.message, faces: result.faces }
}
