/**
 * LWNTL Prompt and Model Panel
 * Center panel: provider/model dropdowns, system prompt, instruction prompt, sliders
 */

import { useState, useEffect } from 'react'
import { Save, AlertCircle, RotateCcw, Info, ExternalLink } from 'lucide-react'
import { PROVIDERS } from '../types'
import { getDefaultSystemPrompt } from '../api'
import type { AppConfig, Series } from '../types'

interface PromptModelPanelProps {
  config: AppConfig | null
  series: Series | null
  instructions: string
  onInstructionsChange: (val: string) => void
  systemPrompt: string
  onSystemPromptChange: (val: string) => void
  onSave: (config: AppConfig, instructions: string, systemPrompt: string) => void
  loading?: boolean
}

const TEMPLATE_VARS = [
  { variable: '{source_language}', description: 'Bahasa sumber series (contoh: Japanese)' },
  { variable: '{target_language}', description: 'Bahasa target terjemahan (contoh: Indonesian)' },
  { variable: '{title}', description: 'Judul series' },
]

export function PromptModelPanel({
  config, series, instructions, onInstructionsChange,
  systemPrompt, onSystemPromptChange, onSave, loading,
}: PromptModelPanelProps) {
  const [provider, setProvider] = useState(config?.provider || 'zhipuai')
  const [model, setModel] = useState(config?.model || 'glm-5')
  const [customModel, setCustomModel] = useState(config?.customModels?.[config?.provider || 'zhipuai'] || '')
  const [temperature, setTemperature] = useState(config?.temperature ?? 0.3)
  const [maxTokens, setMaxTokens] = useState(config?.maxTokensPerIteration ?? 16000)
  const [dirty, setDirty] = useState(false)
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [loadingDefault, setLoadingDefault] = useState(false)

  useEffect(() => {
    if (config) {
      setProvider(config.provider)
      setModel(config.model)
      setCustomModel(config.customModels?.[config.provider] || '')
      setTemperature(config.temperature)
      setMaxTokens(config.maxTokensPerIteration)
    }
  }, [config])

  useEffect(() => {
    const targetLang = series?.targetLanguage || 'Indonesian'
    setLoadingDefault(true)
    getDefaultSystemPrompt(targetLang)
      .then((p) => setDefaultPrompt(p))
      .catch(() => setDefaultPrompt(''))
      .finally(() => setLoadingDefault(false))
  }, [series?.targetLanguage])

  const displayPrompt = systemPrompt.trim() || defaultPrompt
  const isCustomPrompt = systemPrompt.trim().length > 0
  const isCustomModel = model === 'custom'

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider as AppConfig['provider'])
    const models = PROVIDERS[newProvider]?.models || []
    const firstModel = models[0] || ''
    setModel(firstModel)
    setCustomModel(config?.customModels?.[newProvider] || '')
    setDirty(true)
  }

  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    setDirty(true)
  }

  const handleCustomModelChange = (val: string) => {
    setCustomModel(val)
    setDirty(true)
  }

  const handleSave = () => {
    if (!config) return
    const newCustomModels = { ...(config.customModels || {}) }
    if (isCustomModel && customModel.trim()) {
      newCustomModels[provider] = customModel.trim()
    }
    const nc: AppConfig = {
      ...config,
      provider: provider as AppConfig['provider'],
      model,
      customModels: newCustomModels,
      temperature,
      maxTokensPerIteration: maxTokens,
    }
    onSave(nc, instructions, systemPrompt)
    setDirty(false)
  }

  const currentModels = PROVIDERS[provider]?.models || []
  const displayNames = PROVIDERS[provider]?.displayNames || {}
  const providerLabel = PROVIDERS[provider]?.label || provider
  const docsUrl = PROVIDERS[provider]?.docsUrl

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: '4px 4px 0px var(--color-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '2.5px solid var(--color-border)' }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text)' }}>
          PROMPT & MODEL
        </span>
        {dirty && (
          <div className="flex items-center gap-1" style={{ color: '#FFEF33' }}>
            <AlertCircle size={12} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Belum Disimpan</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 space-y-5" style={{ minHeight: 0, overflowY: 'auto' }}>
        {/* Provider */}
        <div>
          <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="neo-input"
            style={{ cursor: 'pointer', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            {Object.entries(PROVIDERS).map(([key, p]) => (
              <option key={key} value={key}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
              Model
            </label>
            {docsUrl && (
              <a
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: 600 }}
              >
                <ExternalLink size={10} /> Daftar Model {providerLabel}
              </a>
            )}
          </div>
          <select
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            className="neo-input"
            style={{ cursor: 'pointer', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          >
            {currentModels.map((m) => (
              <option key={m} value={m}>{displayNames[m] || m}</option>
            ))}
          </select>

          {/* Custom model input */}
          {isCustomModel && (
            <div className="mt-2">
              <input
                type="text"
                value={customModel}
                onChange={(e) => handleCustomModelChange(e.target.value)}
                placeholder={`Nama model ${providerLabel}...`}
                className="neo-input"
                style={{ fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              />
              <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '3px' }}>
                Nama model kustom akan disimpan per-provider.
              </p>
            </div>
          )}
        </div>

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        {/* System Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
              System Prompt
            </label>
            <div className="flex items-center gap-2">
              {isCustomPrompt ? (
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFEF33', background: '#111', padding: '2px 6px', textTransform: 'uppercase' }}>Custom</span>
              ) : (
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: '#28E272', padding: '2px 6px', textTransform: 'uppercase' }}>Default</span>
              )}
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
            placeholder={loadingDefault ? 'Memuat template default...' : 'System prompt template...'}
            className="neo-textarea"
            style={{ minHeight: '200px', fontSize: '12px', fontFamily: "'Inter', monospace", backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          />
          {/* Template Variable Guide */}
          <div className="mt-2 p-2.5" style={{ backgroundColor: 'var(--color-surface-2)', border: '2px solid var(--color-separator)', fontSize: '11px' }}>
            <div className="flex items-center gap-1 mb-1.5" style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>
              <Info size={11} /> TEMPLATE VARIABLES
            </div>
            <div className="space-y-0.5">
              {TEMPLATE_VARS.map((tv) => (
                <div key={tv.variable} className="flex items-start gap-2">
                  <code style={{
                    fontFamily: "'Space Grotesk', monospace",
                    fontWeight: 700,
                    color: '#00F7FF',
                    backgroundColor: '#111',
                    padding: '1px 5px',
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {tv.variable}
                  </code>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{tv.description}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '6px', color: 'var(--color-text-subtle)', fontSize: '10px', lineHeight: 1.4 }}>
              Variabel akan otomatis diganti saat terjemahan berjalan. Glossary dan context memory ditambahkan otomatis di bawah prompt.
            </p>
          </div>
        </div>

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        {/* Instruction Prompt */}
        <div>
          <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
            Instruction Prompt (Per-Series)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => { onInstructionsChange(e.target.value); setDirty(true) }}
            placeholder="Pertahankan honorifik -san, -kun..."
            className="neo-textarea"
            style={{ minHeight: '80px', fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
          />
          <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
            Instruksi khusus untuk series ini. Akan ditambahkan ke system prompt.
          </p>
        </div>

        <div style={{ height: '2px', backgroundColor: 'var(--color-separator)' }} />

        {/* Max Tokens */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>Max Tokens</label>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>{maxTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={1000} max={128000} step={1000} value={maxTokens} onChange={(e) => { setMaxTokens(parseInt(e.target.value)); setDirty(true) }} className="flex-1" style={{ accentColor: '#00F7FF' }} />
            <input type="number" value={maxTokens} onChange={(e) => { setMaxTokens(parseInt(e.target.value) || 16000); setDirty(true) }} className="neo-input" style={{ width: '90px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} min={1000} max={128000} />
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>Temperature</label>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>{temperature.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value)); setDirty(true) }} className="flex-1" style={{ accentColor: '#00F7FF' }} />
            <input type="number" value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value) || 0.3); setDirty(true) }} className="neo-input" style={{ width: '70px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }} min={0} max={1} step={0.1} />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ borderTop: '2.5px solid var(--color-border)', padding: '12px 16px' }}>
        <button onClick={handleSave} disabled={loading} className="neo-button flex items-center justify-center gap-2 w-full" style={{ opacity: loading ? 0.5 : 1 }}>
          <Save size={16} />
          {loading ? 'MENYIMPAN...' : 'SIMPAN PENGATURAN'}
        </button>
      </div>
    </div>
  )
}
