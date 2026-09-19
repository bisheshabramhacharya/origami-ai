import { describe, expect, it } from 'vitest'
import {
  SEED_LIBRARY,
  evaluateConstraints,
  findOptions,
  getModel,
  mergeBrief,
  parseBriefHeuristic,
  paperCompatible,
  techniqueCoverage,
} from '../src'

const BIRD_IDS = ['folded-bird-easy', 'origami-crane', 'flapping-bird', 'standing-cut-and-fold-bird', 'papercraft-bird']

function permissiveBirdBrief() {
  const brief = parseBriefHeuristic('make me a bird')
  return mergeBrief(brief, {
    constraints: {
      ...brief.constraints,
      difficultyMax: 5,
      timeMinutesMax: 180,
      sheetsMax: 8,
      paperWeights: [],
      techniquesAllowed: [],
      techniquesExcluded: [],
    },
  })
}

describe('the README example', () => {
  it('returns every realistic way to make a bird when nothing is ruled out', () => {
    const options = findOptions(permissiveBirdBrief(), SEED_LIBRARY, { limit: 5 })
    expect(options.map((option) => option.model.id).sort()).toEqual([...BIRD_IDS].sort())
  })

  it('ranks all five bird builds above everything else in the library', () => {
    const options = findOptions(permissiveBirdBrief(), SEED_LIBRARY)
    const topFive = options.slice(0, 5).map((option) => option.model.id)
    expect([...topFive].sort()).toEqual([...BIRD_IDS].sort())
  })

  it('offers multiple options rather than forcing one answer', () => {
    const options = findOptions(permissiveBirdBrief(), SEED_LIBRARY)
    expect(options.length).toBeGreaterThan(1)
    expect(techniqueCoverage(options).length).toBeGreaterThan(1)
  })

  it('puts the beginner option first for a beginner with printer paper', () => {
    const brief = parseBriefHeuristic('I want to make a bird. I am a beginner and only have printer paper.')
    const options = findOptions(brief, SEED_LIBRARY)

    expect(options.length).toBeGreaterThanOrEqual(3)
    expect(options[0]?.model.id).toBe('folded-bird-easy')
    expect(options[0]?.model.difficulty).toBeLessThanOrEqual(2)
  })

  it('explains why each option is where it is', () => {
    const brief = parseBriefHeuristic('I want to make a bird. I am a beginner and only have printer paper.')
    const options = findOptions(brief, SEED_LIBRARY)
    expect(options[0]?.reasons.length).toBeGreaterThan(0)
    expect(options.every((option) => option.score > 0)).toBe(true)
  })

  it('hides a build that clearly breaks a stated constraint rather than burying it in warnings', () => {
    const brief = parseBriefHeuristic('I want to make a bird. I am a beginner and only have printer paper.')
    const options = findOptions(brief, SEED_LIBRARY)
    expect(options.map((option) => option.model.id)).not.toContain('papercraft-bird')
  })

  it('still surfaces a model when only its paper advice is a mismatch, and says so', () => {
    const brief = parseBriefHeuristic('i want to make a bird and i only have printer paper')
    const crane = findOptions(brief, SEED_LIBRARY).find((option) => option.model.id === 'origami-crane')

    expect(crane).toBeDefined()
    expect(crane?.warnings.join(' ').toLowerCase()).toContain('kami')
  })
})

describe('respecting what the user refuses', () => {
  it('drops anything needing scissors when scissors are off the table', () => {
    const brief = parseBriefHeuristic('make me a bird with no scissors')
    const options = findOptions(brief, SEED_LIBRARY)

    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      expect(option.model.tools, option.model.id).not.toContain('scissors')
      expect(option.model.tools, option.model.id).not.toContain('craft-knife')
    }
  })

  it('drops anything needing glue when the user has none', () => {
    const brief = parseBriefHeuristic('make me a bird but i have no glue')
    const options = findOptions(brief, SEED_LIBRARY)

    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      expect(option.model.adhesives, option.model.id).toEqual([])
    }
  })

  it('honours a one-sheet, no-tools, no-glue request', () => {
    const brief = parseBriefHeuristic('make me a bird with one sheet, no scissors and no glue')
    const options = findOptions(brief, SEED_LIBRARY)

    expect(options.length).toBeGreaterThanOrEqual(3)
    for (const option of options) {
      expect(option.model.paper.sheets, option.model.id).toBe(1)
      expect(option.model.tools, option.model.id).toEqual([])
      expect(option.model.adhesives, option.model.id).toEqual([])
    }
  })

  it('never returns a model that has not been validated', () => {
    const crane = getModel('origami-crane')!
    const unvalidated = { ...crane, id: 'crane-draft', validation: { ...crane.validation, status: 'needs-review' as const } }
    const options = findOptions(permissiveBirdBrief(), [unvalidated, crane])
    expect(options.map((option) => option.model.id)).not.toContain('crane-draft')
  })

  it('says why a model is excluded rather than dropping it silently', () => {
    const brief = parseBriefHeuristic('make me a bird with no scissors')
    const result = evaluateConstraints(getModel('standing-cut-and-fold-bird')!, brief)
    expect(result.excluded).toBe(true)
    expect(result.hard.join(' ')).toContain('scissors')
  })
})

describe('ranking behaviour', () => {
  it('is deterministic, so the same request gives the same order twice', () => {
    const brief = parseBriefHeuristic('I want to make a bird. I am a beginner and only have printer paper.')
    const first = findOptions(brief, SEED_LIBRARY).map((option) => option.model.id)
    const second = findOptions(brief, SEED_LIBRARY).map((option) => option.model.id)
    expect(first).toEqual(second)
  })

  it('prefers models that fit the difficulty ceiling over ones that exceed it', () => {
    const brief = parseBriefHeuristic('i am a beginner and want a bird')
    const options = findOptions(brief, SEED_LIBRARY)
    const easy = options.findIndex((option) => option.model.id === 'folded-bird-easy')
    const hard = options.findIndex((option) => option.model.id === 'papercraft-bird')
    expect(easy).toBeGreaterThanOrEqual(0)
    expect(hard === -1 || easy < hard).toBe(true)
  })

  it('respects a short time budget', () => {
    const brief = parseBriefHeuristic('i need a bird in 6 minutes')
    const options = findOptions(brief, SEED_LIBRARY)
    expect(options[0]?.model.timeMinutes.max).toBeLessThanOrEqual(10)
  })

  it('knows which papers substitute for which', () => {
    expect(paperCompatible('printer', ['copy'])).toBe(true)
    expect(paperCompatible('printer', ['kami'])).toBe(true)
    expect(paperCompatible('kami', ['printer'])).toBe(false)
    expect(paperCompatible('cardstock', ['printer'])).toBe(false)
    expect(paperCompatible('cardstock', [])).toBe(true)
  })
})
