/**
 * BatchTranslationPanel - Transparent batch translation navigator
 * Shows progress of all chapters being translated in a batch
 */

import { useAppStore } from '../store/appStore'
import type { Chapter } from '../types'

interface Props {
  chapters: Chapter[]
  onCancel: () => void
}

const statusDot = (status: string) => {
  switch (status) {
    case 'done': return 'bg-[#28E272]'
    case 'processing': return 'bg-[#00F7FF] animate-pulse'
    case 'error': return 'bg-[#FF3C3C]'
    default: return 'bg-[#666666]'
  }
}

export default function BatchTranslationPanel({ chapters, onCancel }: Props) {
  const batch = useAppStore((s) => s.batch)

  if (!batch || batch.status !== 'translating') return null

  const completed = batch.completed || 0
  const total = batch.total || chapters.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl bg-[#111111] text-white border-2.5 border-[#111111] shadow-[6px_6px_0px_rgba(0,0,0,0.3)]"
        style={{ borderRadius: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#00F7FF] animate-pulse" />
            <span className="font-space text-sm font-bold tracking-wide text-[#00F7FF]">
              BATCH TRANSLATION
            </span>
            <span className="text-xs text-[#999] font-mono">
              {completed}/{total} bab
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#999] font-mono">{progressPct}%</span>
            <button
              onClick={onCancel}
              className="px-3 py-1 text-xs font-bold border-2 border-[#FF3C3C] text-[#FF3C3C] hover:bg-[#FF3C3C] hover:text-white transition-colors"
            >
              BATAL
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-[#222]">
          <div
            className="h-full bg-[#00F7FF] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Chapter list - scrollable, max 6 visible */}
        <div className="max-h-48 overflow-y-auto px-4 py-2">
          {chapters
            .filter((ch) => ch.status === 'pending' || ch.status === 'processing' || ch.status === 'done')
            .sort((a, b) => a.chapterNumber - b.chapterNumber)
            .map((ch) => {
              const isCurrent = batch.chapterId === ch.id
              return (
                <div
                  key={ch.id}
                  className={`flex items-center gap-3 py-1.5 px-2 text-xs ${
                    isCurrent ? 'bg-[#1a1a1a]' : ''
                  }`}
                >
                  <div className={`w-2 h-2 ${statusDot(ch.status)} flex-shrink-0`} />
                  <span className={`font-mono w-12 flex-shrink-0 ${isCurrent ? 'text-[#00F7FF]' : 'text-[#666]'}`}>
                    Bab {ch.chapterNumber}
                  </span>
                  <span className={`truncate ${isCurrent ? 'text-white' : 'text-[#999]'}`}>
                    {ch.title || 'Tanpa Judul'}
                  </span>
                  <span className="ml-auto text-[#444] flex-shrink-0">
                    {ch.status === 'done' ? '✓' : ch.status === 'processing' ? '⟳' : ch.status === 'error' ? '✗' : '○'}
                  </span>
                </div>
              )
            })}
        </div>

        {/* Current activity */}
        {batch.chapterNumber && (
          <div className="px-4 py-2 border-t border-[#333] text-xs text-[#666]">
            Sedang menerjemahkan: <span className="text-[#00F7FF]">Bab {batch.chapterNumber}</span>
            {batch.chapterTitle ? ` — ${batch.chapterTitle}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}