import { TOLERANCE_MM, dist2, dist3 } from './geometry'
import type { FoldIssue } from './errors'
import { verifyLayers } from './layers'
import { type FoldState, isFlat } from './state'

const ANGLE_TOLERANCE_DEG = 1e-4
const LENGTH_TOLERANCE_MM = 1e-5

/** A readable name for a vertex: its point name when it has one, else its position on the flat sheet. */
export function vertexLabel(state: FoldState, vi: number): string {
  const p = state.vertices[vi]!
  for (const [name, q] of Object.entries(state.points)) {
    if (dist2(p, q) <= TOLERANCE_MM * 10) return name
  }
  return `vertex (${p.x.toFixed(2)}, ${p.y.toFixed(2)}) mm`
}

function onSheetBoundary(state: FoldState, vi: number): boolean {
  const p = state.vertices[vi]!
  const t = TOLERANCE_MM * 10
  return (
    Math.abs(p.x) <= t ||
    Math.abs(p.y) <= t ||
    Math.abs(p.x - state.paper.widthMm) <= t ||
    Math.abs(p.y - state.paper.heightMm) <= t
  )
}

const isFoldedFlat = (angle: number) => Math.abs(Math.abs(angle) - 180) < 1e-6

/** No stretch or tear: every edge, and every distance inside a face, keeps its flat length. */
export function checkNoStretch(state: FoldState): FoldIssue[] {
  const issues: FoldIssue[] = []
  for (const edge of state.edges) {
    const [a, b] = edge.vertices
    const flat = dist2(state.vertices[a]!, state.vertices[b]!)
    const now = dist3(state.folded[a]!, state.folded[b]!)
    if (Math.abs(flat - now) > LENGTH_TOLERANCE_MM) {
      const at = `${vertexLabel(state, a)} to ${vertexLabel(state, b)}`
      issues.push({
        check: 'no-stretch',
        message: `The paper from ${at} is ${flat.toFixed(3)} mm long on the sheet but ${now.toFixed(3)} mm in the folded state.`,
        at,
      })
      return issues
    }
  }
  for (let f = 0; f < state.faces.length; f += 1) {
    const face = state.faces[f]!
    for (let i = 0; i < face.length; i += 1) {
      for (let j = i + 2; j < face.length; j += 1) {
        const a = face[i]!
        const b = face[j]!
        const flat = dist2(state.vertices[a]!, state.vertices[b]!)
        const now = dist3(state.folded[a]!, state.folded[b]!)
        if (Math.abs(flat - now) > LENGTH_TOLERANCE_MM) {
          const at = `${vertexLabel(state, a)} to ${vertexLabel(state, b)}`
          issues.push({
            check: 'no-stretch',
            message: `A face is stretched: ${at} is ${flat.toFixed(3)} mm on the sheet but ${now.toFixed(3)} mm folded.`,
            at,
          })
          return issues
        }
      }
    }
  }
  return issues
}

/** Folded creases at each inner vertex, as directions on the flat sheet. */
function foldedCreasesByVertex(state: FoldState) {
  const map = new Map<number, Array<{ angle: number; assignment: 'V' | 'M' }>>()
  for (const edge of state.edges) {
    if (edge.assignment !== 'V' && edge.assignment !== 'M') continue
    if (!isFoldedFlat(edge.foldAngle)) continue
    const [a, b] = edge.vertices
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const p = state.vertices[from]!
      const q = state.vertices[to]!
      const angle = Math.atan2(q.y - p.y, q.x - p.x)
      const list = map.get(from)
      const entry = { angle, assignment: edge.assignment }
      if (list) list.push(entry)
      else map.set(from, [entry])
    }
  }
  return map
}

/** Maekawa: at an inner vertex, mountains minus valleys is +2 or -2. */
export function checkMaekawa(state: FoldState): FoldIssue[] {
  if (!isFlat(state)) return []
  const issues: FoldIssue[] = []
  for (const [vi, creases] of foldedCreasesByVertex(state)) {
    if (onSheetBoundary(state, vi)) continue
    const m = creases.filter((c) => c.assignment === 'M').length
    const v = creases.length - m
    if (Math.abs(m - v) !== 2) {
      const at = vertexLabel(state, vi)
      issues.push({
        check: 'maekawa',
        message: `At ${at}, ${m} mountain and ${v} valley creases meet. Maekawa needs the difference to be 2.`,
        at,
      })
    }
  }
  return issues
}

/** Kawasaki: at an inner vertex, alternate angles between folded creases sum to 180°. */
export function checkKawasaki(state: FoldState): FoldIssue[] {
  if (!isFlat(state)) return []
  const issues: FoldIssue[] = []
  for (const [vi, creases] of foldedCreasesByVertex(state)) {
    if (onSheetBoundary(state, vi)) continue
    const angles = creases.map((c) => c.angle).sort((x, y) => x - y)
    if (angles.length % 2 === 1) {
      const at = vertexLabel(state, vi)
      issues.push({ check: 'kawasaki', message: `At ${at}, an odd number of folded creases (${angles.length}) meet, so the paper cannot lie flat.`, at })
      continue
    }
    let alternate = 0
    for (let i = 0; i < angles.length; i += 1) {
      const next = i === angles.length - 1 ? angles[0]! + 2 * Math.PI : angles[i + 1]!
      if (i % 2 === 0) alternate += next - angles[i]!
    }
    const degrees = (alternate * 180) / Math.PI
    if (Math.abs(degrees - 180) > ANGLE_TOLERANCE_DEG) {
      const at = vertexLabel(state, vi)
      issues.push({
        check: 'kawasaki',
        message: `At ${at}, alternate angles sum to ${degrees.toFixed(2)}°. Kawasaki needs 180°.`,
        at,
      })
    }
  }
  return issues
}

/** Layers do not cross: the layer order satisfies every constraint. */
export function checkLayers(state: FoldState): FoldIssue[] {
  if (!isFlat(state)) return []
  const problem = verifyLayers(state)
  if (!problem) return []
  return [{ check: 'layers', message: `Layers cross: ${problem.message}`, at: problem.faces.map((f) => `face ${f}`).join(', ') }]
}

/** Every geometry check on a folded state. An empty list means the state is physically possible. */
export function checkState(state: FoldState): FoldIssue[] {
  return [...checkNoStretch(state), ...checkMaekawa(state), ...checkKawasaki(state), ...checkLayers(state)]
}
