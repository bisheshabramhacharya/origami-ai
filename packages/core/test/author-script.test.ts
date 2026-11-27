// Tests for the offline author script in apps/api/scripts. They live here because the root `pnpm test`
// runs this package's tests, and the script has no test runner of its own. No test calls a real LLM.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { AuthoringProvider, AuthoringResult } from '../src'
import { CRANE_FOLD_SEQUENCE } from '../src/data/crane-folds'

// Loaded by path, so this package's typecheck stays inside the package; apps/api typechecks the script.
interface AuthorScript {
  SEED_LIBRARY_DIR: string
  authorToFile(options: { reference: string; out: string; provider: AuthoringProvider; force?: boolean; maxTries?: number }): Promise<AuthoringResult>
  fromWhereRun(path: string, env?: Record<string, string | undefined>): string
  isInside(dir: string, path: string, caseInsensitive?: boolean): boolean
  providerFromEnv(env?: Record<string, string | undefined>): AuthoringProvider
}
const scriptPath = new URL('../../../apps/api/scripts/author-fold-sequence.ts', import.meta.url).pathname
const { SEED_LIBRARY_DIR, authorToFile, fromWhereRun, isInside, providerFromEnv } = (await import(scriptPath)) as AuthorScript

const work = mkdtempSync(join(tmpdir(), 'author-script-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

const fixed = { paper: CRANE_FOLD_SEQUENCE.paper, steps: CRANE_FOLD_SEQUENCE.steps.slice(0, 5) }
const provider = { draft: async () => JSON.stringify(fixed) }

describe('the author script', () => {
  it('finds a path into the seed Library through a symlink, and with other letter case where the disk ignores case', () => {
    const link = join(work, 'lnk')
    symlinkSync(join(SEED_LIBRARY_DIR, 'data'), link)
    expect(isInside(SEED_LIBRARY_DIR, join(link, 'new-model.ts'))).toBe(true)
    expect(isInside(SEED_LIBRARY_DIR, join(work, 'draft.json'))).toBe(false)
    const shouted = SEED_LIBRARY_DIR.replace('core', 'Core')
    expect(isInside(SEED_LIBRARY_DIR, join(shouted, 'data', 'x.ts'), true)).toBe(true)
  })

  it('refuses to write into the seed Library, by a plain path or a symlink, before it asks the provider', async () => {
    let asked = 0
    const counting = { draft: async () => (asked++, JSON.stringify(fixed)) }
    await expect(authorToFile({ reference: 'x', out: join(SEED_LIBRARY_DIR, 'data', 'new.json'), provider: counting })).rejects.toThrow(/seed Library/)
    await expect(authorToFile({ reference: 'x', out: join(work, 'lnk', 'new.json'), provider: counting })).rejects.toThrow(/seed Library/)
    expect(asked).toBe(0)
    expect(existsSync(join(SEED_LIBRARY_DIR, 'data', 'new.json'))).toBe(false)
  })

  it('writes the draft to the named file, marked needs-review and never validated', async () => {
    const out = join(work, 'drafts', 'crane.json')
    const result = await authorToFile({ reference: 'Crane Steps 1 to 5', out, provider })
    expect(result.ok).toBe(true)
    const file = JSON.parse(readFileSync(out, 'utf8'))
    expect(file).toMatchObject({ status: 'needs-review', reference: 'Crane Steps 1 to 5', tries: 1 })
    expect(JSON.stringify(file)).not.toMatch(/"validated"/)
    expect(file.foldSequence).toEqual(fixed)
  })

  it('does not replace a file without --force, even one made while the loop ran', async () => {
    const out = join(work, 'exists.json')
    writeFileSync(out, 'keep me')
    await expect(authorToFile({ reference: 'x', out, provider })).rejects.toThrow(/--force/)
    expect(readFileSync(out, 'utf8')).toBe('keep me')

    const late = join(work, 'late.json')
    const racing = { draft: async () => (writeFileSync(late, 'made meanwhile'), JSON.stringify(fixed)) }
    await expect(authorToFile({ reference: 'x', out: late, provider: racing })).rejects.toThrow(/EEXIST/)
    expect(readFileSync(late, 'utf8')).toBe('made meanwhile')

    await authorToFile({ reference: 'x', out, provider, force: true })
    expect(JSON.parse(readFileSync(out, 'utf8')).status).toBe('needs-review')
  })

  it('writes nothing when the loop finds no draft', async () => {
    const out = join(work, 'none.json')
    const result = await authorToFile({ reference: 'x', out, provider: { draft: async () => '{}' }, maxTries: 2 })
    expect(result.ok).toBe(false)
    expect(existsSync(out)).toBe(false)
  })

  it('calls a real LLM only when ORIGAMI_AUTHORING_PROVIDER=anthropic and a key are set', () => {
    const key = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      expect(() => providerFromEnv({})).toThrow(/ORIGAMI_AUTHORING_PROVIDER=anthropic/)
      expect(() => providerFromEnv({ ORIGAMI_AUTHORING_PROVIDER: 'openai' })).toThrow(/ORIGAMI_AUTHORING_PROVIDER=anthropic/)
      expect(() => providerFromEnv({ ORIGAMI_AUTHORING_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/)
    } finally {
      if (key !== undefined) process.env.ANTHROPIC_API_KEY = key
    }
  })

  it('reads paths from the folder the author ran pnpm in', () => {
    mkdirSync(join(work, 'here'), { recursive: true })
    expect(fromWhereRun('drafts/a.json', { INIT_CWD: join(work, 'here') })).toBe(join(work, 'here', 'drafts', 'a.json'))
  })
})
