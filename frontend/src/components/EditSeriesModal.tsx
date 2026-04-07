/**
 * LWNTL Edit Series Modal
 */

import { useState, useEffect } from 'react'
import { Edit, X } from 'lucide-react'
import { ComboBox } from './ComboBox'
import { DEFAULT_SOURCE_LANGUAGES, DEFAULT_TARGET_LANGUAGES } from '../types'
import type { Series, AppConfig } from '../types'

interface EditSeriesModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (seriesId: string, title: string, language: string, targetLanguage?: string, systemPrompt?: string) => void
  series: Series | null
  config: AppConfig | null
  loading?: boolean
}

export function EditSeriesModal({ open, onClose, onSubmit, series, config, loading }: EditSeriesModalProps) {
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('Japanese')
  const [targetLanguage, setTargetLanguage] = useState('Indonesian')

  const sourceLanguages = config?.sourceLanguages?.length ? config.sourceLanguages : DEFAULT_SOURCE_LANGUAGES
  const targetLanguages = config?.targetLanguages?.length ? config.targetLanguages : DEFAULT_TARGET_LANGUAGES

  useEffect(() => {
    if (open && series) {
      setTitle(series.title)
      setLanguage(series.sourceLanguage)
      setTargetLanguage(series.targetLanguage || 'Indonesian')
    }
  }, [open, series])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !series) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit(series.id, title.trim(), language, targetLanguage)
  }

  return (
    <div className="neo-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="neo-modal" style={{ maxWidth: '440px', animation: 'slideUp 150ms ease' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Edit size={20} />
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px' }}>
                EDIT SERIES
              </h2>
            </div>
            <button onClick={onClose} className="hover:opacity-70" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Nama Series
              </label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="neo-input" autoFocus />
            </div>

            <div className="mb-4">
              <ComboBox
                value={language}
                onChange={setLanguage}
                options={sourceLanguages}
                label="Bahasa Sumber"
                placeholder="Ketik atau pilih bahasa..."
              />
            </div>

            <div className="mb-6">
              <ComboBox
                value={targetLanguage}
                onChange={setTargetLanguage}
                options={targetLanguages}
                label="Bahasa Target"
                placeholder="Ketik atau pilih bahasa..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={loading} className="neo-button" style={{ backgroundColor: '#F0F0F0' }}>
                BATAL
              </button>
              <button type="submit" disabled={!title.trim() || loading} className="neo-button" style={{ opacity: title.trim() && !loading ? 1 : 0.5 }}>
                {loading ? 'MENYIMPAN...' : 'SIMPAN'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}