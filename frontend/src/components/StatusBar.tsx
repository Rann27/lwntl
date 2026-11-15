/**
 * LWNTL Status Bar
 * Bottom bar showing translation progress
 */

import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { TranslationState } from '../store/appStore'
import { useI18n } from '../i18n'

interface StatusBarProps {
  translation: TranslationState
  chapterStatus: string
}

export function StatusBar({ translation, chapterStatus }: StatusBarProps) {
  const { t } = useI18n()
  const statusLabels: Record<string, string> = {
    idle: t.status.idle,
    processing: t.status.processing + '...',
    extracting: t.status.extracting + '...',
    summarizing: t.status.summarizing + '...',
    translating: t.status.translating + '...',
    done: t.status.done,
    error: t.status.error,
  }
  const status = translation.isTranslating ? translation.status : chapterStatus
  const label = statusLabels[status] || status

  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        fontSize: '12px',
        color: 'var(--color-text)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Status icon */}
        {translation.isTranslating ? (
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--fg-cyan,#00F7FF)' }} />
        ) : status === 'done' ? (
          <CheckCircle size={14} style={{ color: 'var(--fg-green,#28E272)' }} />
        ) : status === 'error' ? (
          <XCircle size={14} style={{ color: 'var(--fg-red,#FF3C3C)' }} />
        ) : (
          <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
        )}

        <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>
          {label}
        </span>

        {translation.isTranslating && translation.iteration > 0 && (
          <span style={{ color: 'var(--color-text-muted)' }}>
            {t.chapter.iteration} {translation.iteration}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {translation.isTranslating && (
        <div className="flex items-center gap-3">
          <div className="ui-progress" style={{ width: '120px', height: '12px' }}>
            <div
              className="ui-progress-fill"
              style={{ width: `${translation.progress}%` }}
            />
          </div>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {translation.progress}%
          </span>
        </div>
      )}
    </div>
  )
}
