import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'good' | 'info' | 'warn' | 'danger'

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-paper-300 bg-paper-100 text-ink-soft',
  good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: BadgeTone
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
