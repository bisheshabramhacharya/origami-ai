import {
  type BuildBrief,
  type Model,
  type RankedOption,
  SEED_LIBRARY,
  findOptions,
  parseBriefHeuristic,
} from '@origami/core'
import { useEffect, useRef, useState } from 'react'
import { BuildPanel } from './components/BuildPanel'
import { LibraryPanel } from './components/LibraryPanel'
import { OptionsPanel } from './components/OptionsPanel'
import { RequestPanel } from './components/RequestPanel'
import { getHealth, refineBrief } from './lib/api'

type Screen = 'ask' | 'options' | 'build' | 'library'

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path d="M12 3 L21 20 L12 15 L3 20 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 3 L12 15" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function App() {
  const [screen, setScreen] = useState<Screen>('ask')
  const [brief, setBrief] = useState<BuildBrief | null>(null)
  const [options, setOptions] = useState<RankedOption[]>([])
  const [enriched, setEnriched] = useState(false)
  const [refining, setRefining] = useState(false)
  const [model, setModel] = useState<Model | null>(null)
  const [lastText, setLastText] = useState('')
  const [llm, setLlm] = useState<string | null>(null)
  const requestToken = useRef(0)

  useEffect(() => {
    let active = true
    getHealth().then((health) => {
      if (active) setLlm(health?.llm ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(text: string) {
    const token = (requestToken.current += 1)
    const local = parseBriefHeuristic(text)

    setLastText(text)
    setBrief(local)
    setOptions(findOptions(local, SEED_LIBRARY))
    setEnriched(false)
    setScreen('options')

    if (llm !== 'anthropic') return

    setRefining(true)
    const refined = await refineBrief(text)
    if (token !== requestToken.current) return
    setRefining(false)
    if (!refined?.enriched) return

    setBrief(refined.brief)
    setOptions(findOptions(refined.brief, SEED_LIBRARY))
    setEnriched(true)
  }

  function choose(chosen: Model) {
    setModel(chosen)
    setScreen('build')
    window.scrollTo({ top: 0 })
  }

  function goHome() {
    requestToken.current += 1
    setScreen('ask')
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-paper-200 bg-paper-100/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-2 text-ink transition hover:opacity-70"
            title="Start again"
          >
            <Mark />
            <span className="text-sm font-semibold tracking-tight">Origami AI</span>
          </button>
          <nav className="flex items-center gap-2">
            {llm && (
              <span
                className="chip hidden sm:inline-flex"
                title={
                  llm === 'anthropic'
                    ? 'An AI model is available for reading requests and re-explaining steps'
                    : 'No AI key configured, so the offline tutor is answering'
                }
              >
                {llm === 'anthropic' ? 'AI tutor on' : 'offline tutor'}
              </span>
            )}
            <button
              type="button"
              className={screen === 'library' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setScreen('library')}
            >
              Library
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {screen === 'ask' && <RequestPanel onSubmit={handleSubmit} busy={false} initialText={lastText} />}

        {screen === 'options' && brief && (
          <OptionsPanel
            brief={brief}
            options={options}
            enriched={enriched}
            refining={refining}
            onChoose={choose}
            onEdit={goHome}
          />
        )}

        {screen === 'build' && model && <BuildPanel model={model} onBack={() => setScreen(brief ? 'options' : 'library')} />}

        {screen === 'library' && <LibraryPanel onStart={choose} onBack={() => setScreen(brief ? 'options' : 'ask')} />}
      </main>

      <footer className="border-t border-paper-200 px-5 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-ink-faint">
          <span>
            Retrieved from {SEED_LIBRARY.length} validated models. The app never invents a fold it cannot
            verify.
          </span>
          <span>Origami AI · early MVP</span>
        </div>
      </footer>
    </div>
  )
}
