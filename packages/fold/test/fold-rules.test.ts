import { describe, expect, it } from 'vitest'
import { type FoldSequenceInput, foldSequence, fromFold, runFoldSequence, toFold } from '../src'
import { foldedPositionOf } from '../src/state'

const kami = { widthMm: 150, heightMm: 150 }
const seq = (...steps: FoldSequenceInput['steps']): FoldSequenceInput => ({ paper: kami, steps })

describe('fold rules found in review', () => {
  it('bringing an edge onto a parallel line folds halfway between them', () => {
    const { final } = foldSequence(
      seq({
        step: '1',
        actions: [
          { kind: 'valley', name: 'h', line: { bring: 'A', to: 'D' } },
          { kind: 'unfold', creases: ['h'] },
          { kind: 'valley', name: 'e', line: { bringEdge: ['A', 'B'], to: { crease: 'h' } } },
        ],
      }),
    )
    // The top edge (y = 150) comes down onto h (y = 75), so the crease is at y = 112.5.
    const a = foldedPositionOf(final, final.points.A!)!
    const b = foldedPositionOf(final, final.points.B!)!
    expect(a.y).toBeCloseTo(75, 6)
    expect(b.y).toBeCloseTo(75, 6)
    const e = final.edges.find((edge) => edge.creases.includes('e'))!
    expect(final.vertices[e.vertices[0]]!.y).toBeCloseTo(112.5, 6)
  })

  it('"top" moves the top layer of those that carry the brought point, not whatever lies over it', () => {
    // After a book fold, D is on the bottom layer under A. Lifting D toward the viewer would pass through A's layer.
    const result = runFoldSequence(
      seq({
        step: '1',
        actions: [
          { kind: 'valley', name: 'h', line: { bring: 'A', to: 'D' } },
          { kind: 'valley', name: 'x', line: { bring: 'D', to: 'DA' }, layers: 'top' },
        ],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issue).toMatchObject({ action: 2, check: 'layers' })
  })

  it('unfolding a crease by name does not open a later fold on the same line', () => {
    const steps = (unfoldName: string) =>
      seq({
        step: '1',
        actions: [
          { kind: 'valley', name: 'd1', line: { bring: 'B', to: 'D' } },
          { kind: 'unfold', creases: ['d1'] },
          { kind: 'valley', name: 'd3', line: { crease: 'd1' }, moving: 'B' },
          { kind: 'unfold', creases: [unfoldName] },
        ],
      })
    const wrong = runFoldSequence(steps('d1'))
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) {
      expect(wrong.issue).toMatchObject({ action: 4, check: 'references' })
      expect(wrong.issue.message).toContain('not folded now')
    }
    expect(runFoldSequence(steps('d3')).ok).toBe(true)
  })

  it('reads the layer order of a FOLD file from another tool, which has no origami fields', () => {
    const { final } = foldSequence(
      seq({ step: '1', actions: [{ kind: 'valley', name: 'd2', line: { bring: 'A', to: 'C' } }, { kind: 'turn-over' }] }),
    )
    const file = JSON.parse(JSON.stringify(toFold(final)))
    delete file['origami:faceSides']
    expect(fromFold(file).above).toEqual(final.above)
    expect(fromFold(file).faceSides).toEqual(final.faceSides)
  })
})
