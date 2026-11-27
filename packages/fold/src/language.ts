import { z } from 'zod'

/**
 * The fold language: how a fold sequence (and an LLM draft) is written.
 * Points and lines are named, never given as raw coordinates.
 *
 * Start names on every sheet: corners A, B, C, D (A top left, then clockwise, coloured side up),
 * edge midpoints AB, BC, CD, DA, and the centre O. Each fold that makes a crease can name it
 * (for example "d1"); later actions can use the crease as a line and the intersection of two
 * named lines as a point.
 */

export type PointRef =
  | string
  | { intersect: [LineRef, LineRef] }
  /** The point a fraction of the way from one point to another on the flat sheet (0 is the first point). */
  | { along: [PointRef, PointRef]; fraction: number }
export type LineRef = { crease: string } | { through: [PointRef, PointRef] }

export const PointRefSchema: z.ZodType<PointRef> = z.lazy(() =>
  z.union([
    z.string().min(1),
    z.object({ intersect: z.tuple([LineRefSchema, LineRefSchema]) }).strict(),
    z.object({ along: z.tuple([PointRefSchema, PointRefSchema]), fraction: z.number().min(0).max(1) }).strict(),
  ]),
)

export const LineRefSchema: z.ZodType<LineRef> = z.lazy(() =>
  z.union([
    z.object({ crease: z.string().min(1) }).strict(),
    z.object({ through: z.tuple([PointRefSchema, PointRefSchema]) }).strict(),
  ]),
)

/** Huzita–Hatori axioms in book words. */
export const FoldLineSchema = z.union([
  /** Axiom 2: bring point to point. The point that is brought moves. */
  z.object({ bring: PointRefSchema, to: PointRefSchema }).strict(),
  /** Axiom 1: fold along the line through two points. Say which side moves with `moving`. */
  z.object({ through: z.tuple([PointRefSchema, PointRefSchema]) }).strict(),
  /** Axiom 3: bring an edge (given by two points on it) onto a line. The second point moves. */
  z.object({ bringEdge: z.tuple([PointRefSchema, PointRefSchema]), to: LineRefSchema }).strict(),
  /** Fold again along a crease that already exists. Say which side moves with `moving`. */
  z.object({ crease: z.string().min(1) }).strict(),
  /**
   * A line through a point at an angle the diagram draws by eye (degrees counter-clockwise from the
   * learner's horizontal), for example the neck of the crane. Say which side moves with `moving`.
   */
  z.object({ pivot: PointRefSchema, angleDeg: z.number().min(-360).max(360) }).strict(),
])
export type FoldLine = z.infer<typeof FoldLineSchema>

/** Which layers a simple fold moves. */
export const LayersSchema = z.union([
  z.literal('all'),
  /** The top layer of those that carry the point that moves, and the paper joined to it on that side. */
  z.literal('top'),
  /** As `top`, and every layer that lies over it on the side that moves (for example a wing with loose flaps on it). */
  z.literal('above'),
  z.object({ flap: PointRefSchema }).strict(),
])
export type Layers = z.infer<typeof LayersSchema>

export const AssignmentSchema = z.enum(['V', 'M', 'F'])

const note = z.string().optional()

export const SimpleFoldSchema = z
  .object({
    kind: z.enum(['valley', 'mountain']),
    name: z.string().min(1).optional(),
    line: FoldLineSchema,
    layers: LayersSchema.default('all'),
    moving: PointRefSchema.optional(),
    /** Fold angle in degrees. 180 is folded flat (the default). */
    degrees: z.number().gt(0).max(180).default(180),
    note,
  })
  .strict()

export const UnfoldSchema = z
  .object({
    kind: z.literal('unfold'),
    /** Unfold the last N named folds. */
    last: z.number().int().min(1).optional(),
    /** Or unfold these named creases. */
    creases: z.array(z.string().min(1)).min(1).optional(),
    note,
  })
  .strict()
  .refine((a) => (a.last === undefined) !== (a.creases === undefined), {
    message: 'An unfold names either `last` or `creases`, not both and not neither.',
  })

export const TurnOverSchema = z
  .object({ kind: z.literal('turn-over'), axis: z.enum(['vertical', 'horizontal']).default('vertical'), note })
  .strict()

export const RotateSchema = z.object({ kind: z.literal('rotate'), degrees: z.number(), note }).strict()

export const CreaseChangeSchema = z
  .object({
    crease: z.string().min(1),
    assignment: AssignmentSchema,
    /** Only the part of the crease between these two points (in the flat sheet). */
    from: PointRefSchema.optional(),
    to: PointRefSchema.optional(),
  })
  .strict()

/** Compound folds given as the creases whose assignment changes. The engine works out the shape. */
export const CompoundSchema = z
  .object({
    kind: z.enum(['collapse', 'squash', 'petal']),
    set: z.array(CreaseChangeSchema).min(1),
    /** A point on a layer that stays still. Without it the model keeps its place as well as it can. */
    keep: PointRefSchema.optional(),
    note,
  })
  .strict()

/** Reverse folds of a flap along a line. The flap goes inside (or wraps outside) its own layers. */
export const ReverseSchema = z
  .object({
    kind: z.enum(['inside-reverse', 'outside-reverse']),
    name: z.string().min(1).optional(),
    line: FoldLineSchema,
    flap: PointRefSchema,
    moving: PointRefSchema.optional(),
    note,
  })
  .strict()

/** Turn the flaps on named hinge creases to a fold angle that is not flat, for example wings at 90°. */
export const OpenSchema = z
  .object({
    kind: z.literal('open'),
    creases: z.array(z.string().min(1)).min(1),
    degrees: z.number().min(0).max(180),
    note,
  })
  .strict()

export const FoldActionSchema = z.union([
  SimpleFoldSchema,
  UnfoldSchema,
  TurnOverSchema,
  RotateSchema,
  CompoundSchema,
  ReverseSchema,
  OpenSchema,
])
export type FoldAction = z.infer<typeof FoldActionSchema>
export type FoldActionInput = z.input<typeof FoldActionSchema>
export type SimpleFold = z.infer<typeof SimpleFoldSchema>
export type Compound = z.infer<typeof CompoundSchema>
export type Reverse = z.infer<typeof ReverseSchema>
export type Open = z.infer<typeof OpenSchema>

export const PaperSchema = z
  .object({
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
  })
  .strict()
export type Paper = z.infer<typeof PaperSchema>

export const FoldStepSchema = z
  .object({
    step: z.string().min(1),
    actions: z.array(FoldActionSchema),
    /** A short note for the learner about this Step's end state, for example what is shaped by hand. */
    note: z.string().min(1).optional(),
  })
  .strict()
export type FoldStep = z.infer<typeof FoldStepSchema>
export type FoldStepInput = z.input<typeof FoldStepSchema>

export const FoldSequenceSchema = z
  .object({
    paper: PaperSchema,
    steps: z.array(FoldStepSchema).min(1),
  })
  .strict()
export type FoldSequence = z.infer<typeof FoldSequenceSchema>
export type FoldSequenceInput = z.input<typeof FoldSequenceSchema>

/** The fold kinds the engine reports, for the grounded check. */
export const FOLD_KINDS = [
  'valley',
  'mountain',
  'collapse',
  'squash',
  'petal',
  'inside-reverse',
  'outside-reverse',
  'unfold',
  'turn-over',
  'rotate',
  'open',
] as const
export type FoldKind = (typeof FOLD_KINDS)[number]
