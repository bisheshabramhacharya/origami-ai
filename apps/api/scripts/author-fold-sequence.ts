/**
 * Draft a fold sequence offline, checked by the engine (ticket 09, ADR-0001).
 *
 *   ORIGAMI_AUTHORING_PROVIDER=anthropic ANTHROPIC_API_KEY=... \
 *     pnpm --filter @origami/api author -- --reference steps.txt --out drafts/crane.json
 *
 * The draft goes to the file you name, marked `needs-review`. This script never writes into the
 * seed Library and never marks anything `validated`: a person folds the draft first.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type AuthoringPrompt, type AuthoringProvider, type AuthoringResult, authorFoldSequence } from '@origami/core'
import { callAnthropic, llmSettings } from '../src/llm'

const here = dirname(fileURLToPath(import.meta.url))
/** The seed Library. Drafts never go in here. */
export const SEED_LIBRARY_DIR = resolve(here, '../../../packages/core/src')

export function isInside(dir: string, path: string): boolean {
  const rel = relative(dir, resolve(path))
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel))
}

/** The real provider. Only used when ORIGAMI_AUTHORING_PROVIDER=anthropic and an API key are set. */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): AuthoringProvider {
  if (env.ORIGAMI_AUTHORING_PROVIDER !== 'anthropic') {
    throw new Error('No provider. Set ORIGAMI_AUTHORING_PROVIDER=anthropic (and ANTHROPIC_API_KEY) to call a real LLM.')
  }
  const settings = llmSettings()
  if (!settings) throw new Error('ORIGAMI_AUTHORING_PROVIDER=anthropic needs ANTHROPIC_API_KEY.')
  const system = 'You draft origami fold sequences for a fold engine. Reply with JSON only.'
  return {
    draft: (prompt: AuthoringPrompt) => {
      const parts = [`Reference:\n${prompt.reference}`, `Rules:\n${prompt.rules}`]
      if (prompt.lastError) parts.push(`Your last draft failed. Fix this and send the whole sequence again:\n${prompt.lastError}`)
      return callAnthropic(settings, system, parts.join('\n\n'), 8000)
    },
  }
}

export interface DraftFile {
  status: 'needs-review'
  reference: string
  tries: number
  draftedAt: string
  foldSequence: unknown
}

/** Run the loop and write the draft. Returns the loop result; writes nothing when it fails. */
export async function authorToFile(options: {
  reference: string
  out: string
  provider: AuthoringProvider
  force?: boolean
  maxTries?: number
}): Promise<AuthoringResult> {
  const out = resolve(options.out)
  if (isInside(SEED_LIBRARY_DIR, out)) throw new Error(`Drafts never go into the seed Library (${SEED_LIBRARY_DIR}). Name a file outside it.`)
  if (existsSync(out) && !options.force) throw new Error(`${out} exists. Pass --force to replace it.`)
  const result = await authorFoldSequence({ reference: options.reference, provider: options.provider, maxTries: options.maxTries })
  if (result.ok) {
    const file: DraftFile = {
      status: result.status,
      reference: options.reference,
      tries: result.tries,
      draftedAt: new Date().toISOString(),
      foldSequence: result.draft,
    }
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`)
  }
  return result
}

function args(argv: string[]) {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!
    if (!a.startsWith('--')) continue
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true
    else {
      out[a.slice(2)] = next
      i += 1
    }
  }
  return out
}

async function main() {
  const opts = args(process.argv.slice(2))
  if (typeof opts.reference !== 'string' || typeof opts.out !== 'string') {
    console.error('Usage: author -- --reference <file> --out <file> [--force] [--max-tries N]')
    process.exit(2)
  }
  const reference = readFileSync(opts.reference, 'utf8')
  const maxTries = typeof opts['max-tries'] === 'string' ? Number(opts['max-tries']) : undefined
  const result = await authorToFile({ reference, out: opts.out, provider: providerFromEnv(), force: opts.force === true, maxTries })
  if (result.ok) {
    console.log(`Draft written to ${resolve(opts.out)} after ${result.tries} tries. It needs review: fold it by hand before it goes in the Library.`)
  } else {
    console.error(`No draft after ${result.tries} tries. The last error:\n${result.lastError}`)
    process.exit(1)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error((error as Error).message)
    process.exit(1)
  })
}
