/**
 * CJKBubble — floating QC indicator for CJK characters in translated text
 * Shows incident count; click opens a modal listing each occurrence with context.
 * Each incident has a "Fix this line" button that calls AI to clean the CJK inline.
 */

import { useState } from 'react'
import { X, AlertTriangle, Wrench, Loader } from 'lucide-react'
import type { CJKIncident } from '../utils/cjkDetector'
import { fixCjkText } from '../api'

interface Props {
  incidents: CJKIncident[]
  workerId?: string | null
}

type FixStatus =
  | { status: 'loading' }
  | { status: 'done'; text: string }
  | { status: 'error'; message: string }

export default function CJKBubble({ incidents, workerId }: Props) {
  const [open, setOpen] = useState(false)
  const [fixResults, setFixResults] = useState<Record<number, FixStatus>>({})
  const [fixingAll, setFixingAll] = useState(false)

  const fixOne = async (index: number) => {
    const inc = incidents[index]
    setFixResults(prev => ({ ...prev, [index]: { status: 'loading' } }))
    try {
      const result = await fixCjkText(inc.context, workerId)
      setFixResults(prev => ({ ...prev, [index]: { status: 'done', text: result.fixed } }))
    } catch (e) {
      setFixResults(prev => ({ ...prev, [index]: { status: 'error', message: String(e) } }))
    }
  }

  const fixAll = async () => {
    setFixingAll(true)
    await Promise.all(incidents.map((_, i) => fixOne(i)))
    setFixingAll(false)
  }

  if (incidents.length === 0) return null

  const loadingCount = Object.values(fixResults).filter(r => r.status === 'loading').length
  const doneCount = Object.values(fixResults).filter(r => r.status === 'done').length

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen(true)}
        title={`${incidents.length} CJK character(s) detected in translation`}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          backgroundColor: '#FFEF33',
          color: '#111',
          border: '2.5px solid #111',
          boxShadow: '4px 4px 0px #111',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'transform 0.1s, box-shadow 0.1s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget
          el.style.transform = 'translate(2px,2px)'
          el.style.boxShadow = '2px 2px 0px #111'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget
          el.style.transform = ''
          el.style.boxShadow = '4px 4px 0px #111'
        }}
        onMouseDown={e => {
          const el = e.currentTarget
          el.style.transform = 'translate(4px,4px)'
          el.style.boxShadow = 'none'
        }}
        onMouseUp={e => {
          const el = e.currentTarget
          el.style.transform = ''
          el.style.boxShadow = '4px 4px 0px #111'
        }}
      >
        <AlertTriangle size={14} />
        CJK
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '20px',
            height: '20px',
            padding: '0 5px',
            backgroundColor: '#111',
            color: '#FFEF33',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '2px',
          }}
        >
          {incidents.length}
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: '560px',
              maxWidth: '92vw',
              maxHeight: '80vh',
              backgroundColor: 'var(--color-surface)',
              border: '2.5px solid #111',
              boxShadow: '6px 6px 0px #111',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '2.5px solid #111',
                backgroundColor: '#FFEF33',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="#111" />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', color: '#111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CJK Detector
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#111', opacity: 0.7 }}>
                  — {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Fix All button */}
                <button
                  onClick={fixAll}
                  disabled={fixingAll}
                  title="Fix all CJK incidents with AI"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    backgroundColor: fixingAll ? '#888' : '#111',
                    color: '#FFEF33',
                    border: '2px solid #111',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: '11px',
                    cursor: fixingAll ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {fixingAll
                    ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Fixing... ({loadingCount} left)</>
                    : doneCount > 0 && doneCount === incidents.length
                      ? <><Wrench size={11} /> Fixed All</>
                      : <><Wrench size={11} /> Fix All</>
                  }
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#111', display: 'flex' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Description */}
            <div style={{ padding: '10px 16px', borderBottom: '1.5px solid var(--color-border)', flexShrink: 0, backgroundColor: 'var(--color-surface-2)' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, lineHeight: '1.5' }}>
                Karakter CJK yang terdeteksi dalam hasil terjemahan. Ini bisa menandakan noise/bias AI — periksa manual apakah perlu ditranslate ulang.
              </p>
            </div>

            {/* Incident list */}
            <div style={{ overflowY: 'auto', flexGrow: 1 }}>
              {incidents.map((inc, i) => {
                const fix = fixResults[i]
                return (
                  <div
                    key={i}
                    style={{
                      padding: '12px 16px',
                      borderBottom: i < incidents.length - 1 ? '1px solid var(--color-border)' : undefined,
                    }}
                  >
                    {/* Incident header row */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1px 8px',
                          backgroundColor: '#111',
                          color: '#FFEF33',
                          fontSize: '13px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          letterSpacing: '0.05em',
                          flexShrink: 0,
                          userSelect: 'text',
                          WebkitUserSelect: 'text',
                          cursor: 'text',
                        }}
                      >
                        {inc.chars}
                      </span>
                      {inc.label && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          {inc.label}
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', opacity: 0.7 }}>
                        {inc.chars.length} char{inc.chars.length !== 1 ? 's' : ''}
                      </span>
                      {/* Spacer */}
                      <span style={{ flexGrow: 1 }} />
                      {/* Fix this line button */}
                      <button
                        onClick={() => fixOne(i)}
                        disabled={fix?.status === 'loading'}
                        title="Fix this CJK with AI"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          backgroundColor: fix?.status === 'done' ? 'var(--color-surface-2)' : fix?.status === 'loading' ? 'var(--color-surface-2)' : '#111',
                          color: fix?.status === 'done' ? 'var(--color-text-muted)' : fix?.status === 'loading' ? 'var(--color-text-muted)' : '#FFEF33',
                          border: '1.5px solid var(--color-border)',
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 600,
                          fontSize: '10px',
                          cursor: fix?.status === 'loading' ? 'not-allowed' : 'pointer',
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                        }}
                      >
                        {fix?.status === 'loading'
                          ? <><Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> Fixing</>
                          : fix?.status === 'done'
                            ? <><Wrench size={10} /> Re-fix</>
                            : <><Wrench size={10} /> Fix this</>
                        }
                      </button>
                    </div>

                    {/* Original context */}
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-text)',
                        margin: 0,
                        lineHeight: '1.6',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        backgroundColor: 'var(--color-surface-2)',
                        padding: '6px 10px',
                        border: '1px solid var(--color-border)',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        cursor: 'text',
                      }}
                    >
                      {inc.context}
                    </p>

                    {/* Fix result field */}
                    {fix && (
                      <div
                        style={{
                          marginTop: '6px',
                          padding: '6px 10px',
                          border: fix.status === 'error'
                            ? '1.5px solid #e55'
                            : fix.status === 'loading'
                              ? '1.5px dashed var(--color-border)'
                              : '1.5px solid #2a9',
                          backgroundColor: fix.status === 'error'
                            ? 'rgba(220,50,50,0.07)'
                            : fix.status === 'loading'
                              ? 'transparent'
                              : 'rgba(40,170,120,0.07)',
                          borderRadius: '1px',
                        }}
                      >
                        {fix.status === 'loading' && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />
                            AI sedang memperbaiki...
                          </span>
                        )}
                        {fix.status === 'error' && (
                          <span style={{ fontSize: '11px', color: '#e55' }}>
                            Error: {fix.message}
                          </span>
                        )}
                        {fix.status === 'done' && (
                          <p
                            style={{
                              fontSize: '12px',
                              color: 'var(--color-text)',
                              margin: 0,
                              lineHeight: '1.6',
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              userSelect: 'text',
                              WebkitUserSelect: 'text',
                              cursor: 'text',
                            }}
                          >
                            {fix.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
