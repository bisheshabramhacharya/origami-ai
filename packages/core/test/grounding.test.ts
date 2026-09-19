import { describe, expect, it } from 'vitest'
import {
  checkGrounding,
  describeOperations,
  expandImplied,
  extractOperations,
  getModel,
  modelOperations,
  stepOperations,
} from '../src'

const heart = getModel('origami-heart')!
const bird = getModel('papercraft-bird')!

describe('the grounding guard', () => {
  it('allows anything a step of the model actually does', () => {
    const report = checkGrounding('Valley fold the top corner to the centre, then press flat.', heart)
    expect(report.ok).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('allows a plain fold when the model already makes named folds', () => {
    expect(checkGrounding('Fold the corner over.', heart).ok).toBe(true)
  })

  it('rejects an invented fold that no step in the model performs', () => {
    const report = checkGrounding('Now make a squash fold to flatten the flap.', heart)
    expect(report.ok).toBe(false)
    expect(report.violations.map((violation) => violation.operation)).toContain('squash-fold')
    expect(report.violations[0]?.message).toContain(heart.title)
  })

  it('rejects a petal fold on a model that never uses one', () => {
    const report = checkGrounding('Lift the flap and petal fold it upward.', heart)
    expect(report.ok).toBe(false)
    expect(report.violations.some((violation) => violation.operation === 'petal-fold')).toBe(true)
  })

  it('rejects telling someone to cut a model that is fold only', () => {
    const report = checkGrounding('Carefully cut along the centre line.', heart)
    expect(report.ok).toBe(false)
    expect(report.violations.some((violation) => violation.operation === 'cut')).toBe(true)
  })

  it('rejects telling someone to glue a model that uses no adhesive', () => {
    const report = checkGrounding('Glue the flap down and hold it.', heart)
    expect(report.ok).toBe(false)
    expect(report.violations.some((violation) => violation.operation === 'glue')).toBe(true)
  })

  it('allows cutting and gluing on a model that genuinely does both', () => {
    const report = checkGrounding('Cut out the wing panel, score the line, then glue the tab into the slot.', bird)
    expect(report.ok).toBe(true)
  })

  it('names the operations the model is allowed to use', () => {
    const report = checkGrounding('fold', heart)
    expect(report.allowedOperations).toContain('valley-fold')
    expect(report.allowedOperations).not.toContain('squash-fold')
  })

  it('reports what was mentioned as well as what was wrong', () => {
    const report = checkGrounding('Fold and then squash fold.', heart)
    expect(report.mentionedOperations).toContain('fold')
    expect(report.mentionedOperations).toContain('squash-fold')
  })

  it('does not flag the same operation twice', () => {
    const report = checkGrounding('Squash fold it. Squash fold the other side too.', heart)
    expect(report.violations.filter((violation) => violation.operation === 'squash-fold').length).toBe(1)
  })
})

describe('operation vocabulary', () => {
  it('treats a plain fold as implied by any named fold', () => {
    expect(expandImplied(['valley-fold'])).toContain('fold')
    expect(expandImplied(['reverse-fold'])).toContain('fold')
    expect(expandImplied(['glue'])).not.toContain('fold')
  })

  it('treats unfold as a fold too', () => {
    expect(expandImplied(['unfold'])).toContain('fold')
  })

  it('collects operations across a whole model', () => {
    const operations = modelOperations(bird)
    expect(operations).toContain('cut')
    expect(operations).toContain('glue')
  })

  it('describes a step in words a person can read', () => {
    const step = bird.steps[0]!
    expect(describeOperations(stepOperations(step))).toContain('print')
  })

  it('finds the operations in a sentence without duplicates', () => {
    const found = extractOperations('Fold the corner, then fold the other corner, then unfold.')
    expect(found.map((entry) => entry.operation).sort()).toEqual(['fold', 'unfold'])
  })
})
