import type { FoldSequenceInput } from '@origami/fold'

/**
 * The crane's exact folds, one group per Step, in the fold language. 150 mm kami, coloured side
 * up. Corners: A top left, B top right, C bottom right, D bottom left (on the flat sheet).
 */
const meet = (a: string, b: string) => ({ intersect: [{ crease: a }, { crease: b }] as [{ crease: string }, { crease: string }] })
/** The centre line of the bird base, from its two points to its bottom. */
const centreLine = { through: ['A', 'B'] as [string, string] }

/** The fold angle of each wing hinge on the finished crane: 180 is folded flat, 90 stands straight out. */
export const CRANE_WING_DEGREES = 90

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
    {
      step: 'crane-9',
      actions: [
        {
          kind: 'petal',
          keep: 'A',
          note: 'Lift the bottom point of the front flap up along t1; the sides fold in along the kite creases.',
          set: [
            { crease: 't1', assignment: 'V', from: { intersect: [{ crease: 'k1' }, { crease: 'b1' }] }, to: { intersect: [{ crease: 'k2' }, { crease: 'b2' }] } },
            { crease: 'k1', assignment: 'M' },
            { crease: 'k2', assignment: 'M' },
            { crease: 'b1', assignment: 'F', from: 'BC', to: { intersect: [{ crease: 'k1' }, { crease: 'b1' }] } },
            { crease: 'b2', assignment: 'F', from: 'CD', to: { intersect: [{ crease: 'k2' }, { crease: 'b2' }] } },
          ],
        },
      ],
    },
    {
      step: 'crane-10',
      actions: [
        { kind: 'turn-over' },
        { kind: 'valley', name: 'k3', line: { bringEdge: ['A', 'AB'], to: { crease: 'd1' } }, layers: 'top' },
        { kind: 'valley', name: 'k4', line: { bringEdge: ['A', 'DA'], to: { crease: 'd1' } }, layers: 'top' },
        {
          kind: 'petal',
          keep: 'C',
          note: 'The top fold t1 already went through the back layers in Step 8, so its crease is there.',
          set: [
            { crease: 't1', assignment: 'V', from: { intersect: [{ crease: 'k3' }, { crease: 'b2' }] }, to: { intersect: [{ crease: 'k4' }, { crease: 'b1' }] } },
            { crease: 'k3', assignment: 'M' },
            { crease: 'k4', assignment: 'M' },
            { crease: 'b2', assignment: 'F', from: 'AB', to: { intersect: [{ crease: 'k3' }, { crease: 'b2' }] } },
            { crease: 'b1', assignment: 'F', from: 'DA', to: { intersect: [{ crease: 'k4' }, { crease: 'b1' }] } },
          ],
        },
      ],
    },
    {
      step: 'crane-11',
      actions: [
        { kind: 'valley', name: 'n1', line: { bringEdge: ['D', meet('k4', 'b1')], to: centreLine }, layers: 'top' },
        { kind: 'valley', name: 'n2', line: { bringEdge: ['B', meet('k3', 'b2')], to: centreLine }, layers: 'top' },
        { kind: 'turn-over' },
        { kind: 'valley', name: 'n3', line: { bringEdge: ['B', meet('k1', 'b1')], to: centreLine }, layers: 'top' },
        { kind: 'valley', name: 'n4', line: { bringEdge: ['D', meet('k2', 'b2')], to: centreLine }, layers: 'top' },
      ],
    },
    {
      step: 'crane-12',
      actions: [
        {
          kind: 'inside-reverse',
          name: 'r1',
          note: 'The neck: the left long point goes up between the wings, 30° from upright.',
          line: { pivot: 'DA', angleDeg: 15 },
          flap: 'D',
          moving: 'D',
        },
        {
          kind: 'inside-reverse',
          name: 'r2',
          note: 'The tail: the same on the right.',
          line: { pivot: 'DA', angleDeg: -15 },
          flap: 'B',
          moving: 'B',
        },
      ],
    },
    {
      step: 'crane-13',
      actions: [
        {
          kind: 'inside-reverse',
          name: 'h1',
          note: 'The head: a quarter of the way down the neck.',
          line: { pivot: { along: ['D', 'DA'], fraction: 0.25 }, angleDeg: 0 },
          flap: 'D',
          moving: 'D',
        },
        {
          kind: 'valley',
          name: 'w1',
          note: 'Fold the front wing down on a level line through the centre of the sheet.',
          line: { pivot: 'O', angleDeg: 0 },
          moving: 'C',
          layers: 'top',
        },
        { kind: 'turn-over' },
        {
          kind: 'valley',
          name: 'w2',
          note: 'Fold the back wing down to match.',
          line: { pivot: 'O', angleDeg: 0 },
          moving: 'A',
          layers: 'top',
        },
        { kind: 'turn-over' },
        {
          kind: 'open',
          creases: ['w1', 'w2'],
          degrees: CRANE_WING_DEGREES,
          note: 'Lift both wings so they stand straight out from the body.',
        },
      ],
    },
    {
      step: 'crane-14',
      note: 'The 3D view keeps the body flat. You round it by hand: pull the wings apart gently and blow into the hole underneath.',
      actions: [],
    },
  ],
}
