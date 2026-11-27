import { type Model, type StepPlayback, stepPlayback } from '@origami/core'
import { displayMesh } from '@origami/fold'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FoldScene } from './FoldScene'

/** Seconds each action takes to play. */
const SECONDS_PER_ACTION = 1.6

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * The 3D view of a Step. Loaded only when a Model with a fold sequence opens. StepVisual gives it a
 * new key for each Step, so the player starts again at the start of every Step.
 */
export default function Step3D({ model, stepId, stepLabel }: { model: Model; stepId: string; stepLabel: string }) {
  const playback = useMemo(() => stepPlayback(model, stepId), [model, stepId])
  // No folded state (the sequence failed before this Step): let StepVisual's boundary show the 2D Diagram.
  if (!playback) throw new Error(`No folded state for ${stepId}.`)
  const note = model.foldSequence?.steps.find((s) => s.step === stepId)?.note
  return <Player playback={playback} note={note} stepLabel={stepLabel} />
}

/**
 * Plays the paper from the state before the Step to the state after it. The engine gives every
 * frame; this only picks the time (ADR-0002).
 */
function Player({ playback, note, stepLabel }: { playback: StepPlayback; note?: string; stepLabel: string }) {
  const count = playback.motions.length
  const reduced = useMemo(prefersReducedMotion, [])
  // Progress runs from 0 (the start of the Step) to `count` (its end); action i plays from i to i + 1.
  const [progress, setProgress] = useState(() => (reduced ? count : 0))
  const [playing, setPlaying] = useState(() => !reduced && count > 0)
  const [viewKey, setViewKey] = useState(0)
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = (now: number) => {
      const before = last.current ?? now
      last.current = now
      setProgress((p) => Math.min(count, p + (now - before) / 1000 / SECONDS_PER_ACTION))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      last.current = null
    }
  }, [playing, count])
  useEffect(() => {
    if (playing && progress >= count) setPlaying(false)
  }, [playing, progress, count])

  const index = Math.max(0, Math.min(count - 1, Math.floor(progress)))
  const motion = count > 0 ? playback.motions[index]! : null
  const local = motion ? progress - index : 1
  const mesh = useMemo(() => displayMesh(motion ? motion.stateAt(local) : playback.after), [motion, local, playback])
  const approximate = motion !== null && !motion.exact && local > 0 && local < 1
  const done = progress >= count

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (progress >= count) setProgress(0)
    setPlaying(true)
  }, [playing, progress, count])
  const replay = useCallback(() => {
    setProgress(0)
    setPlaying(true)
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <FoldScene mesh={mesh} frame={playback.frame} resetKey={viewKey} label={`3D view of ${stepLabel}. Drag to turn the paper.`} />
        {approximate ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-paper-50/90 px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-sm">
            Approximate motion
          </span>
        ) : null}
        {done && note ? (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-paper-50/90 px-3 py-2 text-xs text-ink-soft shadow-sm">{note}</p>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {count > 0 ? (
          <>
            <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={togglePlay}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={replay}>
              Replay
            </button>
            <input
              type="range"
              min={0}
              max={count}
              step={0.01}
              value={progress}
              aria-label="Scrub through this Step"
              aria-valuetext={`Fold ${index + 1} of ${count}, ${Math.round(local * 100)}%`}
              onChange={(e) => {
                setPlaying(false)
                setProgress(Number(e.target.value))
              }}
              className="min-w-[8rem] flex-1 accent-ink"
            />
          </>
        ) : (
          <span className="flex-1 text-ink-faint">Nothing moves in this Step.</span>
        )}
        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setViewKey((k) => k + 1)}>
          Show from my side
        </button>
      </div>
    </div>
  )
}
