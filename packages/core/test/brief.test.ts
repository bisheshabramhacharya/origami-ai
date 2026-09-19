import { describe, expect, it } from 'vitest'
import { extractObject, objectTagsFor, parseBriefHeuristic, parseConstraints } from '../src'

describe('reading the object out of a request', () => {
  it('pulls the object out of the headline example', () => {
    const brief = parseBriefHeuristic('I want to make a bird. I am a beginner and only have printer paper.')
    expect(brief.objectLabel).toBe('bird')
  })

  it('handles a range of phrasings', () => {
    expect(extractObject('make me a paper crane')).toContain('crane')
    expect(extractObject('I want to build a gift box')).toContain('box')
    expect(extractObject('fold a jumping frog out of paper')).toContain('frog')
  })

  it('attaches useful tags, not just the bare noun', () => {
    const tags = objectTagsFor('bird')
    expect(tags).toContain('bird')
    expect(tags).toContain('animal')
  })

  it('falls back gracefully when the request is vague', () => {
    const brief = parseBriefHeuristic('something nice please')
    expect(brief.objectLabel.length).toBeGreaterThan(0)
    expect(brief.confidence).toBeLessThan(0.9)
  })
})

describe('reading constraints', () => {
  it('reads beginner level as a difficulty ceiling', () => {
    expect(parseConstraints('i am a beginner').constraints.difficultyMax).toBe(2)
    expect(parseConstraints('i am an expert').constraints.difficultyMax).toBe(5)
  })

  it('reads a time budget in minutes and hours', () => {
    expect(parseConstraints('i have 10 minutes').constraints.timeMinutesMax).toBe(10)
    expect(parseConstraints('i have 2 hours').constraints.timeMinutesMax).toBe(120)
    expect(parseConstraints('something under 30 mins').constraints.timeMinutesMax).toBe(30)
  })

  it('reads the paper someone actually has', () => {
    expect(parseConstraints('i only have printer paper').constraints.paperWeights).toContain('printer')
    expect(parseConstraints('i have cardstock').constraints.paperWeights).toContain('cardstock')
    expect(parseConstraints('using origami paper').constraints.paperWeights).toContain('kami')
  })

  it('reads refusals of scissors, glue and printers', () => {
    const noScissors = parseConstraints('no scissors please').constraints
    expect(noScissors.noScissors).toBe(true)

    const noGlue = parseConstraints('i dont have glue').constraints
    expect(noGlue.noGlue).toBe(true)

    const noPrinter = parseConstraints('without a printer').constraints
    expect(noPrinter.noPrinter).toBe(true)
  })

  it('reads a sheet limit', () => {
    expect(parseConstraints('i only have one sheet').constraints.sheetsMax).toBe(1)
    expect(parseConstraints('using 3 sheets').constraints.sheetsMax).toBe(3)
  })

  it('does not mistake a mention of scissors for a refusal', () => {
    expect(parseConstraints('scissors are fine').constraints.noScissors).toBe(false)
  })

  it('flags requests it genuinely cannot serve instead of pretending', () => {
    const { unparsed } = parseConstraints('i want a waterproof bird')
    expect(unparsed).toContain('waterproof')
  })

  it('writes down its assumptions so the user can correct them', () => {
    const { notes } = parseConstraints('make me a bird')
    expect(notes.length).toBeGreaterThan(0)
  })
})

describe('the whole brief', () => {
  it('parses the headline example into something the ranker can use', () => {
    const brief = parseBriefHeuristic('I want to make a bird. I am a beginner and only have printer paper.')
    expect(brief.objectTags).toContain('bird')
    expect(brief.constraints.difficultyMax).toBe(2)
    expect(brief.constraints.paperWeights).toContain('printer')
    expect(brief.source).toBe('heuristic')
  })

  it('records its own confidence rather than always claiming certainty', () => {
    const vague = parseBriefHeuristic('a thing')
    const clear = parseBriefHeuristic('make me a beginner crane from printer paper in 10 minutes')
    expect(clear.confidence).toBeGreaterThan(vague.confidence)
  })
})
