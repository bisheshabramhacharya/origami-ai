import { describe, expect, it } from 'vitest'
import { arrow, crease, cutLine, diagram, dot, label, mountain, poly, renderDiagram, rotateArrow, sheet, valley } from '../src'

describe('rendering a diagram to SVG', () => {
  it('produces a self-contained svg with an accessible label', () => {
    const svg = renderDiagram(diagram('A folded square', sheet('square'), valley(20, 20, 80, 80)))
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('viewBox="0 0 100 100"')
    expect(svg).toContain('role="img"')
    expect(svg).toContain('aria-label="A folded square"')
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('distinguishes valley from mountain folds, because they mean opposite things', () => {
    const svg = renderDiagram(diagram('Both', valley(20, 20, 80, 80), mountain(20, 80, 80, 20)))
    expect(svg).toContain('dg-fold-valley')
    expect(svg).toContain('dg-fold-mountain')
    expect(svg).toContain('#2563eb')
    expect(svg).toContain('#dc2626')
  })

  it('only defines arrowheads when something actually points', () => {
    const withArrow = renderDiagram(diagram('Pointing', sheet('square'), arrow(30, 30, 60, 60)))
    const withoutArrow = renderDiagram(diagram('Still', sheet('square'), valley(20, 20, 80, 80)))
    expect(withArrow).toContain('<marker')
    expect(withoutArrow).not.toContain('<marker')
  })

  it('renders cutting lines differently from creases', () => {
    const svg = renderDiagram(diagram('Cut here', sheet('a4'), cutLine(26, 30, 74, 30), crease(26, 50, 74, 50)))
    expect(svg).toContain('dg-cut')
    expect(svg).toContain('dg-crease')
  })

  it('escapes text so a stray angle bracket cannot break the svg', () => {
    const svg = renderDiagram(diagram('Labels', label(10, 10, '<script>alert(1)</script>')))
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  it('keeps every primitive type renderable', () => {
    const everything = diagram(
      'Everything',
      sheet('square'),
      poly(20, 20, 80, 20, 80, 80),
      valley(20, 20, 80, 80),
      mountain(20, 80, 80, 20),
      crease(20, 50, 80, 50),
      cutLine(20, 30, 80, 30),
      arrow(30, 30, 50, 50),
      rotateArrow(50, 50, 12, 180),
      dot(50, 50, 'pinch'),
      label(10, 10, 'note'),
    )
    const svg = renderDiagram(everything)
    expect(svg).toContain('dg-sheet')
    expect(svg).toContain('dg-polygon')
    expect(svg).toContain('dg-curve-arrow')
    expect(svg).toContain('dg-dot')
    expect(svg).toContain('dg-label')
    expect((svg.match(/</g) ?? []).length).toBeGreaterThan(10)
  })

  it('renders the same diagram identically every time, so previews do not flicker', () => {
    const build = () => renderDiagram(diagram('Stable', sheet('square'), valley(20, 20, 80, 80), arrow(30, 30, 50, 50)))
    expect(build()).toBe(build())
  })

  it('handles every paper shape without throwing', () => {
    for (const shape of ['square', 'rectangle', 'a4', 'letter', 'circle'] as const) {
      expect(() => renderDiagram(diagram(shape, sheet(shape)))).not.toThrow()
    }
  })
})
