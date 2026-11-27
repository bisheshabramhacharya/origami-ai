import { describe, expect, it } from 'vitest'
import { type FoldSequenceInput, runFoldSequence } from '@origami/fold'
import { AUTHORING_MAX_TRIES, type AuthoringPrompt, type AuthoringProvider, authorFoldSequence } from '../src'
import { CRANE_FOLD_SEQUENCE } from '../src/data/crane-folds'

const reference = 'Crane, Steps 1 to 5: fold both diagonals, turn over, fold in half both ways, collapse into a square base.'

/** The crane's own Steps 1 to 5: the fixed draft. */
const fixed: FoldSequenceInput = { paper: CRANE_FOLD_SEQUENCE.paper, steps: structuredClone(CRANE_FOLD_SEQUENCE.steps.slice(0, 5)) }

/** The same, with one fold in Step 2 that brings a point that is under the top layer. */
function withHiddenPoint(): FoldSequenceInput {
  const draft = structuredClone(fixed)
  const step2 = draft.steps[1]!
  step2.actions = [
    step2.actions[0]!,
    { kind: 'valley', name: 'x', line: { bring: { along: ['D', 'O'], fraction: 0.5 }, to: 'A' } },
    { kind: 'unfold', creases: ['x'] },
    ...step2.actions.slice(1),
  ]
  return draft
}

/** A provider that gives the scripted replies in order and keeps every prompt it was given. */
function scripted(replies: string[]): AuthoringProvider & { prompts: AuthoringPrompt[] } {
  const prompts: AuthoringPrompt[] = []
  return {
    prompts,
    async draft(prompt) {
      prompts.push(prompt)
      const reply = replies[Math.min(prompts.length - 1, replies.length - 1)]
      if (reply === undefined) throw new Error('No scripted reply.')
      return reply
    },
  }
}

describe('authorFoldSequence: the offline authoring loop', () => {
  it('sends the exact engine error back and returns the fixed draft after 2 tries, marked needs-review', async () => {
    const broken = withHiddenPoint()
    const engineError = runFoldSequence(broken)
    expect(engineError.ok).toBe(false)
    if (engineError.ok) return
    expect(engineError.issue.message).toContain('is hidden under other layers')

    const provider = scripted([JSON.stringify(broken), '```json\n' + JSON.stringify(fixed, null, 2) + '\n```'])
    const result = await authorFoldSequence({ reference, provider })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tries).toBe(2)
    expect(result.status).toBe('needs-review')
    expect(result).not.toHaveProperty('validated')
    expect(result.draft).toEqual(fixed)

    // Try 1 has no error; try 2 holds the exact engine error from try 1, with its Step and action.
    expect(provider.prompts).toHaveLength(2)
    expect(provider.prompts[0]!.lastError).toBeNull()
    expect(provider.prompts[0]!.reference).toBe(reference)
    expect(provider.prompts[0]!.rules).toContain('fold language')
    const second = provider.prompts[1]!
    expect(second.attempt).toBe(2)
    expect(second.lastError).toContain(engineError.issue.message)
    expect(second.lastError).toContain('Step "crane-2"')
    expect(second.lastError).toContain('action 2')
    expect(second.lastError).toContain(JSON.stringify(broken))
  })

  it('counts a draft that fails the schema as a failed try, and sends the schema error back', async () => {
    const bad = { paper: { widthMm: 150, heightMm: 150 }, steps: [{ step: 'crane-2', actions: [{ kind: 'fold-in-half' }] }] }
    const provider = scripted([JSON.stringify(bad), 'this is not JSON', JSON.stringify(fixed)])
    const result = await authorFoldSequence({ reference, provider })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tries).toBe(3)
    expect(provider.prompts[1]!.lastError).toMatch(/fold-language schema/)
    expect(provider.prompts[1]!.lastError).toContain('steps.0.actions.0')
    expect(provider.prompts[2]!.lastError).toMatch(/not JSON/)
  })

  it('stops after the maximum number of tries and returns the last error, not a draft', async () => {
    const provider = scripted([JSON.stringify(withHiddenPoint())])
    const result = await authorFoldSequence({ reference, provider })
    expect(AUTHORING_MAX_TRIES).toBe(5)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.tries).toBe(5)
    expect(provider.prompts).toHaveLength(5)
    expect(result.lastError).toContain('is hidden under other layers')
    expect(result).not.toHaveProperty('draft')
  })

  it('takes a different maximum', async () => {
    const provider = scripted(['{}'])
    const result = await authorFoldSequence({ reference, provider, maxTries: 2 })
    expect(provider.prompts).toHaveLength(2)
    expect(result.ok).toBe(false)
  })

  it('stops at once when the provider itself fails: that is not a bad draft', async () => {
    let calls = 0
    const provider: AuthoringProvider = {
      async draft() {
        calls += 1
        throw new Error('The provider is down.')
      },
    }
    await expect(authorFoldSequence({ reference, provider })).rejects.toThrow('The provider is down.')
    expect(calls).toBe(1)
  })
})
