/**
 * CJKBubble — floating QC indicator for CJK characters in translated text
 * Shows incident count; click opens a modal listing each occurrence with context
 */

import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import type { CJKIncident } from '../utils/cjkDetector'

interface Props {
  incidents: CJKIncident[]
}

export default function CJKBubble({ incidents }: Props) {
  const [open, setOpen] = useState(false)

  if (incidents.length === 0) return null

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
              width: '520px',
              maxWidth: '92vw',
              maxHeight: '75vh',
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
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#111', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Description */}
            <div style={{ padding: '10px 16px', borderBottom: '1.5px solid var(--color-border)', flexShrink: 0, backgroundColor: 'var(--color-surface-2)' }}>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0, lineHeight: '1.5' }}>
                Karakter CJK yang terdeteksi dalam hasil terjemahan. Ini bisa menandakan noise/bias AI — periksa manual apakah perlu ditranslate ulang.
              </p>
            </div>

            {/* Incident list */}
            <div style={{ overflowY: 'auto', flexGrow: 1 }}>
              {incidents.map((inc, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 16px',
                    borderBottom: i < incidents.length - 1 ? '1px solid var(--color-border)' : undefined,
                  }}
                >
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
                  </div>
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
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
