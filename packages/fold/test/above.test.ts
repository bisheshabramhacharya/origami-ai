import { describe, expect, it } from 'vitest'
import { type FoldSequenceInput, checkState, runFoldSequence } from '../src'
import { foldedPositionOf } from '../src/state'

// A 200 mm square. A top left, B top right, C bottom right, D bottom left.
const paper = { widthMm: 200, heightMm: 200 }
// A loose flap: the top edge folded down to y 40, so the flap lies over the sheet from y 40 to y 120.
const flap: FoldSequenceInput['steps'][number] = {
  step: 'flap',
  actions: [{ kind: 'valley', name: 'f', line: { bring: 'A', to: { along: ['D', 'A'], fraction: 0.2 } } }],
}
// Then a fold across the sheet at y 80 that moves the bottom edge.
const across = (kind: 'valley' | 'mountain', layers: 'top' | 'above'): FoldSequenceInput['steps'][number] => ({
  step: 'across',
  actions: [{ kind, name: 'x', line: { through: [{ along: ['D', 'A'], fraction: 0.4 }, { along: ['C', 'B'], fraction: 0.4 }] }, moving: 'D', layers }],
})
const run = (kind: 'valley' | 'mountain', layers: 'top' | 'above') => runFoldSequence({ paper, steps: [flap, across(kind, layers)] })
const yOfA = (result: ReturnType<typeof run>) => {
  if (!result.ok) throw new Error(result.issue.message)
  const state = result.steps.at(-1)!.state
  expect(checkState(state)).toEqual([])
  return foldedPositionOf(state, state.points.A!)!.y
}

describe("'above' takes the layers in the way of the fold, and only those", () => {
  it('valley fold: the flap over the moving paper is in the way, so it goes too', () => {
    expect(run('valley', 'top').ok).toBe(false)
    expect(yOfA(run('valley', 'above'))).toBeCloseTo(120, 6)
  })

  it('mountain fold: the paper turns down, so the flap over it is not in the way and stays in front', () => {
    expect(yOfA(run('mountain', 'top'))).toBeCloseTo(40, 6)
    expect(yOfA(run('mountain', 'above'))).toBeCloseTo(40, 6)
  })
})
