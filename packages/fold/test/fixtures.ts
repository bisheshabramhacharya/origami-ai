import type { FoldSequenceInput } from '../src'

/** The crane's first folds, as a test fixture (the fold engine does not depend on core). */
export const creases: FoldSequenceInput['steps'] = [
  { step: '2', actions: [{ kind: 'valley', name: 'd1', line: { bring: 'B', to: 'D' } }, { kind: 'unfold', creases: ['d1'] }] },
  { step: '3', actions: [{ kind: 'valley', name: 'd2', line: { bring: 'A', to: 'C' } }, { kind: 'unfold', creases: ['d2'] }] },
  {
    step: '4',
    actions: [
      { kind: 'turn-over' },
      { kind: 'valley', name: 'b1', line: { bring: 'A', to: 'D' } },
      { kind: 'unfold', creases: ['b1'] },
      { kind: 'valley', name: 'b2', line: { bring: 'A', to: 'B' } },
      { kind: 'unfold', creases: ['b2'] },
    ],
  },
]

export const squareBase: FoldSequenceInput = {
  paper: { widthMm: 150, heightMm: 150 },
  steps: [
    ...creases,
    {
      step: '5',
      actions: [
        { kind: 'collapse', set: [{ crease: 'd2', assignment: 'V' }, { crease: 'b1', assignment: 'M' }, { crease: 'b2', assignment: 'M' }] },
        { kind: 'rotate', degrees: -135 },
      ],
    },
  ],
}


export const kites: FoldSequenceInput['steps'] = [
  { step: '6', actions: [{ kind: 'valley', name: 'k1', line: { bringEdge: ['C', 'BC'], to: { crease: 'd1' } }, layers: 'top' }] },
  { step: '7', actions: [{ kind: 'valley', name: 'k2', line: { bringEdge: ['C', 'CD'], to: { crease: 'd1' } }, layers: 'top' }] },
]

export const topFold: FoldSequenceInput['steps'][number] = {
  step: '8',
  actions: [
    {
      kind: 'valley',
      name: 't1',
      line: {
        through: [
          { intersect: [{ crease: 'k1' }, { crease: 'b1' }] },
          { intersect: [{ crease: 'k2' }, { crease: 'b2' }] },
        ],
      },
      moving: 'O',
    },
    { kind: 'unfold', last: 3 },
  ],
}

export const withSteps = (...steps: FoldSequenceInput['steps']): FoldSequenceInput => ({
  paper: squareBase.paper,
  steps: [...squareBase.steps, ...steps],
})

const meet = (a: string, b: string) => ({ intersect: [{ crease: a }, { crease: b }] as [{ crease: string }, { crease: string }] })

/** The petal fold on the front flap (crane Step 9), with the assignments it needs. */
export const petalFront = (t1: 'V' | 'M' = 'V'): FoldSequenceInput['steps'][number] => ({
  step: '9',
  actions: [
    {
      kind: 'petal',
      keep: 'A',
      set: [
        { crease: 't1', assignment: t1, from: meet('k1', 'b1'), to: meet('k2', 'b2') },
        { crease: 'k1', assignment: 'M' },
        { crease: 'k2', assignment: 'M' },
        { crease: 'b1', assignment: 'F', from: 'BC', to: meet('k1', 'b1') },
        { crease: 'b2', assignment: 'F', from: 'CD', to: meet('k2', 'b2') },
      ],
    },
  ],
})

/** "Repeat behind" (crane Step 10): turn over, two kite folds, then the petal fold on the back flap. */
export const petalBack: FoldSequenceInput['steps'][number] = {
  step: '10',
  actions: [
    { kind: 'turn-over' },
    { kind: 'valley', name: 'k3', line: { bringEdge: ['A', 'AB'], to: { crease: 'd1' } }, layers: 'top' },
    { kind: 'valley', name: 'k4', line: { bringEdge: ['A', 'DA'], to: { crease: 'd1' } }, layers: 'top' },
    {
      kind: 'petal',
      keep: 'C',
      set: [
        { crease: 't1', assignment: 'V', from: meet('k3', 'b2'), to: meet('k4', 'b1') },
        { crease: 'k3', assignment: 'M' },
        { crease: 'k4', assignment: 'M' },
        { crease: 'b2', assignment: 'F', from: 'AB', to: meet('k3', 'b2') },
        { crease: 'b1', assignment: 'F', from: 'DA', to: meet('k4', 'b1') },
      ],
    },
  ],
}

const centre = { through: ['A', 'B'] as [string, string] }

/** Thin the body (crane Step 11): the lower edges of the front, then of the back, to the centre line. */
export const thin: FoldSequenceInput['steps'][number] = {
  step: '11',
  actions: [
    { kind: 'valley', name: 'n1', line: { bringEdge: ['D', meet('k4', 'b1')], to: centre }, layers: 'top' },
    { kind: 'valley', name: 'n2', line: { bringEdge: ['B', meet('k3', 'b2')], to: centre }, layers: 'top' },
    { kind: 'turn-over' },
    { kind: 'valley', name: 'n3', line: { bringEdge: ['B', meet('k1', 'b1')], to: centre }, layers: 'top' },
    { kind: 'valley', name: 'n4', line: { bringEdge: ['D', meet('k2', 'b2')], to: centre }, layers: 'top' },
  ],
}

/** Neck and tail (crane Step 12): reverse folds of the two long points, 15° from the learner's horizontal. */
export const neckAndTail = (kind: 'inside-reverse' | 'outside-reverse' = 'inside-reverse'): FoldSequenceInput['steps'][number] => ({
  step: '12',
  actions: [
    { kind, name: 'r1', line: { pivot: 'DA', angleDeg: 15 }, flap: 'D', moving: 'D' },
    { kind, name: 'r2', line: { pivot: 'DA', angleDeg: -15 }, flap: 'B', moving: 'B' },
  ],
})

/** The head (crane Step 13): an inside reverse fold a quarter of the way down the neck. */
export const head: FoldSequenceInput['steps'][number] = {
  step: '13',
  actions: [{ kind: 'inside-reverse', name: 'h1', line: { pivot: { along: ['D', 'DA'], fraction: 0.25 }, angleDeg: 0 }, flap: 'D', moving: 'D' }],
}

export const birdBase = [...kites, topFold, petalFront(), petalBack]
