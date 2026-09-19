# 0002. One test seam: the core package's public API

Date: 2026-09-19
Status: Accepted

## Context

The product loop spans schema, data, ranking, language and UI. The tempting shape is a seam per layer:
unit tests for the parser, unit tests for the ranker, tests for each HTTP route, tests for each React
component. That produces a large suite that mostly asserts internal structure, breaks on every
refactor, and never actually proves the loop works.

## Decision

`@origami/core` is the single test seam. Every behavioural test imports the package's public API and
nothing else. Tests live in `packages/core/test/`.

- The suite is written against **external behaviour**: a request in, Options out; a Step plus a level
  in, a grounded Explanation out. No test reaches into a private helper or asserts an internal call.
- `apps/api` and `apps/web` are deliberately thin. The API wraps core calls in HTTP; the web imports
  core directly for anything deterministic. Neither carries a behavioural test suite of its own,
  because neither holds behaviour the core tests do not already cover.
- The strongest tests are the library-wide invariants: every Step of every Model, at every Explanation
  level, at several attempts, must produce a grounded Explanation. That is one assertion covering the
  whole Library, and it fails the moment an author adds a Step that cannot be taught safely.
- The Library audit doubles as a data test. Schema violations, skipping ordinals, cutting without a
  cutting tool and listing an unused adhesive are all caught without a human reading the data.

## Consequences

- Adding a new capability means adding behaviour to core, which means it lands on the seam and gets
  tested by construction.
- A regression in the UI will not be caught by `pnpm test`. That is accepted: the UI is presentation, and
  the compensating control is that all of its logic that could be wrong lives in core.
- Tests must not assert on the wording of heuristic explanations beyond "it changed" or "it is grounded",
  or they would pin prose that is meant to vary.
