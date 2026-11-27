import type { ModelInput } from '../types'
import { arrow, crease, diagram, label, line, mountain, poly, sheet, valley } from '../diagram'
import { seedProvenance, step } from './helpers'
import { DART_FOLD_SEQUENCE } from './plane-folds'

/**
 * The classic dart on US Letter, portrait. Diagram units: the letter sheet is drawn from x 22.2 to 77.8
 * and y 14 to 86 (one unit is 3.88 mm both ways), so the nose (the middle of the top edge) is at (50, 14).
 * Corner A lands on the centre crease at y 41.8 (107.95 mm below the top edge); the second folds meet the
 * side edges at y 81.2 (260.6 mm); the wing line meets the bottom edge at x 64.3 (55.6 mm from the centre).
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
        valley(50, 14, 22.2, 41.8),
        valley(50, 14, 77.8, 41.8),
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
        poly(50, 14, 77.8, 41.8, 77.8, 86, 22.2, 86, 22.2, 41.8),
        crease(50, 14, 50, 86),
        valley(50, 14, 22.2, 81.2),
        valley(50, 14, 77.8, 81.2),
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
        'In half, left half behind',
        poly(50, 14, 77.8, 81.2, 77.8, 86, 22.2, 86, 22.2, 81.2),
        mountain(50, 14, 50, 86),
        arrow(32, 70, 46, 70, 'flip'),
        label(20, 93, 'left half goes behind'),
      ),
      checkpoints: ['The flaps are on the outside', 'The two halves line up at the nose and the tail'],
      durationSeconds: 25,
    }),
    step({
      id: 'dart-5',
      ordinal: 5,
      title: 'Fold the wings down',
      instruction:
        'Lay it flat with the nose up and the folded edge on the left. Fold the front wing over to the left so its slanted outer edge lies along the folded edge. Turn over and fold the other wing to match.',
      operations: ['valley-fold', 'turn-over'],
      diagram: diagram(
        'Wing edge to the body edge',
        poly(50, 14, 77.8, 81.2, 77.8, 86, 50, 86),
        valley(50, 14, 64.3, 86),
        arrow(72, 74, 56, 74),
        label(50, 93, 'body'),
      ),
      checkpoints: ['Both wings are the same size', 'The body left beside the wing is a thin strip, widest at the tail'],
      commonMistakes: ['Folding the wings to different lines, which makes the plane roll'],
      durationSeconds: 40,
    }),
    step({
      id: 'dart-6',
      ordinal: 6,
      title: 'Open the wings',
      instruction: 'Lift both wings out so they lie level, straight out from the body. Hold the body underneath and throw it gently forward.',
      operations: ['open', 'shape'],
      // Seen from above, to scale: 110 mm wingspan, 289 mm long (one unit is 3.8 mm).
      diagram: diagram('Wings out, seen from above', poly(50, 12, 64.5, 88, 35.5, 88), line(50, 12, 50, 88), label(34, 95, 'seen from above')),
      checkpoints: ['The wings are level, not drooping', 'Seen from behind, the plane makes a T shape'],
      durationSeconds: 20,
    }),
  ],
  preview: diagram('The finished dart, seen from above', poly(50, 12, 64.5, 88, 35.5, 88), line(50, 12, 50, 88)),
  tips: ['If it dives, bend the back edge of both wings up a little. If it climbs and stalls, bend them down.'],
  tags: ['beginner', 'quick', 'flies', 'no-tools', 'no-glue', 'one-sheet', 'letter'],
  provenance: seedProvenance('Traditional paper dart, public domain', 'Public domain'),
  foldSequence: DART_FOLD_SEQUENCE,
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
