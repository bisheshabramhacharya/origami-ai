import type { FoldSequenceInput } from '@origami/fold'

/**
 * The crane's exact folds, one group per Step, in the fold language. 150 mm kami, coloured side
 * up. Corners: A top left, B top right, C bottom right, D bottom left (on the flat sheet).
 */
export const CRANE_FOLD_SEQUENCE: FoldSequenceInput = {
  paper: { widthMm: 150, heightMm: 150 },
  steps: [
    { step: 'crane-1', actions: [] },
    {
      step: 'crane-2',
      actions: [
        { kind: 'valley', name: 'd1', line: { bring: 'B', to: 'D' }, note: 'Corner to corner along the A–C diagonal.' },
        { kind: 'unfold', creases: ['d1'] },
      ],
    },
    {
      step: 'crane-3',
      actions: [
        { kind: 'valley', name: 'd2', line: { bring: 'A', to: 'C' }, note: 'Top left corner down to bottom right.' },
        { kind: 'unfold', creases: ['d2'] },
      ],
    },
    {
      step: 'crane-4',
      actions: [
        { kind: 'turn-over' },
        { kind: 'valley', name: 'b1', line: { bring: 'A', to: 'D' }, note: 'In half, top edge to bottom edge.' },
        { kind: 'unfold', creases: ['b1'] },
        { kind: 'valley', name: 'b2', line: { bring: 'A', to: 'B' }, note: 'In half the other way.' },
        { kind: 'unfold', creases: ['b2'] },
      ],
    },
    {
      step: 'crane-5',
      actions: [
        {
          kind: 'collapse',
          note: 'The book creases fold as mountains and one diagonal as a valley; the other diagonal stays flat in the middle of each face.',
          set: [
            { crease: 'd2', assignment: 'V' },
            { crease: 'b1', assignment: 'M' },
            { crease: 'b2', assignment: 'M' },
          ],
        },
        { kind: 'rotate', degrees: -135, note: 'Hinge (the centre O) at the top, open end down.' },
      ],
    },
    {
      step: 'crane-6',
      actions: [
        {
          kind: 'valley',
          name: 'k1',
          line: { bringEdge: ['C', 'BC'], to: { crease: 'd1' } },
          layers: 'top',
          note: 'The front flap is the quarter of the sheet around corner C. Its lower right edge (C to BC) goes to the centre line.',
        },
      ],
    },
    {
      step: 'crane-7',
      actions: [{ kind: 'valley', name: 'k2', line: { bringEdge: ['C', 'CD'], to: { crease: 'd1' } }, layers: 'top' }],
    },
    {
      step: 'crane-8',
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
          note: 'The line joins the top ends of the two kite folds.',
        },
        { kind: 'unfold', last: 3 },
      ],
    },
  ],
}
