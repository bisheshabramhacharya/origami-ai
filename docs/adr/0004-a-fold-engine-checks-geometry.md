# 0004. A fold engine checks geometry; folds are still never generated at run time

Date: 2026-11-27
Status: Accepted

## Context

ADR-0001 kept the app retrieval-first: every fold a learner sees comes from a Model a person folded by
hand. It also said the app could not check fold geometry yet, so nothing could tell a broken Step from a
good one except a person with paper. We now want a 3D view of each Step and a way to draft new Models
faster, and both need a machine that knows what paper can and cannot do.

## Decision

Add `@origami/fold`, a fold engine. It holds a virtual sheet in millimetres, applies the actions of a
**Fold sequence** written in the **Fold language** (named points and creases, never raw coordinates),
and checks each fold: points exist and can be reached, no stretch or tear, Maekawa and Kawasaki at
every flat vertex, and a layer order with no crossing layers.

- The engine is the geometry validation ADR-0001 waited for. It checks folds. It does not invent them.
- A Model may have a Fold sequence keyed by its Step ids. The Library audit runs the engine on it, in CI,
  and fails the Library when a fold is impossible. The page does not run the audit at load time.
- AI drafts of Fold sequences are offline only. A draft that passes the engine is still a draft: it
  enters the Library only through the same Validation gate as every other Model, which needs a person
  to fold it by hand. Nothing generates folds at run time.
- `@origami/fold`'s public interface is a second test seam beside `@origami/core`. This extends
  ADR-0002, it does not replace it: the engine is a deep module with no domain dependency (it knows
  paper, not Models), so it gets its own tests in `packages/fold/test/`. Core keeps its seam for
  everything about Models, Steps and the Library.
- The engine is MIT and pure TypeScript. GPL tools (Rabbit Ear, ORIPA, TreeMaker) are reference only and
  never a dependency.
- The web app draws the meshes the engine gives it and does no geometry of its own. three.js and React
  Three Fiber load only when the Build panel opens a Model with a Fold sequence.

## Consequences

- A broken Fold sequence can never ship: CI fails with the Step, the action, the check and the point.
- Folded states are exact for simple folds. Compound folds (collapse, squash, petal) are worked out
  from crease assignments, so their in-between animation frames are an approximation and are labelled.
- The first page bundle grows only by the Fold sequence data and its schema. The engine and three.js
  are in a chunk that loads on demand.
- Reverse folds cut a flap that is folded in half along a spine. Each half of the part that moves turns
  over on its own, and the spine of that part turns the other way. Inside and outside reverse folds on
  the same line differ only in layer order, and the paper usually allows only one of them: when the turned
  spine lands inside the flap, only an inside reverse fold is possible; when it lands beyond the spine, only
  an outside one. The engine gives a layer-order error for the other, so a wrong kind cannot pass. When the
  line is at right angles to the spine, the turned spine lands back on itself and both kinds are possible.
- The spine of a reverse fold is a crease that crosses the fold line and splits the flap into two halves,
  one above the other at the fold. A thin fold or a hem can also do that. The engine takes the crease that
  splits the layers most evenly, and gives an error when two creases tie. A flap whose real spine splits
  the layers less evenly than a hem does (for example three layers in front and one behind) is read wrong
  and fails; it needs a reverse fold given by its spine crease, which the language does not have yet.
- Layers outside the flap (a wing, the body) keep their side: one that lay above any part of the flap
  stays above all of the part that moves, and one that lay below stays below.
- Lines that diagrams draw by eye (the crane's neck, its head) are written as a line through a named
  point at an angle, and a point can be a fraction of the way between two named points. These are the
  only places a number stands for a position.
