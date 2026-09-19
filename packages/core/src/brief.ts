import { BuildBriefSchema, type BuildBrief, type Constraints, type PaperWeight, type Technique } from './types'
import { normalizeTag } from './retrieval'

const STOPWORDS = new Set([
  'a', 'an', 'the', 'some', 'my', 'me', 'i', 'want', 'wanna', 'to', 'make', 'making', 'build', 'building',
  'create', 'creating', 'fold', 'folding', 'out', 'of', 'with', 'from', 'using', 'for', 'that', 'which',
  'please', 'can', 'you', 'help', 'it', 'is', 'are', 'and', 'or', 'only', 'have', 'has', 'just', 'like',
  'paper', 'please', 'something', 'this', 'that', 'into', 'in', 'on', 'at', 'am', 'beginner', 'beginner',
])

const OBJECT_SYNONYMS: Record<string, string[]> = {
  bird: ['bird', 'animal', 'crane', 'avian'],
  crane: ['crane', 'bird', 'animal'],
  swan: ['swan', 'bird', 'animal'],
  duck: ['duck', 'bird', 'animal'],
  owl: ['owl', 'bird', 'animal'],
  penguin: ['penguin', 'bird', 'animal'],
  chicken: ['chicken', 'bird', 'animal'],
  butterfly: ['butterfly', 'insect', 'animal'],
  frog: ['frog', 'animal', 'amphibian'],
  rabbit: ['rabbit', 'animal'],
  bunny: ['rabbit', 'animal'],
  cat: ['cat', 'animal'],
  dog: ['dog', 'animal'],
  fox: ['fox', 'animal'],
  fish: ['fish', 'animal'],
  whale: ['whale', 'animal'],
  boat: ['boat', 'vehicle', 'ship'],
  ship: ['boat', 'vehicle', 'ship'],
  plane: ['plane', 'vehicle', 'airplane'],
  airplane: ['plane', 'vehicle'],
  car: ['car', 'vehicle'],
  rocket: ['rocket', 'vehicle', 'space'],
  star: ['star', 'geometric', 'decoration'],
  box: ['box', 'container', 'packaging'],
  envelope: ['envelope', 'container', 'packaging'],
  flower: ['flower', 'plant', 'decoration'],
  rose: ['flower', 'plant', 'decoration'],
  tulip: ['flower', 'plant', 'decoration'],
  heart: ['heart', 'decoration', 'symbol'],
  hat: ['hat', 'wearable'],
  crown: ['crown', 'wearable', 'decoration'],
  bookmark: ['bookmark', 'useful'],
  lantern: ['lantern', 'decoration', 'light'],
  house: ['house', 'building', 'architecture'],
  dragon: ['dragon', 'creature', 'animal'],
  dinosaur: ['dinosaur', 'animal'],
  pumpkin: ['pumpkin', 'plant', 'decoration'],
  snowflake: ['snowflake', 'decoration', 'geometric'],
  pinwheel: ['pinwheel', 'toy'],
  spinner: ['spinner', 'toy'],
  ball: ['ball', 'toy', 'geometric'],
  cube: ['cube', 'geometric', 'container'],
  pyramid: ['pyramid', 'geometric'],
  mask: ['mask', 'wearable'],
  puppet: ['puppet', 'toy'],
  card: ['card', 'greeting', 'pop-up'],
  popup: ['pop-up', 'card', 'greeting'],
  finger: ['puppet', 'toy'],
  wallet: ['wallet', 'useful', 'container'],
  vase: ['vase', 'decoration', 'container'],
  cup: ['cup', 'useful', 'container'],
  sword: ['sword', 'toy'],
  gun: ['toy', 'toy'],
  chair: ['chair', 'furniture', 'paper-engineering'],
  robot: ['robot', 'toy'],
  unicorn: ['unicorn', 'creature', 'animal'],
  elephant: ['elephant', 'animal'],
  turtle: ['turtle', 'animal'],
  snake: ['snake', 'animal'],
  lion: ['lion', 'animal'],
  monkey: ['monkey', 'animal'],
  bear: ['bear', 'animal'],
  pig: ['pig', 'animal'],
  cow: ['cow', 'animal'],
  bee: ['bee', 'insect', 'animal'],
  spider: ['spider', 'animal'],
  flowerpot: ['flower', 'plant'],
  tree: ['tree', 'plant'],
  leaf: ['leaf', 'plant'],
  map: ['useful', 'prototype'],
  mobile: ['mobile', 'decoration'],
  garland: ['garland', 'decoration'],
  chain: ['chain', 'decoration'],
  fan: ['fan', 'useful'],
  umbrella: ['umbrella', 'useful'],
  straw: ['useful'],
  lampshade: ['lampshade', 'useful'],
  lampshadecraft: ['lampshade', 'useful'],
}

const TECHNIQUE_HINTS: Array<{ technique: Technique; pattern: RegExp }> = [
  { technique: 'kirigami', pattern: /\bkirigami\b/i },
  { technique: 'modular-origami', pattern: /\bmodular\b/i },
  { technique: 'printable-papercraft', pattern: /\b(printable|papercraft|paper craft|template)\b/i },
  { technique: 'paper-toy', pattern: /\bpaper ?toy\b/i },
  { technique: 'pop-up', pattern: /\b(pop-?up|pop up)\b/i },
  { technique: 'paper-engineering', pattern: /\b(paper engineering|mechanism|mechanical)\b/i },
  { technique: 'geometric', pattern: /\bgeometric\b/i },
  { technique: 'packaging', pattern: /\b(packaging|gift box|giftbox)\b/i },
  { technique: 'prototype', pattern: /\b(prototype|mock-?up|model of)\b/i },
  { technique: 'cut-and-fold', pattern: /\b(cut and fold|cut-and-fold|cut out|kirigami-?style)\b/i },
  { technique: 'origami', pattern: /\b(origami|folded)\b/i },
]

const PAPER_HINTS: Array<{ weight: PaperWeight; pattern: RegExp }> = [
  { weight: 'printer', pattern: /\b(printer paper|printer|copier paper|a4|letter paper|plain paper|normal paper|regular paper)\b/i },
  { weight: 'copy', pattern: /\b(copy paper)\b/i },
  { weight: 'cardstock', pattern: /\b(card ?stock|cardstock|thick paper|card)\b/i },
  { weight: 'kami', pattern: /\b(kami|origami paper|washi)\b/i },
  { weight: 'tissue-foil', pattern: /\b(tissue ?foil|foil paper)\b/i },
  { weight: 'kraft', pattern: /\b(kraft|brown paper)\b/i },
]

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function cleanPhrase(phrase: string): string {
  const kept = words(phrase).filter((word) => !STOPWORDS.has(word))
  return kept.slice(0, 3).join(' ').trim()
}

function isNegated(text: string, matchIndex: number): boolean {
  const clause = text.slice(Math.max(0, matchIndex - 40), matchIndex)
  return /\b(no|not|without|avoid|dont|don't|do not|never|skip)\b[^.,;]*$/.test(clause)
}

export function extractObject(rawText: string): string {
  const text = rawText.toLowerCase()

  const patterns: RegExp[] = [
    /(?:make|build|create|fold)\s+(?:me\s+)?(?:an?|the\s+)?([a-z][a-z\s-]{1,40}?)(?=\s+(?:out of|with|from|using|for|that|which|but|and i)\b|[.,!?]|$)/,
    /(?:want|wanna|like|need)\s+(?:to\s+)?(?:make|build|fold|create)?\s*(?:an?|the\s+)?([a-z][a-z\s-]{1,40}?)(?=\s+(?:out of|with|from|using|for|that|which|but)\b|[.,!?]|$)/,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match && match[1]) {
      const cleaned = cleanPhrase(match[1])
      if (cleaned.length >= 2) return cleaned
    }
  }

  const fallback = words(text).filter((word) => !STOPWORDS.has(word))
  const candidate = fallback.slice(0, 2).join(' ')
  return candidate || 'paper object'
}

export function objectTagsFor(label: string): string[] {
  const normalized = normalizeTag(label)
  const direct = OBJECT_SYNONYMS[normalized]
  const tags = new Set<string>([normalized])
  if (direct) {
    for (const tag of direct) tags.add(tag)
    return [...tags]
  }
  for (const [key, synonyms] of Object.entries(OBJECT_SYNONYMS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      for (const tag of synonyms) tags.add(tag)
      return [...tags]
    }
  }
  for (const word of normalized.split(/\s+/)) {
    if (OBJECT_SYNONYMS[word]) {
      for (const tag of OBJECT_SYNONYMS[word]) tags.add(tag)
    }
  }
  return [...tags]
}

interface ConstraintParse {
  constraints: Constraints
  notes: string[]
  unparsed: string[]
  signals: number
}

function defaultConstraints(): Constraints {
  return {
    difficultyMax: 3,
    timeMinutesMax: 60,
    sheetsMax: 8,
    noScissors: false,
    noGlue: false,
    noPrinter: false,
    paperWeights: [],
    techniquesAllowed: [],
    techniquesExcluded: [],
  }
}

function extractTime(text: string): number | undefined {
  const hourMatch = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i.exec(text)
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60)

  const rangeMatch = /(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:minutes?|mins?)\b/i.exec(text)
  if (rangeMatch) return Number(rangeMatch[2])

  const minuteMatch = /(\d+)\s*(?:minutes?|mins?)\b/i.exec(text)
  if (minuteMatch) return Number(minuteMatch[1])

  if (/\bquick\b|\bshort\b|\b5 min\b|\bfive minutes?\b/i.test(text)) return 15
  return undefined
}

export function parseConstraints(rawText: string): ConstraintParse {
  const text = rawText.toLowerCase()
  const constraints = defaultConstraints()
  const notes: string[] = []
  const unparsed: string[] = []
  let signals = 0

  if (/\b(never|no|without|dont|don't|do not|can't|cannot|have no|lost my)\b[^.,;]*\bscissors?\b/i.test(text) || /\bscissors?\b[^.,;]*\b(not|no|without)\b/i.test(text)) {
    constraints.noScissors = true
    signals += 1
  }
  if (/\b(no|without|dont|don't|do not|can't|cannot|have no)\b[^.,;]*\b(glue|tape|adhesive)\b/i.test(text)) {
    constraints.noGlue = true
    signals += 1
  }
  if (/\b(no|without|dont|don't|do not|can't|cannot|have no)\b[^.,;]*\b(printer|printing)\b/i.test(text)) {
    constraints.noPrinter = true
    signals += 1
  }

  if (/\b(beginner|beginner|new|newbie|first time|never (done|made)|simple|easy|kid|child|children|young)\b/i.test(text)) {
    constraints.difficultyMax = 2
    signals += 1
  }
  if (/\bvery (simple|easy)\b|\babsolute beginner\b|\btoddler\b/i.test(text)) {
    constraints.difficultyMax = 1
  }
  if (/\bintermediate\b|\bsome experience\b/i.test(text)) constraints.difficultyMax = 3
  if (/\badvanced\b|\bexpert\b|\bexperienced\b|\bchallenge\b|\bhard\b|\bcomplex\b/i.test(text)) constraints.difficultyMax = 5

  const time = extractTime(text)
  if (time !== undefined) {
    constraints.timeMinutesMax = time
    signals += 1
  }

  const paperWeights: PaperWeight[] = []
  for (const hint of PAPER_HINTS) {
    if (hint.pattern.test(text) && !paperWeights.includes(hint.weight)) paperWeights.push(hint.weight)
  }
  if (paperWeights.length > 0) {
    constraints.paperWeights = paperWeights
    signals += 1
  }

  const sheetWordMatch = /\b(one|two|three|four|five|single|1|2|3|4|5)\s*(?:sheet|sheets|piece|pieces|page|pages)\b/i.exec(text)
  if (sheetWordMatch) {
    const wordMap: Record<string, number> = { one: 1, single: 1, two: 2, three: 3, four: 4, five: 5 }
    const token = sheetWordMatch[1].toLowerCase()
    const numeric = Number(token)
    constraints.sheetsMax = wordMap[token] ?? (Number.isFinite(numeric) ? numeric : 1)
    signals += 1
  } else if (/\bsingle sheet\b|\bone sheet\b|\bonly one\b/i.test(text)) {
    constraints.sheetsMax = 1
    signals += 1
  }

  const techniquesAllowed: Technique[] = []
  const techniquesExcluded: Technique[] = []
  for (const hint of TECHNIQUE_HINTS) {
    const match = hint.pattern.exec(text)
    if (!match) continue
    signals += 1
    if (isNegated(text, match.index)) techniquesExcluded.push(hint.technique)
    else techniquesAllowed.push(hint.technique)
  }
  constraints.techniquesAllowed = techniquesAllowed
  constraints.techniquesExcluded = techniquesExcluded

  if (constraints.paperWeights.length === 0) {
    notes.push('No paper type mentioned, so any paper is assumed to be available.')
  }
  if (constraints.sheetsMax >= 8) {
    notes.push('No sheet limit mentioned, so up to 8 sheets are assumed.')
  }
  if (constraints.noScissors && constraints.noGlue) {
    notes.push('No scissors and no glue, so only pure folding models will be offered.')
  }

  const unknownRequirements = /\b(waterproof|fireproof|glow|glowing|magnetic|edible|electronic|moving|motor|battery)\b/i.exec(text)
  if (unknownRequirements) unparsed.push(unknownRequirements[0])

  return { constraints, notes, unparsed, signals }
}

export function parseBriefHeuristic(rawText: string): BuildBrief {
  const objectLabel = extractObject(rawText)
  const objectTags = objectTagsFor(objectLabel)
  const { constraints, notes, unparsed, signals } = parseConstraints(rawText)

  const confidence = Math.min(0.95, 0.35 + signals * 0.08)

  return BuildBriefSchema.parse({
    rawText,
    objectLabel,
    objectTags,
    constraints,
    notes,
    unparsed,
    confidence: Math.round(confidence * 100) / 100,
    source: 'heuristic',
  })
}

export function mergeBrief(base: BuildBrief, patch: Partial<BuildBrief>): BuildBrief {
  return BuildBriefSchema.parse({
    ...base,
    ...patch,
    constraints: { ...base.constraints, ...(patch.constraints ?? {}) },
  })
}
