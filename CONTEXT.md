# CONTEXT

The shared vocabulary for Origami AI. Use these words in code, issues, tests and copy.
If a concept you need is not here, that is a signal — either you are inventing language the
project does not use, or there is a real gap worth resolving.

## The product in one paragraph

A person describes something they want to make out of paper. The app reads that request into a
**Build Brief**, retrieves **Models** that can actually be built, ranks them as **Options**, and then
teaches the chosen **Model** one **Step** at a time. When the person gets stuck, the **Tutor**
re-explains the current Step from a different angle. The app never invents a fold.

## Core concepts

**Build Brief** — the structured reading of a free-text request: the object, plus the Constraints
the person stated or implied. Produced by the brief parser. Carries `notes` for assumptions it made
and `unparsed` for requirements it could not serve, so the UI can be honest about both.

**Constraint** — a stated limit: difficulty ceiling, time budget, sheet limit, refuses scissors, refuses
glue, refuses a printer, which paper weights are on hand, techniques allowed or excluded. A Constraint
is either *hard* (excluded from results) or *soft* (surfaced as a warning on the Option).

**Model** — one validated, hand-foldable way of building something out of paper. The unit of retrieval.
A Model owns its Steps, its PaperSpec, its tools, its adhesives, its preview Diagram, its Provenance
and its Validation. A Model that is not `validated` is never retrievable.

**Technique** — the family a Model belongs to: origami, modular origami, kirigami, cut-and-fold,
printable papercraft, paper toy, pop-up, paper engineering, geometric, packaging, prototype.

**Step** — one instruction inside a Model, with its own Diagram, checkpoints, common mistakes and the
**Operations** it performs. Ordinals are contiguous from 1; the library audit enforces this.

**Operation** — a member of a closed vocabulary (`valley-fold`, `reverse-fold`, `cut`, `glue`, …).
Operations are *declared*, never inferred. They are the contract the grounding guard checks against.

**Diagram** — a list of **Diagram primitives** (sheet, valley fold, mountain fold, arrow, cut line,
curve arrow, shade, label) rendered to SVG by a pure function. Diagrams are composed, never stored as
raw SVG, so diagrams stay editable, diffable and testable.

**Library** — the collection of Models the app can retrieve from. The shipped one is the **seed
library**. It is validated at import time; a Model that fails the audit throws rather than shipping.

**Validation** — a Model's record that it was folded end to end by a named reviewer, when, and against
which checks. **Provenance** is where it came from and under what licence. Both are required.

**Retrieval** — the deterministic filter-and-rank of the Library against a Build Brief. Returns
**Options**. Pure, no model calls, no invention.

**Option** — a Model plus its score, its **Match** label (`great` / `good` / `stretch`), the reasons it
ranked where it did, and any warnings. Multiple Options are always offered; the app never forces one answer.

**Match** — how well an Option fits the Brief, in words rather than a raw number.

**Tutor** — the thing that re-explains a Step. It has two implementations: an **LLM provider** and the
**heuristic provider** (offline, deterministic, built only from the Step's own fields).

**Explanation level** — which angle a re-explanation takes: `simpler`, `detail`, `analogy`,
`troubleshoot`, `visual`. Asking again rotates the level.

**Grounding** — the rule that an Explanation may only name Operations the Model actually performs.
The **grounding guard** checks a candidate Explanation against the Model and reports
**grounding violations**. An ungrounded Explanation is discarded and replaced by a heuristic one, and
the discarded attempt is reported rather than hidden.

## Words to avoid

- **"pattern"** or **"tutorial"** for a Model — say Model.
- **"recipe"** — say the Model's Steps.
- **"generate"** for anything fold-related. The app retrieves, ranks, explains and tutors. It does not
  generate paper geometry. Reservations about this live in ADR-0001.
- **"AI guesses"** — the AI never produces a fold. It produces language about folds that already exist.
