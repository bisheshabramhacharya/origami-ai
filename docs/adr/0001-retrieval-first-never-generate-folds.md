# 0001. Retrieval-first: the app never generates folds

Date: 2026-09-19
Status: Accepted

## Context

An AI that describes paper folds can produce instructions that are fluent, confident and physically
impossible. A learner following them wastes paper and time, and loses trust in every later suggestion.
The README states the rule plainly: *the app should never confidently invent an impossible fold.*

Two shapes of product were available:

1. Generate a fold sequence on demand, then validate the geometry afterwards.
2. Retrieve from a library of sequences that are already known to work, and use AI only for language.

Option 1 requires a real geometric fold simulator and a proof that a generated crease pattern is
flat-foldable to the intended shape. That is a research problem, and being wrong is invisible to the
user until the paper is in their hands.

## Decision

Retrieval-first.

- A **Model** enters the **Library** only with a Validation record naming who folded it end to end and
  against which checks. Unvalidated Models are not retrievable through any path.
- **Retrieval** is deterministic and pure. It filters and ranks Models against a **Build Brief**. It
  never invents a Model, a Step or an Operation.
- AI is confined to language: reading a request into a Build Brief, ranking rationale, and re-explaining
  a Step that already exists.
- Any learner-facing text about a Step passes through the **grounding guard**, which compares the
  Operations it names against the Operations the Model declares. An ungrounded Explanation is discarded
  and replaced with a heuristic one, and the discarded attempt is reported rather than hidden.
- Original model generation is out of scope until geometry validation exists. When it arrives it must
  sit behind the same Validation gate as any hand-authored Model.

## Consequences

- The Library is the ceiling on what the app can offer. A request with no matching Model gets an honest
  "we cannot build that yet" and a note in the Brief's `unparsed`, never a plausible-looking invention.
- Every Model carries authoring cost: steps, declared Operations, diagrams, provenance, validation.
  This is the price of the guarantee and it is the intended trade.
- The grounding guard is deliberately conservative. It can miss an operation phrased unusually, which
  fails safe. It must not reject a legitimate explanation, because a guard that cries wolf gets removed.
- Declaring an Operation is part of authoring a Step. A Step that under-declares leaves a hole in the
  guard, so the library audit treats declaration quality as a first-class concern.
