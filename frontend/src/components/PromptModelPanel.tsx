/**
 * LWNTL Prompt and Worker Panel
 * Center panel: worker selection, system prompt, instruction prompt, sliders
 */

import { useEffect, useState } from 'react'
import { AlertCircle, ExternalLink, Info, RotateCcw, Save } from 'lucide-react'
import { getDefaultSystemPrompt } from '../api'
import { useI18n } from '../i18n'
import { PROVIDERS } from '../types'
import type { AppConfig, Series, WorkerStatus } from '../types'

interface PromptModelPanelProps {
  config: AppConfig | null
  series: Series | null
  instructions: string
  onInstructionsChange: (val: string) => void
  systemPrompt: string
  onSystemPromptChange: (val: string) => void
  onSave: (config: AppConfig, instructions: string, systemPrompt: string, workerId: string) => void
  workerStatuses?: WorkerStatus[]
  loading?: boolean
}

const TEMPLATE_VARS = [
  { variable: '{source_language}', description: 'Bahasa sumber series (contoh: Japanese)' },
  { variable: '{target_language}', description: 'Bahasa target terjemahan (contoh: Indonesian)' },
  { variable: '{title}', description: 'Judul series' },
]

export function PromptModelPanel({
  config,
  series,
  instructions,
  onInstructionsChange,
  systemPrompt,
  onSystemPromptChange,
  onSave,
  workerStatuses = [],
  loading,
}: PromptModelPanelProps) {
  const [workerId, setWorkerId] = useState(series?.workerId || config?.workers?.[0]?.id || '')
  const [temperature, setTemperature] = useState(config?.temperature ?? 0.3)
  const [maxTokens, setMaxTokens] = useState(config?.maxTokensPerIteration ?? 16000)
  const [glossaryPreFilter, setGlossaryPreFilter] = useState(config?.glossaryPreFilter ?? true)
  const [dirty, setDirty] = useState(false)
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [loadingDefault, setLoadingDefault] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    if (!config) return
    setWorkerId(series?.workerId || config.workers?.[0]?.id || '')
    setTemperature(config.temperature)
    setMaxTokens(config.maxTokensPerIteration)
    setGlossaryPreFilter(config.glossaryPreFilter ?? true)
  }, [config, series?.workerId])

  useEffect(() => {
    const targetLang = series?.targetLanguage || 'Indonesian'
    setLoadingDefault(true)
    getDefaultSystemPrompt(targetLang)
      .then(setDefaultPrompt)
      .catch(() => setDefaultPrompt(''))
      .finally(() => setLoadingDefault(false))
  }, [series?.targetLanguage])

  const displayPrompt = systemPrompt.trim() || defaultPrompt
  const isCustomPrompt = systemPrompt.trim().length > 0
  const workers = config?.workers || []
  const selectedWorker = workers.find((w) => w.id === workerId)
  const statusByWorker = new Map(workerStatuses.map((w) => [w.id, w]))
  const selectedStatus = selectedWorker ? statusByWorker.get(selectedWorker.id) : null

  const handleSave = () => {
    if (!config) return
    onSave(
      {
        ...config,
        temperature,
        maxTokensPerIteration: maxTokens,
        glossaryPreFilter,
      },
      instructions,
      systemPrompt,
      workerId,
    )
    setDirty(false)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: '4px 4px 0px var(--color-border)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '2.5px solid var(--color-border)' }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text)' }}>
          {t.seriesSettings.promptModel}
        </span>
        {dirty && (
          <div className="flex items-center gap-1" style={{ color: '#FFEF33' }}>
            <AlertCircle size={12} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{t.seriesSettings.notSaved}</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-5" style={{ minHeight: 0, overflowY: 'auto' }}>
        <div>
          <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
            {t.seriesSettings.worker}
          </label>
          <select
            value={workerId}
            onChange={(e) => { setWorkerId(e.target.value); setDirty(true) }}
            className="neo-input"
            style={{ cursor: 'pointer', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            {workers.map((worker) => {
              const status = statusByWorker.get(worker.id)
              const activeCount = status?.activeCount ?? 0
              const maxConcurrent = status?.maxConcurrent ?? 1
              const busyLabel = activeCount > 0 ? ` - busy (${activeCount}/${maxConcurrent})` : ''
              const providerLabel = PROVIDERS[worker.provider]?.label || worker.provider
              const modelLabel = PROVIDERS[worker.provider]?.displayNames?.[worker.model] || worker.model
              return (
                <option key={worker.id} value={worker.id}>
                  {worker.label} - {modelLabel} ({providerLabel}){busyLabel}
                </option>
              )
            })}
          </select>
          {selectedWorker && !config?.[PROVIDERS[selectedWorker.provider]?.apiKeyName as keyof AppConfig] && (
            <p style={{ fontSize: '11px', color: '#FF3C3C', marginTop: '4px', fontWeight: 600 }}>
              API key worker ini belum diisi - {t.topbar.settings}
            </p>
          )}
          {selectedStatus?.active && (
            <p style={{ fontSize: '11px', color: '#FFEF33', marginTop: '4px', fontWeight: 600 }}>
              Worker sedang aktif ({selectedStatus.activeCount ?? 1}/{selectedStatus.maxConcurrent ?? 1} slot). Slot tersisa untuk series ini jika ada.
            </p>
          )}
        </div>

        {selectedWorker && (
          <div className="flex items-center justify-between gap-3 px-3 py-2" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {PROVIDERS[selectedWorker.provider]?.label || selectedWorker.provider}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>
              {PROVIDERS[selectedWorker.provider]?.displayNames?.[selectedWorker.model] || selectedWorker.model}
            </span>
            {PROVIDERS[selectedWorker.provider]?.docsUrl && (
              <a href={PROVIDERS[selectedWorker.provider]?.docsUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-muted)' }}>
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        )}

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
              {t.seriesSettings.systemPrompt}
            </label>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '10px', fontWeight: 700, color: isCustomPrompt ? '#FFEF33' : '#fff', background: isCustomPrompt ? '#111' : '#28E272', padding: '2px 6px', textTransform: 'uppercase' }}>
                {isCustomPrompt ? t.seriesSettings.custom : t.seriesSettings.default}
              </span>
              <button
                type="button"
                onClick={() => { onSystemPromptChange(''); setDirty(true) }}
                className="flex items-center gap-1"
                style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', border: 'none', background: 'transparent', cursor: 'pointer', textTransform: 'uppercase' }}
                title="Reset ke default template"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </div>
          <textarea
            value={displayPrompt}
            onChange={(e) => { onSystemPromptChange(e.target.value); setDirty(true) }}
            placeholder={loadingDefault ? t.common.loading : 'System prompt...'}
            className="neo-textarea"
            style={{ minHeight: '200px', fontSize: '12px', fontFamily: "'Inter', monospace", backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          />
          <div className="mt-2 p-2.5" style={{ backgroundColor: 'var(--color-surface-2)', border: '2px solid var(--color-separator)', fontSize: '11px' }}>
            <div className="flex items-center gap-1 mb-1.5" style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>
              <Info size={11} /> {t.seriesSettings.templateVars}
            </div>
            <div className="space-y-0.5">
              {TEMPLATE_VARS.map((tv) => (
                <div key={tv.variable} className="flex items-start gap-2">
                  <code style={{ fontFamily: "'Space Grotesk', monospace", fontWeight: 700, color: '#00F7FF', backgroundColor: '#111', padding: '1px 5px', fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {tv.variable}
                  </code>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{tv.description}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '6px', color: 'var(--color-text-subtle)', fontSize: '10px', lineHeight: 1.4 }}>
              {t.seriesSettings.templateVarsDesc}
            </p>
          </div>
        </div>

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        <div>
          <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
            {t.seriesSettings.instructionPrompt}
          </label>
          <textarea
            value={instructions}
            onChange={(e) => { onInstructionsChange(e.target.value); setDirty(true) }}
            placeholder={t.seriesSettings.instructionPlaceholder}
            className="neo-textarea"
            style={{ minHeight: '80px', fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          />
          <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
            {t.seriesSettings.instructionDesc}
          </p>
        </div>

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>{t.seriesSettings.maxTokens}</label>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>{maxTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={1000} max={128000} step={1000} value={maxTokens} onChange={(e) => { setMaxTokens(parseInt(e.target.value)); setDirty(true) }} className="flex-1" style={{ accentColor: '#00F7FF' }} />
            <input type="number" value={maxTokens} onChange={(e) => { setMaxTokens(parseInt(e.target.value) || 16000); setDirty(true) }} className="neo-input" style={{ width: '90px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} min={1000} max={128000} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>{t.seriesSettings.temperature}</label>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>{temperature.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value)); setDirty(true) }} className="flex-1" style={{ accentColor: '#00F7FF' }} />
            <input type="number" value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value) || 0.3); setDirty(true) }} className="neo-input" style={{ width: '70px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} min={0} max={1} step={0.1} />
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2.5" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text)' }}>
              {t.seriesSettings.glossaryPreFilter}
            </span>
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {t.seriesSettings.glossaryPreFilterDesc}
            </p>
          </div>
          <button
            onClick={() => { setGlossaryPreFilter(v => !v); setDirty(true) }}
            style={{ flexShrink: 0, marginLeft: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, border: '2px solid var(--color-border)', backgroundColor: glossaryPreFilter ? '#28E272' : 'var(--color-surface)', color: glossaryPreFilter ? '#111' : 'var(--color-text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px' }}
          >
            {glossaryPreFilter ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div style={{ borderTop: '2.5px solid var(--color-border)', padding: '12px 16px' }}>
        <button onClick={handleSave} disabled={loading} className="neo-button flex items-center justify-center gap-2 w-full" style={{ opacity: loading ? 0.5 : 1 }}>
          <Save size={16} />
          {loading ? t.common.saving : t.seriesSettings.saveSettings}
        </button>
      </div>
    </div>
  )
}
