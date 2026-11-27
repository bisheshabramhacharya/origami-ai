import { type FoldSequenceInput, FoldSequenceSchema, runFoldSequence } from '@origami/fold'

/**
 * The offline authoring loop (ticket 09, ADR-0001). A Library author gives a reference, for example
 * a Model's Step text. A provider (an LLM, or a scripted fake in tests) drafts a fold sequence in the
 * fold language. The engine checks it, and the exact error of the first failed fold goes back to the
 * provider for the next try. A draft that passes is only ever `needs-review`: a person folds it
 * before it can reach a learner. Nothing here runs in the web app or in an API request.
 */

export const AUTHORING_MAX_TRIES = 5

export interface AuthoringPrompt {
  /** The reference the author gave, as is. */
  reference: string
  /** The fold-language rules the draft must follow. */
  rules: string
  /** The error of the last try, with the draft it was about. Null on the first try. */
  lastError: string | null
  /** 1 for the first try. */
  attempt: number
}

export interface AuthoringProvider {
  /** Returns fold-language JSON (it may be in a ```json fence). Throws when the provider itself fails. */
  draft(prompt: AuthoringPrompt): Promise<string>
}

export type AuthoringResult =
  /** The draft is the JSON as the provider wrote it (without the schema's defaults filled in). */
  | { ok: true; status: 'needs-review'; draft: FoldSequenceInput; tries: number }
  | { ok: false; tries: number; lastError: string }

export const FOLD_LANGUAGE_RULES = `Write one fold sequence in the fold language, as JSON only: {"paper": {"widthMm", "heightMm"}, "steps": [{"step", "actions": [...], "note"?}]}.
Points and lines are named, never raw coordinates. Start names: corners A (top left), B (top right), C (bottom right), D (bottom left), coloured side up; edge midpoints AB, BC, CD, DA; the centre O.
A point is a name, {"intersect": [line, line]}, or {"along": [point, point], "fraction": 0..1} on the flat sheet. A line is {"crease": name} or {"through": [point, point]}.
Actions:
- {"kind": "valley" | "mountain", "name"?, "line", "layers"?: "all" | "top" | {"flap": point}, "moving"?: point, "degrees"?: 0..180}. The line is {"bring": point, "to": point}, {"through": [point, point]}, {"bringEdge": [point, point], "to": line}, {"crease": name} or {"pivot": point, "angleDeg": number}.
- {"kind": "unfold", "last": n} or {"kind": "unfold", "creases": [names]}.
- {"kind": "turn-over", "axis"?: "vertical" | "horizontal"} and {"kind": "rotate", "degrees": number}.
- {"kind": "collapse" | "squash" | "petal", "set": [{"crease", "assignment": "V" | "M" | "F", "from"?, "to"?}], "keep"?: point}.
- {"kind": "inside-reverse" | "outside-reverse", "name"?, "line", "flap": point, "moving"?: point}.
- {"kind": "open", "creases": [names], "degrees": 0..180}: 0 is the open sheet and 180 is folded flat.
Every action may have a short "note". A point that a fold brings must not be hidden under other layers. Name each crease you will use again.`

function stripFence(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  return (fenced ? fenced[1]! : text).trim()
}

/** Ask, check, feed back, and try again, up to `maxTries` times. */
export async function authorFoldSequence(options: {
  reference: string
  provider: AuthoringProvider
  maxTries?: number
}): Promise<AuthoringResult> {
  const maxTries = options.maxTries ?? AUTHORING_MAX_TRIES
  if (!Number.isInteger(maxTries) || maxTries < 1) throw new RangeError(`maxTries must be a whole number of 1 or more, not ${maxTries}.`)
  let lastError: string | null = null
  for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    const reply = await options.provider.draft({ reference: options.reference, rules: FOLD_LANGUAGE_RULES, lastError, attempt })
    const text = stripFence(reply)
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch (error) {
      lastError = `Try ${attempt}: the reply is not JSON (${(error as Error).message}). Reply with the fold sequence as JSON only.`
      continue
    }
    const parsed = FoldSequenceSchema.safeParse(json)
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `- ${issue.path.join('.') || 'sequence'}: ${issue.message}`)
        .join('\n')
      lastError = `Try ${attempt}: the draft does not fit the fold-language schema.\n${issues}\nThe draft was:\n${text}`
      continue
    }
    const run = runFoldSequence(parsed.data)
    if (!run.ok) {
      const where = [run.issue.step ? `Step "${run.issue.step}"` : null, run.issue.action ? `action ${run.issue.action}` : null]
        .filter(Boolean)
        .join(', ')
      lastError = `Try ${attempt}: the engine stopped at ${where || 'the sequence'} with a ${run.issue.check} error: ${run.issue.message}\nThe draft was:\n${JSON.stringify(json)}`
      continue
    }
    return { ok: true, status: 'needs-review', draft: json as FoldSequenceInput, tries: attempt }
  }
  return { ok: false, tries: maxTries, lastError: lastError ?? 'No tries were made.' }
}
