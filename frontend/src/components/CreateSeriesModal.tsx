import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
/**
 * LWNTL Create Series Modal
 */

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { ComboBox } from './ComboBox'
import { DEFAULT_SOURCE_LANGUAGES, DEFAULT_TARGET_LANGUAGES } from '../types'
import { useI18n } from '../i18n'
import type { AppConfig } from '../types'

interface CreateSeriesModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (title: string, language: string, targetLanguage: string) => void
  config: AppConfig | null
  loading?: boolean
}

export function CreateSeriesModal({ open, onClose, onSubmit, config, loading }: CreateSeriesModalProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('Japanese')
  const [targetLanguage, setTargetLanguage] = useState('Indonesian')

  const sourceLanguages = config?.sourceLanguages?.length ? config.sourceLanguages : DEFAULT_SOURCE_LANGUAGES
  const targetLanguages = config?.targetLanguages?.length ? config.targetLanguages : DEFAULT_TARGET_LANGUAGES

  useEffect(() => {
    if (open) {
      setTitle('')
      setLanguage(sourceLanguages[0] || 'Japanese')
      setTargetLanguage(targetLanguages[0] || 'Indonesian')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit(title.trim(), language, targetLanguage)
  }

  return (
    <ModalSurface label="Create series" onClose={onClose}
      className="ui-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="ui-modal" style={{ maxWidth: '440px', animation: 'slideUp 150ms ease' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Plus size={20} />
              <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '20px' }}>
                {t.home.addSeries.replace('+ ', '')}
              </h2>
            </div>
            <Button aria-label="Close" variant="ghost" onClick={onClose} className="hover:opacity-70" style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={20} />
            </Button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <Label htmlFor="create-series-title" className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>
                {t.modal.seriesTitle}
              </Label>
              <Input aria-label={t.modal.seriesTitle}
                id="create-series-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.modal.seriesTitlePlaceholder}
                className="ui-input"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <ComboBox
                value={language}
                onChange={setLanguage}
                options={sourceLanguages}
                label={t.modal.sourceLanguage}
                placeholder={t.modal.sourceLanguage + '...'}
              />
            </div>

            <div className="mb-6">
              <ComboBox
                value={targetLanguage}
                onChange={setTargetLanguage}
                options={targetLanguages}
                label={t.modal.targetLanguage}
                placeholder={t.modal.targetLanguage + '...'}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={onClose} disabled={loading} className="" style={{ color: 'var(--foreground)',  backgroundColor: 'var(--bg-surface-2,#F0F0F0)' }}>
                {t.common.cancel}
              </Button>
              <Button variant="default"
                type="submit"
                disabled={!title.trim() || loading}
                className=""
                style={{ opacity: title.trim() && !loading ? 1 : 0.5 }}
              >
                {loading ? t.common.loading : t.modal.create}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalSurface>
  )
}
