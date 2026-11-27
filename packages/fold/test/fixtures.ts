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
