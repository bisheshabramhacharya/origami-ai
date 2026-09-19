import type { Diagram, DiagramPrimitive, PaperShape, Point } from './types'

export function p(x: number, y: number): Point {
  return { x, y }
}

export const VIEW_BOX = '0 0 100 100'
const ARROW_MARKER = 'dg-arrowhead'

const COLOR = {
  valley: '#2563eb',
  mountain: '#dc2626',
  cut: '#dc2626',
  crease: '#9ca3af',
  line: '#374151',
  arrow: '#111827',
  shade: '#e5e7eb',
  sheet: '#ffffff',
  sheetStroke: '#111827',
  label: '#111827',
} as const

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function n(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function pt(point: Point): string {
  return `${n(point.x)},${n(point.y)}`
}

function sheetPath(shape: PaperShape): string {
  switch (shape) {
    case 'square':
      return 'M20,20 H80 V80 H20 Z'
    case 'rectangle':
      return 'M14,28 H86 V72 H14 Z'
    case 'a4':
      return 'M26,12 H74 V88 H26 Z'
    case 'letter':
      return 'M24,14 H76 V86 H24 Z'
    case 'circle':
      return 'M50,12 A38,38 0 1 1 49.9,12 Z'
  }
}

function needsArrowhead(primitives: DiagramPrimitive[]): boolean {
  return primitives.some((primitive) => primitive.kind === 'arrow' || primitive.kind === 'curve-arrow')
}

function defs(): string {
  return [
    '<defs>',
    `<marker id="${ARROW_MARKER}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">`,
    `<path d="M 0 0 L 10 5 L 0 10 z" fill="${COLOR.arrow}" />`,
    '</marker>',
    '</defs>',
  ].join('')
}

function renderPrimitive(primitive: DiagramPrimitive): string {
  switch (primitive.kind) {
    case 'sheet':
      return `<path class="dg-sheet" d="${sheetPath(primitive.shape)}" fill="${COLOR.sheet}" stroke="${COLOR.sheetStroke}" stroke-width="1.2" />`

    case 'polygon':
      return `<polygon class="dg-polygon" points="${primitive.points.map(pt).join(' ')}" fill="none" stroke="${COLOR.line}" stroke-width="1.1" />`

    case 'shade':
      return `<polygon class="dg-shade" points="${primitive.points.map(pt).join(' ')}" fill="${COLOR.shade}" stroke="none" />`

    case 'line':
      return `<line class="dg-line" x1="${n(primitive.from.x)}" y1="${n(primitive.from.y)}" x2="${n(primitive.to.x)}" y2="${n(primitive.to.y)}" stroke="${COLOR.line}" stroke-width="1"${primitive.dashed ? ' stroke-dasharray="3 3"' : ''} />`

    case 'crease':
      return `<line class="dg-crease" x1="${n(primitive.from.x)}" y1="${n(primitive.from.y)}" x2="${n(primitive.to.x)}" y2="${n(primitive.to.y)}" stroke="${COLOR.crease}" stroke-width="0.8" stroke-dasharray="1 2" />`

    case 'cut':
      return `<line class="dg-cut" x1="${n(primitive.from.x)}" y1="${n(primitive.from.y)}" x2="${n(primitive.to.x)}" y2="${n(primitive.to.y)}" stroke="${COLOR.cut}" stroke-width="1.4" stroke-dasharray="6 2 1 2" />`

    case 'fold': {
      const color = primitive.fold === 'mountain' ? COLOR.mountain : primitive.fold === 'valley' ? COLOR.valley : COLOR.crease
      const dash =
        primitive.fold === 'mountain'
          ? 'stroke-dasharray="6 2 1 2"'
          : primitive.fold === 'valley'
            ? 'stroke-dasharray="4 2"'
            : 'stroke-dasharray="1 2"'
      return `<line class="dg-fold dg-fold-${primitive.fold}" x1="${n(primitive.from.x)}" y1="${n(primitive.from.y)}" x2="${n(primitive.to.x)}" y2="${n(primitive.to.y)}" stroke="${color}" stroke-width="1.3" ${dash} />`
    }

    case 'arrow':
      return `<line class="dg-arrow dg-arrow-${primitive.style ?? 'fold'}" x1="${n(primitive.from.x)}" y1="${n(primitive.from.y)}" x2="${n(primitive.to.x)}" y2="${n(primitive.to.y)}" stroke="${COLOR.arrow}" stroke-width="1.1" marker-end="url(#${ARROW_MARKER})" />`

    case 'curve-arrow': {
      const { at, degrees, radius } = primitive
      const sweep = degrees >= 0 ? 1 : 0
      const start = p(at.x - radius, at.y)
      const end = p(at.x + radius, at.y)
      return `<path class="dg-curve-arrow" d="M ${n(start.x)} ${n(start.y)} A ${n(radius)} ${n(radius)} 0 0 ${sweep} ${n(end.x)} ${n(end.y)}" fill="none" stroke="${COLOR.arrow}" stroke-width="1.1" marker-end="url(#${ARROW_MARKER})" />`
    }

    case 'dot':
      return [
        `<circle class="dg-dot" cx="${n(primitive.at.x)}" cy="${n(primitive.at.y)}" r="1.6" fill="${COLOR.label}" />`,
        primitive.label
          ? `<text class="dg-dot-label" x="${n(primitive.at.x + 3)}" y="${n(primitive.at.y + 1)}" font-size="5" fill="${COLOR.label}">${esc(primitive.label)}</text>`
          : '',
      ].join('')

    case 'label':
      return `<text class="dg-label" x="${n(primitive.at.x)}" y="${n(primitive.at.y)}" font-size="6" fill="${COLOR.label}">${esc(primitive.text)}</text>`
  }
}

export function renderDiagram(diagram: Diagram): string {
  const body = diagram.primitives.map(renderPrimitive).filter(Boolean).join('')
  const head = needsArrowhead(diagram.primitives) ? defs() : ''
  const title = diagram.caption ? `<title>${esc(diagram.caption)}</title>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" role="img" aria-label="${esc(diagram.caption ?? 'Step diagram')}">${title}${head}${body}</svg>`
}

export function diagram(caption: string, ...primitives: DiagramPrimitive[]): Diagram {
  return { primitives, caption }
}

export const sheet = (shape: PaperShape = 'square'): DiagramPrimitive => ({ kind: 'sheet', shape })

export const poly = (...coords: number[]): DiagramPrimitive => ({
  kind: 'polygon',
  points: toPoints(coords),
})

export const shade = (...coords: number[]): DiagramPrimitive => ({
  kind: 'shade',
  points: toPoints(coords),
})

export const line = (x1: number, y1: number, x2: number, y2: number, dashed = false): DiagramPrimitive => ({
  kind: 'line',
  from: p(x1, y1),
  to: p(x2, y2),
  dashed,
})

export const valley = (x1: number, y1: number, x2: number, y2: number): DiagramPrimitive => ({
  kind: 'fold',
  from: p(x1, y1),
  to: p(x2, y2),
  fold: 'valley',
})

export const mountain = (x1: number, y1: number, x2: number, y2: number): DiagramPrimitive => ({
  kind: 'fold',
  from: p(x1, y1),
  to: p(x2, y2),
  fold: 'mountain',
})

export const crease = (x1: number, y1: number, x2: number, y2: number): DiagramPrimitive => ({
  kind: 'crease',
  from: p(x1, y1),
  to: p(x2, y2),
})

export const cutLine = (x1: number, y1: number, x2: number, y2: number): DiagramPrimitive => ({
  kind: 'cut',
  from: p(x1, y1),
  to: p(x2, y2),
})

export const arrow = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style: 'fold' | 'unfold' | 'flip' | 'push' | 'pull' | 'rotate' = 'fold',
): DiagramPrimitive => ({
  kind: 'arrow',
  from: p(x1, y1),
  to: p(x2, y2),
  style,
})

export const rotateArrow = (x: number, y: number, radius = 12, degrees = 180): DiagramPrimitive => ({
  kind: 'curve-arrow',
  at: p(x, y),
  radius,
  degrees,
})

export const dot = (x: number, y: number, label?: string): DiagramPrimitive => ({
  kind: 'dot',
  at: p(x, y),
  label,
})

export const label = (x: number, y: number, text: string): DiagramPrimitive => ({
  kind: 'label',
  at: p(x, y),
  text,
})

function toPoints(coords: number[]): Point[] {
  const points: Point[] = []
  for (let index = 0; index + 1 < coords.length; index += 2) {
    points.push(p(coords[index], coords[index + 1]))
  }
  return points
}
