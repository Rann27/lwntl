/**
 * ProfileTemplatesModal
 * Edit per-profile system prompt and instructions prompt templates.
 */

import { useState, useEffect } from 'react'
import { X, FileCode2, Save, Info } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { getProfileTemplates, saveProfileTemplates } from '../api'

interface Props {
  open: boolean
  onClose: () => void
}

const TEMPLATE_VARS = [
  { variable: '{source_language}', description: 'Bahasa sumber series (contoh: Japanese)' },
  { variable: '{target_language}', description: 'Bahasa target terjemahan (contoh: Indonesian)' },
  { variable: '{title}', description: 'Judul series' },
]

export function ProfileTemplatesModal({ open, onClose }: Props) {
  const profiles = useAppStore((s) => s.profiles)

  const [systemPrompt, setSystemPrompt] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    setSaved(false)
    getProfileTemplates()
      .then((t) => {
        setSystemPrompt(t.systemPromptTemplate)
        setInstructions(t.instructionsTemplate)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await saveProfileTemplates(systemPrompt, instructions)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 'min(760px, 95vw)',
        maxHeight: '90vh',
        backgroundColor: 'var(--color-surface)',
        border: '2.5px solid var(--color-border)',
        boxShadow: 'var(--neo-shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <FileCode2 size={16} style={{ color: '#00F7FF' }} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Template Prompt
            </span>
            {profiles.active && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#00F7FF', border: '1.5px solid #00F7FF', padding: '1px 7px', fontFamily: 'monospace' }}>
                {profiles.active}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Template variable reference */}
        <div className="flex items-start gap-2 px-5 py-2" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(0,247,255,0.04)', flexShrink: 0 }}>
          <Info size={13} style={{ color: '#00F7FF', marginTop: '1px', flexShrink: 0 }} />
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {TEMPLATE_VARS.map((v) => (
              <span key={v.variable} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <code style={{ color: '#00F7FF', fontFamily: 'monospace', fontSize: '11px' }}>{v.variable}</code>
                {' — '}{v.description}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Memuat...</span>
            </div>
          ) : (
            <>
              {/* System Prompt Template */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: "'Space Grotesk', sans-serif" }}>
                    System Prompt Template
                  </label>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    — digunakan jika series tidak punya custom system prompt
                  </span>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin menggunakan system prompt default..."
                  rows={12}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    border: '2px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Instructions Template */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: "'Space Grotesk', sans-serif" }}>
                    Instructions Template
                  </label>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    — digunakan jika series tidak punya custom instructions
                  </span>
                </div>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin instructions default..."
                  rows={6}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    border: '2px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '2px solid var(--color-border)', flexShrink: 0 }}>
          <div>
            {error && <p style={{ fontSize: '12px', color: '#FF3C3C', fontWeight: 600 }}>{error}</p>}
            {saved && <p style={{ fontSize: '12px', color: '#28E272', fontWeight: 700 }}>✓ Tersimpan</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="neo-button" style={{ backgroundColor: 'var(--color-surface-2)', fontSize: '12px' }}>
              TUTUP
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="neo-button flex items-center gap-1.5"
              style={{ backgroundColor: '#FFCF77', fontSize: '12px', opacity: (saving || loading) ? 0.5 : 1 }}
            >
              <Save size={13} />
              {saving ? 'MENYIMPAN...' : 'SIMPAN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
