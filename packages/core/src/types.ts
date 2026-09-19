import { z } from 'zod'

export const TechniqueSchema = z.enum([
  'origami',
  'modular-origami',
  'kirigami',
  'cut-and-fold',
  'printable-papercraft',
  'paper-toy',
  'pop-up',
  'paper-engineering',
  'geometric',
  'packaging',
  'prototype',
])
export type Technique = z.infer<typeof TechniqueSchema>

export const TECHNIQUE_LABELS: Record<Technique, string> = {
  origami: 'Origami',
  'modular-origami': 'Modular origami',
  kirigami: 'Kirigami',
  'cut-and-fold': 'Cut and fold',
  'printable-papercraft': 'Printable papercraft',
  'paper-toy': 'Paper toy',
  'pop-up': 'Pop-up',
  'paper-engineering': 'Paper engineering',
  geometric: 'Geometric',
  packaging: 'Packaging',
  prototype: 'Prototype',
}

export const AudienceSchema = z.enum(['child', 'beginner', 'intermediate', 'advanced', 'expert'])
export type Audience = z.infer<typeof AudienceSchema>

export const PaperShapeSchema = z.enum(['square', 'rectangle', 'a4', 'letter', 'circle'])
export type PaperShape = z.infer<typeof PaperShapeSchema>

export const PaperWeightSchema = z.enum([
  'printer',
  'copy',
  'cardstock',
  'kami',
  'tissue-foil',
  'kraft',
  'any',
])
export type PaperWeight = z.infer<typeof PaperWeightSchema>

export const ToolKindSchema = z.enum([
  'scissors',
  'craft-knife',
  'bone-folder',
  'ruler',
  'pen',
  'printer',
  'cutting-mat',
  'pencil',
])
export type ToolKind = z.infer<typeof ToolKindSchema>

export const AdhesiveSchema = z.enum(['glue-stick', 'pva-glue', 'tape', 'double-sided-tape', 'stapler'])
export type Adhesive = z.infer<typeof AdhesiveSchema>

export const OPERATIONS = [
  'fold',
  'valley-fold',
  'mountain-fold',
  'reverse-fold',
  'squash-fold',
  'petal-fold',
  'crimp-fold',
  'pleat-fold',
  'blintz-fold',
  'kite-fold',
  'rabbit-ear-fold',
  'unfold',
  'crease',
  'collapse',
  'flip',
  'rotate',
  'turn-over',
  'open',
  'press-flat',
  'cut',
  'score',
  'punch',
  'roll',
  'curl',
  'inflate',
  'insert',
  'tuck',
  'assemble',
  'glue',
  'tape',
  'staple',
  'print',
  'shape',
  'stand',
] as const
export const OperationSchema = z.enum(OPERATIONS)
export type Operation = z.infer<typeof OperationSchema>

export const OPERATION_LABELS: Record<Operation, string> = {
  fold: 'fold',
  'valley-fold': 'valley fold',
  'mountain-fold': 'mountain fold',
  'reverse-fold': 'reverse fold',
  'squash-fold': 'squash fold',
  'petal-fold': 'petal fold',
  'crimp-fold': 'crimp fold',
  'pleat-fold': 'pleat fold',
  'blintz-fold': 'blintz fold',
  'kite-fold': 'kite fold',
  'rabbit-ear-fold': 'rabbit ear fold',
  unfold: 'unfold',
  crease: 'crease',
  collapse: 'collapse',
  flip: 'flip',
  rotate: 'rotate',
  'turn-over': 'turn over',
  open: 'open out',
  'press-flat': 'press flat',
  cut: 'cut',
  score: 'score',
  punch: 'punch',
  roll: 'roll',
  curl: 'curl',
  inflate: 'inflate',
  insert: 'insert',
  tuck: 'tuck in',
  assemble: 'assemble',
  glue: 'glue',
  tape: 'tape',
  staple: 'staple',
  print: 'print',
  shape: 'shape',
  stand: 'stand up',
}

export const PointSchema = z.object({ x: z.number(), y: z.number() })
export type Point = z.infer<typeof PointSchema>

export const DiagramPrimitiveSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('sheet'), shape: PaperShapeSchema, rotation: z.number().optional() }),
  z.object({ kind: z.literal('polygon'), points: z.array(PointSchema).min(3), shade: z.boolean().optional() }),
  z.object({ kind: z.literal('line'), from: PointSchema, to: PointSchema, dashed: z.boolean().optional() }),
  z.object({
    kind: z.literal('fold'),
    from: PointSchema,
    to: PointSchema,
    fold: z.enum(['valley', 'mountain', 'unfold', 'existing']),
  }),
  z.object({ kind: z.literal('cut'), from: PointSchema, to: PointSchema }),
  z.object({ kind: z.literal('crease'), from: PointSchema, to: PointSchema }),
  z.object({
    kind: z.literal('arrow'),
    from: PointSchema,
    to: PointSchema,
    style: z.enum(['fold', 'unfold', 'flip', 'push', 'pull', 'rotate']).optional(),
  }),
  z.object({
    kind: z.literal('curve-arrow'),
    at: PointSchema,
    degrees: z.number(),
    radius: z.number(),
  }),
  z.object({ kind: z.literal('dot'), at: PointSchema, label: z.string().optional() }),
  z.object({ kind: z.literal('label'), at: PointSchema, text: z.string() }),
  z.object({ kind: z.literal('shade'), points: z.array(PointSchema).min(3) }),
])
export type DiagramPrimitive = z.infer<typeof DiagramPrimitiveSchema>

export const DiagramSchema = z.object({
  primitives: z.array(DiagramPrimitiveSchema).min(1),
  caption: z.string().optional(),
})
export type Diagram = z.infer<typeof DiagramSchema>

export const StepSchema = z.object({
  id: z.string().min(1),
  ordinal: z.number().int().min(1),
  title: z.string().min(1),
  instruction: z.string().min(1),
  diagram: DiagramSchema,
  checkpoints: z.array(z.string()).default([]),
  commonMistakes: z.array(z.string()).default([]),
  operations: z.array(OperationSchema).min(1),
  durationSeconds: z.number().int().min(5).default(45),
})
export type Step = z.infer<typeof StepSchema>

export const PaperSpecSchema = z.object({
  sheets: z.number().int().min(1),
  shape: PaperShapeSchema,
  size: z.string().min(1),
  weight: PaperWeightSchema,
  notes: z.string().optional(),
})
export type PaperSpec = z.infer<typeof PaperSpecSchema>

export const ProvenanceSchema = z.object({
  source: z.string().min(1),
  license: z.string().min(1),
  contributor: z.string().default('seed-library'),
  notes: z.string().optional(),
})
export type Provenance = z.infer<typeof ProvenanceSchema>

export const ValidationSchema = z.object({
  status: z.enum(['validated', 'needs-review']),
  checkedBy: z.string().min(1),
  checkedAt: z.string().min(1),
  checks: z.array(z.string()).min(1),
  foldableByHand: z.boolean(),
})
export type Validation = z.infer<typeof ValidationSchema>

export const ModelSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  technique: TechniqueSchema,
  objectTags: z.array(z.string().min(1)).min(1),
  audience: z.array(AudienceSchema).min(1),
  difficulty: z.number().int().min(1).max(5),
  timeMinutes: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  paper: PaperSpecSchema,
  tools: z.array(ToolKindSchema),
  adhesives: z.array(AdhesiveSchema),
  steps: z.array(StepSchema).min(3),
  preview: DiagramSchema,
  tips: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  provenance: ProvenanceSchema,
  validation: ValidationSchema,
})
export type Model = z.infer<typeof ModelSchema>
export type ModelInput = z.input<typeof ModelSchema>

export const ConstraintsSchema = z.object({
  difficultyMax: z.number().int().min(1).max(5).default(3),
  timeMinutesMax: z.number().int().min(5).default(60),
  sheetsMax: z.number().int().min(1).default(8),
  noScissors: z.boolean().default(false),
  noGlue: z.boolean().default(false),
  noPrinter: z.boolean().default(false),
  paperWeights: z.array(PaperWeightSchema).default([]),
  techniquesAllowed: z.array(TechniqueSchema).default([]),
  techniquesExcluded: z.array(TechniqueSchema).default([]),
})
export type Constraints = z.infer<typeof ConstraintsSchema>

export const BuildBriefSchema = z.object({
  rawText: z.string(),
  objectLabel: z.string().min(1),
  objectTags: z.array(z.string()).min(1),
  constraints: ConstraintsSchema,
  notes: z.array(z.string()).default([]),
  unparsed: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  source: z.enum(['heuristic', 'llm']),
})
export type BuildBrief = z.infer<typeof BuildBriefSchema>

export const DIFFICULTY_LABELS = ['', 'Very easy', 'Easy', 'Medium', 'Hard', 'Very hard'] as const
export function difficultyLabel(difficulty: number): string {
  return DIFFICULTY_LABELS[difficulty] ?? 'Unknown'
}

export const MatchSchema = z.enum(['great', 'good', 'stretch', 'excluded'])
export type Match = z.infer<typeof MatchSchema>

export const RankedOptionSchema = z.object({
  model: ModelSchema,
  score: z.number(),
  match: MatchSchema,
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
})
export type RankedOption = z.infer<typeof RankedOptionSchema>

export const ExplanationLevelSchema = z.enum(['simpler', 'detail', 'analogy', 'troubleshoot', 'visual'])
export type ExplanationLevel = z.infer<typeof ExplanationLevelSchema>

export const ExplanationSchema = z.object({
  modelId: z.string(),
  stepId: z.string(),
  level: ExplanationLevelSchema,
  text: z.string().min(1),
  hint: z.string().optional(),
  provider: z.enum(['llm', 'heuristic']),
})
export type Explanation = z.infer<typeof ExplanationSchema>

export const GroundingViolationSchema = z.object({
  term: z.string(),
  operation: OperationSchema,
  message: z.string(),
})
export type GroundingViolation = z.infer<typeof GroundingViolationSchema>

export const GroundingReportSchema = z.object({
  ok: z.boolean(),
  violations: z.array(GroundingViolationSchema),
  allowedOperations: z.array(OperationSchema),
  mentionedOperations: z.array(OperationSchema),
})
export type GroundingReport = z.infer<typeof GroundingReportSchema>

export const LibraryIssueSchema = z.object({
  modelId: z.string(),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
})
export type LibraryIssue = z.infer<typeof LibraryIssueSchema>
