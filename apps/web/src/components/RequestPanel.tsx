import { SEED_LIBRARY, libraryStats } from '@origami/core'
import { type FormEvent, useState } from 'react'

const EXAMPLES = [
  'I want to make a bird. I am a beginner and only have printer paper.',
  'A small box for a ring, no glue, done in 10 minutes',
  'A pop-up birthday card with a flower, I have cardstock and a glue stick',
  'Something to keep a kid busy for 20 minutes with scissors',
  'A cube I can build from six sheets of origami paper',
]

export function RequestPanel({
  onSubmit,
  busy,
  initialText = '',
}: {
  onSubmit: (text: string) => void
  busy: boolean
  initialText?: string
}) {
  const [text, setText] = useState(initialText)
  const stats = libraryStats()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (text.trim().length === 0) return
    onSubmit(text.trim())
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <div className="mb-10 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Describe what you want to make in paper.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-ink-soft">
          Origami AI finds real, tried-and-tested ways to build it, tells you honestly what each one
          costs you in time and materials, then teaches you the one you pick, step by step.
        </p>
      </div>

      <form onSubmit={submit} className="card p-5 sm:p-6">
        <label htmlFor="request" className="section-title mb-2 block">
          What do you want to make?
        </label>
        <textarea
          id="request"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="I want to make a bird. I am a beginner and only have printer paper."
          className="field resize-none"
        />
        <p className="mt-2 text-xs text-ink-faint">
          Mention your paper, your tools, how long you have and how hard you want it. Anything you
          leave out, we will ask about rather than guess.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Searching {stats.total} validated models. Nothing is invented.
          </div>
          <button type="submit" className="btn-primary" disabled={busy || text.trim().length === 0}>
            {busy ? 'Finding options...' : 'Find ways to make it'}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <div className="section-title mb-3">Try one of these</div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="chip text-left transition hover:border-paper-400 hover:bg-paper-200"
            >
              {example.length > 58 ? `${example.slice(0, 58)}...` : example}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'It retrieves, never invents',
            body: `Every option is one of ${SEED_LIBRARY.length} models that have been folded end to end and checked. The AI searches, ranks and explains; it does not make folds up.`,
          },
          {
            title: 'Every step is checked',
            body: 'If an explanation ever names a fold the model does not use, it is thrown away and a safe one is used instead.',
          },
          {
            title: 'Stuck is normal',
            body: 'Ask for the same step again and you get a different angle on it: simpler words, an analogy, a diagram walkthrough, or a fault-finding check.',
          },
        ].map((item) => (
          <div key={item.title} className="card p-4">
            <div className="text-sm font-semibold text-ink">{item.title}</div>
            <p className="mt-1.5 text-sm text-ink-soft">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
