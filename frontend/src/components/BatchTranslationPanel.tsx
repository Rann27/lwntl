import { Button } from '@/components/ui/button'
/**
 * BatchTranslationPanel - Floating progress bar for THIS series' active batch.
 * Scoped to seriesId: will not appear when viewing a different series.
 */

import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import type { Chapter } from '../types'

interface Props {
  seriesId: string
  chapters: Chapter[]
  onCancel: () => void
}

const statusDot = (status: string) => {
  switch (status) {
    case 'done': return 'bg-[var(--fg-green)]'
    case 'processing': return 'bg-primary animate-pulse'
    case 'error': return 'bg-[var(--fg-red)]'
    default: return 'bg-muted-foreground/50'
  }
}

export default function BatchTranslationPanel({ seriesId, chapters, onCancel }: Props) {
  const batches = useAppStore((s) => s.batches)
  const batch = batches[seriesId] ?? null
  const { t } = useI18n()

  if (!batch || batch.status !== 'translating') return null

  const completed = batch.completed || 0
  const total = batch.total || chapters.length
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0
  const isAgent = !!batch.agent
  const phaseLabel = batch.phase === 'volume'
    ? t.agent.phaseVolume
    : isAgent ? t.agent.phaseReview : 'Sedang menerjemahkan'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-semibold text-foreground">
              {isAgent ? 'Agent run' : 'Batch translation'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {completed}/{total} bab
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono">{progressPct}%</span>
            <Button variant="ghost"
              onClick={onCancel}
              className="h-7 px-3 text-xs font-semibold border border-[var(--fg-red)] text-[var(--fg-red)] hover:bg-[var(--bg-red)] hover:text-[var(--fg-red)] transition-colors"
            >
              Batal
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Chapter list - scrollable, max 6 visible */}
        <div className="max-h-48 overflow-y-auto px-4 py-2">
          {chapters
            .filter((ch) => ch.status === 'pending' || ch.status === 'processing' || ch.status === 'done')
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((ch) => {
              const isCurrent = batch.chapterId === ch.id
              return (
                <div
                  key={ch.id}
                  className={`flex items-center gap-3 py-1.5 px-2 text-xs ${
                    isCurrent ? 'rounded-md bg-accent' : ''
                  }`}
                >
                  <div className={`size-2 rounded-full ${statusDot(ch.status)} shrink-0`} />
                  <span className={`font-mono w-12 shrink-0 ${isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                    Bab {ch.chapterNumber}
                  </span>
                  <span className={`truncate ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {ch.title || 'Tanpa Judul'}
                  </span>
                  <span className="ml-auto text-muted-foreground shrink-0" title={ch.agentReview ? t.agent.reviewedBadge : undefined}>
                    {ch.status === 'done' ? (ch.agentReview ? '✓✓' : '✓') : ch.status === 'processing' ? '⟳' : ch.status === 'error' ? '✗' : '○'}
                  </span>
                </div>
              )
            })}
        </div>

        {/* Current activity */}
        {batch.phase === 'volume' ? (
          <div className="px-4 py-2 border-t border-border text-xs text-[var(--fg-purple)]">
            {phaseLabel}…
          </div>
        ) : batch.chapterNumber && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {phaseLabel}: <span className={isAgent && batch.phase === 'review' ? 'font-medium text-[var(--fg-purple)]' : 'font-medium text-primary'}>Bab {batch.chapterNumber}</span>
            {batch.chapterTitle ? `: ${batch.chapterTitle}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
