# Origami AI

Describe something you want to make out of paper. Origami AI finds real, validated ways to build it,
shows you the trade-offs, and teaches you the one you pick — step by step.

```text
"I want to make a bird. I am a beginner and only have printer paper."
  -> Easy folded bird            3-6 min, 1 sheet, no tools
  -> Standing cut-and-fold bird  10-16 min, 1 sheet, scissors
  -> Flapping bird               7-11 min, 1 sheet, no tools
  ...
```

## The rule everything else follows

**The app never confidently invents an impossible fold.**

An AI that describes paper folds can produce instructions that are fluent and physically impossible.
So the app retrieves instead of generating:

- Every model in the library was folded end to end and carries a validation record and provenance.
- Retrieval is deterministic and pure. Ranking is explainable.
- AI is confined to language: reading your request, and re-explaining a step you are stuck on.
- Anything the tutor says is checked against the operations the model actually performs. A reply that
  names a fold the model does not do is thrown away before you see it, and replaced with a safe one.

See `docs/adr/0001-retrieval-first-never-generate-folds.md`.

## Quickstart

```bash
pnpm install

# run both the web app and the API
pnpm dev            # web on http://localhost:5173, api on http://localhost:8787
```

The app works with no API key at all — an offline heuristic tutor answers every question. Add a key for
the LLM tutor:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pnpm dev
```

### Checks

```bash
pnpm -r typecheck
pnpm test           # 85 behavioural tests, all through one seam
pnpm -r build
```

## How it is put together

```
packages/core   all domain behaviour: schemas, diagram rendering, brief parsing,
                retrieval, the grounding guard, the tutor, and the 17-model seed library
apps/api        Hono HTTP wrapper + the optional Anthropic providers
apps/web        React + Tailwind interface
```

`apps/web` imports `packages/core` directly for everything deterministic, so the interface keeps working
when the API is down. The API is only ever an enhancement: it refines how your request is read and
answers "I'm stuck" with an LLM instead of the heuristic tutor.

### The loop

1. **Read** — free text becomes a **Build Brief**: the object plus any constraints it can find. What it
   assumed and what it could not handle are shown to you, not hidden.
2. **Retrieve** — the library is filtered by hard constraints and ranked. Every option explains why it
   is where it is, and warns when it bends something you asked for.
3. **Build** — step player with diagrams, checkpoints and common mistakes, plus keyboard navigation.
4. **Unstick** — asking again rotates through five explanation levels: simpler, diagram walkthrough,
   analogy, fault-finding, full detail.

### The seed library

17 models across 10 techniques, from a 3-minute folded bird to a 75-minute printable papercraft bird.
Every one carries declared operations, per-step diagrams, checkpoints, common mistakes, provenance and
validation. The library is validated at import time — a model that cuts without listing a cutting tool,
skips a step ordinal, or lists an adhesive no step applies will throw rather than load.

Add one in `packages/core/src/data/`, then run `pnpm test`. The audit does the rest.

## What is not here yet

Camera inspection of your paper, original model generation, accounts, saved builds, and image assets.
Original generation is blocked on real geometric validation; see ADR-0001.

## Vocabulary

`CONTEXT.md` is the glossary. Use its words — `Model`, `Step`, `Build Brief`, `Option`, `Grounding` —
in code, issues and tests.
