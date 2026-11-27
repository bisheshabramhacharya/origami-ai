/**
 * Draft a fold sequence offline, checked by the engine (ticket 09, ADR-0001).
 *
 *   ORIGAMI_AUTHORING_PROVIDER=anthropic ANTHROPIC_API_KEY=... \
 *     pnpm --filter @origami/api author -- --reference steps.txt --out drafts/crane.json
 *
 * The draft goes to the file you name, marked `needs-review`. This script never writes into the
 * seed Library and never marks anything `validated`: a person folds the draft first.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type AuthoringPrompt, type AuthoringProvider, type AuthoringResult, authorFoldSequence } from '@origami/core'
import { callAnthropic, llmSettings } from '../src/llm'

const here = dirname(fileURLToPath(import.meta.url))
/** The seed Library. Drafts never go in here. */
export const SEED_LIBRARY_DIR = resolve(here, '../../../packages/core/src')

/**
 * The real path of `path`, following symlinks. The file need not exist yet: the nearest folder that
 * does exist is resolved, and the rest of the path is added back.
 */
export function realPathOf(path: string): string {
  let head = resolve(path)
  const tail: string[] = []
  while (!existsSync(head)) {
    const parent = dirname(head)
    if (parent === head) break
    tail.unshift(basename(head))
    head = parent
  }
  return resolve(realpathSync(head), ...tail)
}

/** True when `path` is `dir` or inside it, after symlinks, and ignoring case where the disk does (macOS, Windows). */
export function isInside(dir: string, path: string, caseInsensitive = process.platform === 'darwin' || process.platform === 'win32'): boolean {
  const norm = (p: string) => (caseInsensitive ? p.toLowerCase() : p)
  const rel = relative(norm(realPathOf(dir)), norm(realPathOf(path)))
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel))
}

/** Paths on the command line are relative to the folder the author ran pnpm in, not to apps/api. */
export function fromWhereRun(path: string, env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.INIT_CWD ?? process.cwd(), path)
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
    // Check again: the loop can take minutes, and the folder may have changed meanwhile.
    if (isInside(SEED_LIBRARY_DIR, out)) throw new Error(`Drafts never go into the seed Library (${SEED_LIBRARY_DIR}). Name a file outside it.`)
    // Without --force, never replace a file, even one made while the loop ran.
    writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`, { flag: options.force ? 'w' : 'wx' })
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
  const reference = readFileSync(fromWhereRun(opts.reference), 'utf8')
  const maxTries = typeof opts['max-tries'] === 'string' ? Number(opts['max-tries']) : undefined
  const out = fromWhereRun(opts.out)
  const result = await authorToFile({ reference, out, provider: providerFromEnv(), force: opts.force === true, maxTries })
  if (result.ok) {
    console.log(`Draft written to ${out} after ${result.tries} tries. It needs review: fold it by hand before it goes in the Library.`)
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
