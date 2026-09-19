# Agent skills

### Issue tracker

Issues and specs live as GitHub issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, each label string equal to its role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.

## Working in this repo

- `CONTEXT.md` is the vocabulary. Use its words in issue titles, test names and code.
- `pnpm test` runs the whole behavioural suite. It is fast and it is the gate.
- `pnpm -r typecheck` and `pnpm -r build` must both pass before a change is done.

### The one rule that matters

**The app must never confidently invent an impossible fold.** Every feature is judged against that.
Retrieval is deterministic and grounded in the seed library. The AI may read requests, rank results and
explain steps — it may not author paper geometry. See `docs/adr/0001-retrieval-first-never-generate-folds.md`.

Anything the Tutor says is checked against the Model's declared Operations by the grounding guard
before a learner sees it. If you add a path that produces learner-facing text about a Step, it must go
through `explainStep` so the guard applies.

### Where things live

- `packages/core` — all domain behaviour: schemas, diagram rendering, brief parsing, retrieval,
  grounding, tutor, and the seed library. This is the tested seam.
- `apps/api` — an HTTP wrapper with the optional LLM providers. Thin by design.
- `apps/web` — the React interface. It imports `packages/core` directly for anything deterministic, so
  the app keeps working when the API is unreachable.

### Adding a model to the seed library

Author it in `packages/core/src/data/`, then run the tests. The library audit will reject it if step
ordinals skip, if it cuts without listing a cutting tool, if it lists an adhesive no step applies, or
if a diagram primitive is degenerate. Declare every Operation a step actually performs — the grounding
guard is only as good as the declarations.
