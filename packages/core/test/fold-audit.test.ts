import { describe, expect, it } from 'vitest'
import { FOLD_KINDS, runFoldSequence } from '@origami/fold'
import { FOLD_KIND_OPERATIONS, type Model, OPERATIONS, auditFoldSequence, auditLibrary, getModel } from '../src'

const crane = getModel('origami-crane')!

describe('grounded check: the folds a Step does are the folds it declares', () => {
  it('maps every engine fold kind to an Operation', () => {
    for (const kind of FOLD_KINDS) expect(OPERATIONS, kind).toContain(FOLD_KIND_OPERATIONS[kind])
  })

  it('the crane passes: every fold the engine sees is declared on its Step', () => {
    expect(auditFoldSequence(crane)).toEqual([])
  })

  it('a crane with petal-fold removed from Step 9 fails, naming the Model, the Step and the fold kind', () => {
    const broken: Model = {
      ...crane,
      steps: crane.steps.map((s) => (s.id === 'crane-9' ? { ...s, operations: s.operations.filter((o) => o !== 'petal-fold') } : s)),
    }
    const errors = auditLibrary([broken]).issues.filter((issue) => issue.severity === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ modelId: 'origami-crane' })
    expect(errors[0]!.message).toContain('origami-crane')
    expect(errors[0]!.message).toContain('crane-9')
    expect(errors[0]!.message).toContain('petal')
    expect(errors[0]!.message).toContain('"petal-fold"')
  })

  it('a reverse fold must be declared as reverse-fold', () => {
    const broken: Model = {
      ...crane,
      steps: crane.steps.map((s) => (s.id === 'crane-12' ? { ...s, operations: s.operations.filter((o) => o !== 'reverse-fold') } : s)),
    }
    const messages = auditFoldSequence(broken).map((issue) => issue.message)
    expect(messages).toEqual([expect.stringContaining('inside-reverse')])
  })

  it('timing: checking the whole crane takes under 2 seconds', () => {
    const start = performance.now()
    const result = runFoldSequence(crane.foldSequence!)
    const ms = performance.now() - start
    console.log(`Checking the whole crane (${result.ok ? result.steps.length : 0} Steps) took ${ms.toFixed(0)} ms.`)
    expect(result.ok).toBe(true)
    expect(ms).toBeLessThan(2000)
  })
})
