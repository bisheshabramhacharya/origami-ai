# 0003. Diagrams are composed from primitives, not stored as SVG

Date: 2026-09-19
Status: Accepted

## Context

Every Step needs a diagram, and every Model needs a preview. The Library ships 17 Models and over 140
Steps. Hand-authoring that many SVG files is unreviewable: a diagram is a blob of markup, impossible to
diff meaningfully, impossible to check for correctness, and impossible to restyle across the app.

## Decision

A **Diagram** is a list of typed **Diagram primitives** — `sheet`, `polygon`, `line`, `fold`
(valley / mountain / unfold / existing), `cut`, `crease`, `arrow`, `curve-arrow`, `dot`, `label`,
`shade` — with coordinates in a 0–100 view box. `renderDiagram` is a pure function from a Diagram to an
SVG string.

- Primitive kinds are validated by the schema. A polygon with fewer than three points is rejected at
  import time, so a broken diagram cannot ship.
- Fold semantics are encoded, not drawn: a valley fold is a dashed blue line, a mountain fold a
  dash-dot red line, a cut a red dashed line. The renderer owns that mapping so it is consistent
  everywhere and restylable in one place.
- Authoring helpers (`valley(x1,y1,x2,y2)`, `poly(...)`, `arrow(...)`) keep the Library data readable
  and compact.
- `renderDiagram` escapes all text it emits, and no user input ever reaches a diagram.

## Consequences

- Diagrams are diffable and reviewable in a pull request, and their correctness is testable: the tests
  assert that valley and mountain are visually distinct, that arrowheads appear only when something
  points, and that text is escaped.
- The renderer is deliberately schematic, not photographic. It shows structure — where to fold, which way
  to push — which is what a learner needs mid-build, rather than a rendered illustration.
- Changing the visual language of diagrams is one edit in one function, not 140 files.
