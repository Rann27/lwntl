/**
 * LWNTL Status Bar
 * Bottom bar showing translation progress
 */

import { Loader2, CheckCircle, XCircle, Zap } from 'lucide-react'
import type { TranslationState } from '../store/appStore'

interface StatusBarProps {
  translation: TranslationState
  chapterStatus: string
}

const statusLabels: Record<string, string> = {
  idle: 'Siap',
  processing: 'Memproses...',
  extracting: 'Mengekstrak glossary...',
  translating: 'Menerjemahkan...',
  done: 'Selesai',
  error: 'Error',
}

export function StatusBar({ translation, chapterStatus }: StatusBarProps) {
  const status = translation.isTranslating ? translation.status : chapterStatus
  const label = statusLabels[status] || status

  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{
        backgroundColor: '#fff',
        borderTop: '2.5px solid #111',
        fontSize: '12px',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Status icon */}
        {translation.isTranslating ? (
          <Loader2 size={14} className="animate-spin" style={{ color: '#00F7FF' }} />
        ) : status === 'done' ? (
          <CheckCircle size={14} style={{ color: '#28E272' }} />
        ) : status === 'error' ? (
          <XCircle size={14} style={{ color: '#FF3C3C' }} />
        ) : (
          <Zap size={14} style={{ color: '#666' }} />
        )}

        <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </span>

        {translation.isTranslating && translation.iteration > 0 && (
          <span style={{ color: '#666' }}>
            Iterasi {translation.iteration}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {translation.isTranslating && (
        <div className="flex items-center gap-3">
          <div className="neo-progress" style={{ width: '120px', height: '12px' }}>
            <div
              className="neo-progress-fill"
              style={{ width: `${translation.progress}%` }}
            />
          </div>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {translation.progress}%
          </span>
        </div>
      )}
    </div>
  )
}