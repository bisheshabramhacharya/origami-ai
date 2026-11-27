import { describe, expect, it } from 'vitest'
import { type FoldSequenceInput, boundingBox, foldedPositionOf, runFoldSequence } from '@origami/fold'
import { DART_FOLD_SEQUENCE, DART_WING_DEGREES, DART_WING_LINE_DEGREES } from '../src/data/plane-folds'
import { type Model, SEED_LIBRARY, auditFoldSequence, finishedSizeLabel, auditModel, evaluateConstraints, findOptions, foldedStateForStep, getModel, parseBriefHeuristic, stepPlayback } from '../src'

const dart = () => getModel('paper-plane-dart')!

describe('the classic paper dart in the Library', () => {
  it('is a six-Step origami Model on one sheet of US Letter printer paper', () => {
    const model = dart()
    expect(model).toBeDefined()
    expect(model.technique).toBe('origami')
    expect(model.objectTags).toEqual(expect.arrayContaining(['plane', 'airplane', 'vehicle']))
    expect(model.paper).toMatchObject({ sheets: 1, shape: 'letter', weight: 'printer' })
    expect(model.steps.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5, 6])
    expect(model.tools).toEqual([])
    expect(model.adhesives).toEqual([])
    expect(auditModel(model)).toEqual([])
  })

  it('is needs-review until a person folds it, so retrieval does not offer it and says why (ADR-0001)', () => {
    const model = dart()
    expect(model.validation.status).toBe('needs-review')
    const brief = parseBriefHeuristic('paper airplane')
    expect(findOptions(brief, SEED_LIBRARY).map((o) => o.model.id)).not.toContain('paper-plane-dart')
    const why = evaluateConstraints(model, brief)
    expect(why.excluded).toBe(true)
    expect(why.hard.join(' ')).toMatch(/not a validated/i)
  })

  it('once a person has folded it (validated), it comes first for a paper airplane', () => {
    const folded: Model = {
      ...dart(),
      validation: { status: 'validated', checkedBy: 'a person', checkedAt: '2026-11-28', checks: ['Folded end to end'], foldableByHand: true },
    }
    const library = SEED_LIBRARY.map((m) => (m.id === folded.id ? folded : m))
    for (const request of ['paper airplane', 'a plane for my kid']) {
      const options = findOptions(parseBriefHeuristic(request), library)
      expect(options[0]?.model.id, request).toBe('paper-plane-dart')
    }
  })
})

describe("the dart's fold sequence", () => {
  it('passes the engine and the grounded check for all 6 Steps', () => {
    const model = dart()
    expect(auditFoldSequence(model)).toEqual([])
    expect(model.foldSequence!.steps.map((s) => s.step)).toEqual(model.steps.map((s) => s.id))
    for (const id of model.steps.map((s) => s.id)) {
      expect(foldedStateForStep(model, id), id).not.toBeNull()
      const playback = stepPlayback(model, id)
      expect(playback?.motions.length, id).toBeGreaterThan(0)
    }
  })

  it('fails the grounded check when Step 4 does not declare its mountain fold', () => {
    const model = dart()
    const broken: Model = { ...model, steps: model.steps.map((s) => (s.id === 'dart-4' ? { ...s, operations: ['press-flat'] } : s)) }
    const messages = auditFoldSequence(broken).map((issue) => issue.message)
    expect(messages).toEqual([expect.stringContaining('"mountain-fold"')])
  })
})

describe('the finished dart: wings open', () => {
  const W = 215.9
  const H = 279.4
  const t = (DART_WING_LINE_DEGREES * Math.PI) / 180
  const finished = (scale = 1) => {
    const sequence: FoldSequenceInput = { ...DART_FOLD_SEQUENCE, paper: { widthMm: W * scale, heightMm: H * scale } }
    const result = runFoldSequence(sequence)
    if (!result.ok) throw new Error(result.issue.message)
    return result.final
  }

  it('opens both wings to the angle the sequence sets, level and symmetric, one each side of the body', () => {
    const state = finished()
    const p = (name: string) => foldedPositionOf(state, state.points[name]!)!
    const front = p('C')
    const back = p('D')
    expect(front.x).toBeCloseTo(back.x, 6)
    expect(front.y).toBeCloseTo(back.y, 6)
    expect(front.z).toBeCloseTo(-back.z, 6)
    expect(Math.abs(front.z)).toBeGreaterThan(1)
    for (const name of ['w1', 'w2']) {
      const hinges = state.edges.filter((e) => e.creases.includes(name))
      expect(hinges.length, name).toBeGreaterThan(0)
      for (const e of hinges) expect(Math.abs(e.foldAngle), name).toBeCloseTo(DART_WING_DEGREES, 9)
    }
    expect(DART_WING_DEGREES).toBe(90)
  })

  it('has the length and wingspan worked by hand, and they scale with the sheet', () => {
    // Wingspan: the farthest wing point from its hinge is where the second fold meets the side edge,
    // W/2 across and (W/2) / tan 22.5° down from the nose. At 90° it stands that far out on each side.
    const reach = (W / 2) * (Math.cos(t) - Math.sin(t) / Math.tan((22.5 * Math.PI) / 180))
    // Length: the tail corner of each wing, at 90°, sits over its foot on the hinge line, which runs
    // ((W/2) sin t + H cos t) from the nose; down the body that is that times cos t.
    const length = ((W / 2) * Math.sin(t) + H * Math.cos(t)) * Math.cos(t)
    const box = boundingBox(finished())
    expect(box.depthMm).toBeCloseTo(2 * reach, 6)
    expect(box.heightMm).toBeCloseTo(length, 6)
    const model = dart()
    expect(model.finishedSize).toMatchObject({ fromSheetMm: H })
    expect(model.finishedSize!.widthMm).toBeCloseTo(box.depthMm, 2)
    expect(model.finishedSize!.lengthMm).toBeCloseTo(box.heightMm, 2)
    expect(model.finishedSize!.heightMm).toBeCloseTo(box.widthMm, 2)
    for (const scale of [0.5, 2]) {
      const other = boundingBox(finished(scale))
      expect(other.depthMm, `${scale}`).toBeCloseTo(box.depthMm * scale, 6)
      expect(other.heightMm, `${scale}`).toBeCloseTo(box.heightMm * scale, 6)
      expect(other.widthMm, `${scale}`).toBeCloseTo(box.widthMm * scale, 6)
    }
    expect(finishedSizeLabel(model)).toBe('About 11 cm wide from a US Letter (8.5in x 11in) sheet')
    expect(finishedSizeLabel(model, 2 * H)).toBe('About 22 cm wide from a sheet 55.9 cm long')
  })
})
