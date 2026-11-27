import type { FoldSequenceInput } from '@origami/fold'

/**
 * The paper dart's exact folds, one group per Step, in the fold language. US Letter, portrait.
 * Corners: A top left, B top right, C bottom right, D bottom left; AB (the middle of the top edge) is the nose.
 */
const meet = (crease: string, a: string, b: string) => ({ intersect: [{ crease }, { through: [a, b] }] as [{ crease: string }, { through: [string, string] }] })

/** The wing line goes through the nose and halves the 22.5° between the slanted edge and the centre crease. */
export const DART_WING_LINE_DEGREES = 11.25

/** The fold angle of each wing hinge on the finished dart: 90 puts the wings straight out from the body, level. */
export const DART_WING_DEGREES = 90

export const DART_FOLD_SEQUENCE: FoldSequenceInput = {
  paper: { widthMm: 215.9, heightMm: 279.4 },
  steps: [
    {
      step: 'dart-1',
      actions: [
        { kind: 'valley', name: 'c', line: { bring: 'A', to: 'B' }, note: 'In half the long way, left edge onto right edge.' },
        { kind: 'unfold', creases: ['c'] },
      ],
    },
    {
      step: 'dart-2',
      actions: [
        { kind: 'valley', name: 'k1', line: { bringEdge: ['AB', 'A'], to: { crease: 'c' } }, note: 'The top edge of the left corner onto the centre crease.' },
        { kind: 'valley', name: 'k2', line: { bringEdge: ['AB', 'B'], to: { crease: 'c' } }, note: 'The same on the right.' },
      ],
    },
    {
      step: 'dart-3',
      actions: [
        { kind: 'valley', name: 's1', line: { bringEdge: ['AB', meet('k1', 'A', 'D')], to: { crease: 'c' } }, note: 'The slanted left edge onto the centre crease.' },
        { kind: 'valley', name: 's2', line: { bringEdge: ['AB', meet('k2', 'B', 'C')], to: { crease: 'c' } }, note: 'The same on the right.' },
      ],
    },
    {
      step: 'dart-4',
      actions: [{ kind: 'mountain', name: 'h', line: { crease: 'c' }, moving: 'D', note: 'The left half goes behind, so the flaps stay outside.' }],
    },
    {
      step: 'dart-5',
      actions: [
        {
          kind: 'valley',
          name: 'w1',
          line: { pivot: 'AB', angleDeg: -(90 - DART_WING_LINE_DEGREES) },
          moving: 'C',
          layers: 'above',
          note: 'The front wing down: its slanted top edge onto the bottom edge of the body.',
        },
        { kind: 'turn-over' },
        {
          kind: 'valley',
          name: 'w2',
          line: { pivot: 'AB', angleDeg: -(90 + DART_WING_LINE_DEGREES) },
          moving: 'D',
          layers: 'above',
          note: 'The other wing to match.',
        },
      ],
    },
    {
      step: 'dart-6',
      actions: [{ kind: 'open', creases: ['w1', 'w2'], degrees: DART_WING_DEGREES, note: 'Both wings out level, straight out from the body.' }],
    },
  ],
}
