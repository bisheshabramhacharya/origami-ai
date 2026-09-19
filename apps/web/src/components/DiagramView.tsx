import { type Diagram, renderDiagram } from '@origami/core'
import { useMemo } from 'react'

/**
 * renderDiagram escapes every piece of text it writes, and nothing from user input is
 * ever placed inside the SVG. Diagrams come from the validated seed library.
 */
export function DiagramView({ diagram, className = '' }: { diagram: Diagram; className?: string }) {
  const svg = useMemo(() => renderDiagram(diagram), [diagram])
  return <div className={`diagram ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function PreviewPane({ diagram, className = '' }: { diagram: Diagram; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-paper-100 p-3 ${className}`}>
      <DiagramView diagram={diagram} className="aspect-square w-full max-w-[9rem]" />
    </div>
  )
}
