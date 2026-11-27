import type { ModelInput } from '../types'
import { arrow, crease, diagram, label, line, mountain, poly, sheet, valley } from '../diagram'
import { seedProvenance, step } from './helpers'

/**
 * The classic dart on US Letter, portrait. Diagram units: the letter sheet is drawn from x 24 to 76
 * and y 14 to 86, so the nose (the middle of the top edge) is at (50, 14). Corner A lands on the
 * centre crease at y 41.8 (107.95 mm below the top edge); the second folds meet the side edges at y 81.2.
 */
const paperPlaneDart: ModelInput = {
  id: 'paper-plane-dart',
  title: 'Classic paper plane (dart)',
  summary: 'The paper plane everyone learns first. One sheet of printer paper, five folds, and it flies fast and straight.',
  technique: 'origami',
  objectTags: ['plane', 'airplane', 'vehicle', 'dart'],
  audience: ['child', 'beginner'],
  difficulty: 1,
  timeMinutes: { min: 3, max: 5 },
  paper: { sheets: 1, shape: 'letter', size: 'US Letter (8.5in x 11in)', weight: 'printer', notes: 'Any printer paper works. Crisp creases make it fly straighter.' },
  tools: [],
  adhesives: [],
  steps: [
    step({
      id: 'dart-1',
      ordinal: 1,
      title: 'Centre crease',
      instruction: 'Hold the sheet tall. Fold it in half the long way, left edge onto right edge, press the crease, then unfold.',
      operations: ['valley-fold', 'crease', 'unfold'],
      diagram: diagram('Crease down the middle', sheet('letter'), valley(50, 14, 50, 86), arrow(30, 50, 46, 50)),
      checkpoints: ['The crease runs from the middle of the top edge to the middle of the bottom edge'],
      commonMistakes: ['Folding the short way, which gives a crease across the sheet'],
      durationSeconds: 25,
    }),
    step({
      id: 'dart-2',
      ordinal: 2,
      title: 'Corners to the middle',
      instruction: 'Fold the top left corner down so its top edge lies along the centre crease. Do the same with the top right corner.',
      operations: ['valley-fold'],
      diagram: diagram(
        'Top corners to the centre crease',
        sheet('letter'),
        crease(50, 14, 50, 86),
        valley(50, 14, 24, 41.8),
        valley(50, 14, 76, 41.8),
        arrow(28, 18, 46, 36),
        arrow(72, 18, 54, 36),
      ),
      checkpoints: ['The two top edges meet on the centre crease', 'The top is now a sharp point'],
      commonMistakes: ['Leaving a gap at the centre crease, which makes the plane turn'],
      durationSeconds: 35,
    }),
    step({
      id: 'dart-3',
      ordinal: 3,
      title: 'Fold the edges in again',
      instruction: 'Fold the new slanted left edge onto the centre crease. Do the same on the right. The point gets narrower.',
      operations: ['valley-fold'],
      diagram: diagram(
        'Slanted edges to the centre crease',
        poly(50, 14, 76, 41.8, 76, 86, 24, 86, 24, 41.8),
        crease(50, 14, 50, 86),
        valley(50, 14, 24, 81.2),
        valley(50, 14, 76, 81.2),
        arrow(27, 50, 44, 50),
        arrow(73, 50, 56, 50),
      ),
      checkpoints: ['Both slanted edges lie along the centre crease', 'The nose is a long, narrow point'],
      commonMistakes: ['Folding past the centre crease, so the two sides overlap'],
      durationSeconds: 35,
    }),
    step({
      id: 'dart-4',
      ordinal: 4,
      title: 'Fold in half',
      instruction: 'Fold the plane in half along the centre crease, with the folded flaps on the outside.',
      operations: ['mountain-fold'],
      diagram: diagram(
        'In half, flaps outside',
        poly(50, 14, 76, 81.2, 76, 86, 24, 86, 24, 81.2),
        mountain(50, 14, 50, 86),
        arrow(32, 70, 46, 70),
      ),
      checkpoints: ['The flaps are on the outside', 'The two halves line up at the nose and the tail'],
      durationSeconds: 25,
    }),
    step({
      id: 'dart-5',
      ordinal: 5,
      title: 'Fold the wings down',
      instruction: 'Fold the top wing down so its slanted top edge lies along the bottom edge of the body. Turn over and fold the other wing to match.',
      operations: ['valley-fold', 'turn-over'],
      diagram: diagram(
        'Wing edge to the body edge',
        poly(50, 14, 76, 81.2, 76, 86, 50, 86),
        valley(50, 14, 63.4, 86),
        arrow(72, 74, 56, 74),
        label(42, 90, 'body'),
      ),
      checkpoints: ['Both wings are the same size', 'The body below the wings is the same height from nose to tail'],
      commonMistakes: ['Folding the wings to different lines, which makes the plane roll'],
      durationSeconds: 40,
    }),
    step({
      id: 'dart-6',
      ordinal: 6,
      title: 'Open the wings',
      instruction: 'Lift both wings out so they lie level, straight out from the body. Hold the body underneath and throw it gently forward.',
      operations: ['open', 'shape'],
      diagram: diagram('Wings out level', poly(50, 10, 84, 82, 50, 74, 16, 82), line(50, 10, 50, 74), label(40, 92, 'from behind')),
      checkpoints: ['The wings are level, not drooping', 'Seen from behind, the plane makes a T shape'],
      durationSeconds: 20,
    }),
  ],
  preview: diagram('The finished dart', poly(50, 10, 84, 82, 50, 74, 16, 82), line(50, 10, 50, 74)),
  tips: ['If it dives, bend the back edge of both wings up a little. If it climbs and stalls, bend them down.'],
  tags: ['beginner', 'quick', 'flies', 'no-tools', 'no-glue', 'one-sheet', 'letter'],
  provenance: seedProvenance('Traditional paper dart, public domain', 'Public domain'),
  // Nobody has folded this Model end to end against these Steps yet, so it is not retrievable (ADR-0001).
  // A person folds it (ticket 14) and then sets it to validated.
  validation: {
    status: 'needs-review',
    checkedBy: 'seed-library-author',
    checkedAt: '2026-11-27',
    checks: ['Steps written from the traditional dart; not yet folded end to end against these Steps'],
    foldableByHand: false,
  },
}

export const PLANE_MODELS: ModelInput[] = [paperPlaneDart]
