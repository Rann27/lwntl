/**
 * Live updates for anything that shows chapter progress.
 *
 * The backend reports progress through window events (see App.tsx):
 *   lwntl:translation-status  a chapter started or changed phase (processing,
 *                             revising, summarizing, done, cancelled...)
 *   lwntl:translation-done / lwntl:translation-error
 *   lwntl:batch-status        batch / agent progress, and when a run settles
 *
 * Events arrive in bursts, so they are coalesced per series: `onUpdate` runs at
 * most once per 250 ms per series. `settled` is true when the burst contained a
 * finished chapter or a finished run, i.e. when the glossary, summaries and
 * long-term memory may have changed too, not just a chapter status.
 */

import { useEffect, useRef } from 'react'

const DELAY_MS = 250

export function useLiveSeriesEvents(onUpdate: (seriesId: string, settled: boolean) => void, enabled = true) {
  const callback = useRef(onUpdate)
  callback.current = onUpdate

  useEffect(() => {
    if (!enabled) return
    const pending = new Map<string, { settled: boolean; timer: number }>()

    const schedule = (seriesId: string | undefined, settled: boolean) => {
      if (!seriesId) return
      const entry = pending.get(seriesId)
      if (entry) {
        entry.settled ||= settled
        return
      }
      const next = { settled, timer: 0 }
      next.timer = window.setTimeout(() => {
        pending.delete(seriesId)
        callback.current(seriesId, next.settled)
      }, DELAY_MS)
      pending.set(seriesId, next)
    }

    const detail = (e: Event) => ((e as CustomEvent).detail ?? {}) as { seriesId?: string; status?: string; agent?: unknown }
    const onStatus = (e: Event) => {
      const d = detail(e)
      schedule(d.seriesId, d.status === 'done' || d.status === 'cancelled')
    }
    const onSettled = (e: Event) => schedule(detail(e).seriesId, true)
    const onBatch = (e: Event) => {
      const d = detail(e)
      // Agent runs edit chapters and the glossary between phase events.
      schedule(d.seriesId, d.status === 'done' || d.status === 'cancelled' || !!d.agent)
    }

    window.addEventListener('lwntl:translation-status', onStatus)
    window.addEventListener('lwntl:translation-done', onSettled)
    window.addEventListener('lwntl:translation-error', onSettled)
    window.addEventListener('lwntl:batch-status', onBatch)
    return () => {
      window.removeEventListener('lwntl:translation-status', onStatus)
      window.removeEventListener('lwntl:translation-done', onSettled)
      window.removeEventListener('lwntl:translation-error', onSettled)
      window.removeEventListener('lwntl:batch-status', onBatch)
      for (const { timer } of pending.values()) window.clearTimeout(timer)
    }
  }, [enabled])
}
