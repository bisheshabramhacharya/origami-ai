import type { Adhesive, Audience, Match, PaperShape, PaperSpec, PaperWeight, ToolKind } from '@origami/core'

export const TOOL_LABELS: Record<ToolKind, string> = {
  scissors: 'scissors',
  'craft-knife': 'craft knife',
  'bone-folder': 'bone folder',
  ruler: 'ruler',
  pen: 'pen',
  printer: 'printer',
  'cutting-mat': 'cutting mat',
  pencil: 'pencil',
}

export const ADHESIVE_LABELS: Record<Adhesive, string> = {
  'glue-stick': 'glue stick',
  'pva-glue': 'PVA glue',
  tape: 'tape',
  'double-sided-tape': 'double-sided tape',
  stapler: 'stapler',
}

export const PAPER_WEIGHT_LABELS: Record<PaperWeight, string> = {
  printer: 'printer paper',
  copy: 'copy paper',
  cardstock: 'cardstock',
  kami: 'origami paper',
  'tissue-foil': 'tissue foil',
  kraft: 'kraft paper',
  any: 'any paper',
}

export const PAPER_SHAPE_LABELS: Record<PaperShape, string> = {
  square: 'square',
  rectangle: 'rectangle',
  a4: 'A4',
  letter: 'Letter',
  circle: 'circle',
}

export const AUDIENCE_LABELS: Record<Audience, string> = {
  child: 'children',
  beginner: 'beginners',
  intermediate: 'some experience',
  advanced: 'advanced',
  expert: 'experts',
}

export function timeLabel(time: { min: number; max: number }): string {
  return time.min === time.max ? `${time.min} min` : `${time.min}-${time.max} min`
}

export function paperLabel(paper: PaperSpec): string {
  const sheets = paper.sheets === 1 ? '1 sheet' : `${paper.sheets} sheets`
  return `${sheets} ${PAPER_SHAPE_LABELS[paper.shape]} - ${paper.size}`
}

export function matchLabel(match: Match): string {
  switch (match) {
    case 'great':
      return 'Best fit'
    case 'good':
      return 'Good fit'
    case 'stretch':
      return 'A stretch'
    case 'excluded':
      return 'Not suitable'
  }
}

export function matchTone(match: Match): 'good' | 'info' | 'warn' {
  if (match === 'great') return 'good'
  if (match === 'good') return 'info'
  return 'warn'
}

export function toolLabel(tools: ToolKind[]): string {
  if (tools.length === 0) return 'nothing, just your hands'
  return tools.map((tool) => TOOL_LABELS[tool]).join(', ')
}

export function adhesiveLabel(adhesives: Adhesive[]): string {
  if (adhesives.length === 0) return 'no glue or tape'
  return adhesives.map((adhesive) => ADHESIVE_LABELS[adhesive]).join(', ')
}

export function percent(value: number): string {
  return `${Math.round(value)}%`
}
