/**
 * LWNTL Prompt and Model Panel
 * Center panel: provider/model dropdowns, system prompt with template vars, instruction prompt, sliders
 */

import { useState, useEffect } from 'react'
import { Save, AlertCircle, RotateCcw, Info } from 'lucide-react'
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
  const [temperature, setTemperature] = useState(config?.temperature ?? 0.3)
  const [maxTokens, setMaxTokens] = useState(config?.maxTokensPerIteration ?? 16000)
  const [dirty, setDirty] = useState(false)
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [loadingDefault, setLoadingDefault] = useState(false)

  useEffect(() => {
    if (config) {
      setProvider(config.provider)
      setModel(config.model)
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
  const isCustom = systemPrompt.trim().length > 0

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider as 'zhipuai' | 'qwen')
    const models = PROVIDERS[newProvider]?.models || []
    if (models.length > 0 && !models.includes(model)) {
      setModel(models[0])
    }
    setDirty(true)
  }

  const handleSave = () => {
    if (!config) return
    const nc: AppConfig = {
      ...config,
      provider: provider as 'zhipuai' | 'qwen',
      model,
      temperature,
      maxTokensPerIteration: maxTokens,
    }
    onSave(nc, instructions, systemPrompt)
    setDirty(false)
  }

  const handleSystemPromptChange = (val: string) => {
    onSystemPromptChange(val)
    setDirty(true)
  }

  const currentModels = PROVIDERS[provider]?.models || []
  const displayNames = PROVIDERS[provider]?.displayNames || {}

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: '#fff', border: '2.5px solid #111', boxShadow: '4px 4px 0px #111' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '2.5px solid #111' }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
          <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>
            Provider
          </label>
          <select value={provider} onChange={(e) => handleProviderChange(e.target.value)} className="neo-input" style={{ cursor: 'pointer' }}>
            <option value="zhipuai">ZhipuAI (Z.AI)</option>
            <option value="qwen">Alibaba Cloud (Qwen)</option>
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>
            Model
          </label>
          <select value={model} onChange={(e) => { setModel(e.target.value); setDirty(true) }} className="neo-input" style={{ cursor: 'pointer' }}>
            {currentModels.map((m) => (
              <option key={m} value={m}>{displayNames[m] || m}</option>
            ))}
          </select>
        </div>

        <div style={{ height: '2px', backgroundColor: '#eee' }} />

        {/* System Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>
              System Prompt
            </label>
            <div className="flex items-center gap-2">
              {isCustom ? (
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFEF33', background: '#111', padding: '2px 6px', textTransform: 'uppercase' }}>Custom</span>
              ) : (
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: '#28E272', padding: '2px 6px', textTransform: 'uppercase' }}>Default</span>
              )}
              <button
                type="button"
                onClick={() => { onSystemPromptChange(''); setDirty(true) }}
                className="flex items-center gap-1"
                style={{ fontSize: '10px', fontWeight: 700, color: '#666', border: 'none', background: 'transparent', cursor: 'pointer', textTransform: 'uppercase' }}
                title="Reset ke default template"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </div>
          <textarea
            value={displayPrompt}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder={loadingDefault ? 'Memuat template default...' : 'System prompt template...'}
            className="neo-textarea"
            style={{ minHeight: '200px', fontSize: '12px', fontFamily: "'Inter', monospace" }}
          />
          {/* Template Variable Guide */}
          <div className="mt-2 p-2.5" style={{ backgroundColor: '#f8f8f0', border: '2px solid #ddd', fontSize: '11px' }}>
            <div className="flex items-center gap-1 mb-1.5" style={{ fontWeight: 700, color: '#666' }}>
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
                  <span style={{ color: '#888', fontSize: '11px' }}>{tv.description}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '6px', color: '#aaa', fontSize: '10px', lineHeight: 1.4 }}>
              Variabel akan otomatis diganti saat terjemahan berjalan. Glossary dan context memory ditambahkan otomatis di bawah prompt.
            </p>
          </div>
        </div>

        <div style={{ height: '2px', backgroundColor: '#eee' }} />

        {/* Instruction Prompt */}
        <div>
          <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>
            Instruction Prompt (Per-Series)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => { onInstructionsChange(e.target.value); setDirty(true) }}
            placeholder="Pertahankan honorifik -san, -kun..."
            className="neo-textarea"
            style={{ minHeight: '80px', fontSize: '13px' }}
          />
          <p style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
            Instruksi khusus untuk series ini. Akan ditambahkan ke system prompt.
          </p>
        </div>

        <div style={{ height: '2px', backgroundColor: '#eee' }} />

        {/* Max Tokens */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>Max Tokens</label>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{maxTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={1000} max={128000} step={1000} value={maxTokens} onChange={(e) => { setMaxTokens(parseInt(e.target.value)); setDirty(true) }} className="flex-1" style={{ accentColor: '#00F7FF' }} />
            <input type="number" value={maxTokens} onChange={(e) => { setMaxTokens(parseInt(e.target.value) || 16000); setDirty(true) }} className="neo-input" style={{ width: '90px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }} min={1000} max={128000} />
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>Temperature</label>
            <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{temperature.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value)); setDirty(true) }} className="flex-1" style={{ accentColor: '#00F7FF' }} />
            <input type="number" value={temperature} onChange={(e) => { setTemperature(parseFloat(e.target.value) || 0.3); setDirty(true) }} className="neo-input" style={{ width: '70px', padding: '4px 8px', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }} min={0} max={1} step={0.1} />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ borderTop: '2.5px solid #111', padding: '12px 16px' }}>
        <button onClick={handleSave} disabled={loading} className="neo-button flex items-center justify-center gap-2 w-full" style={{ opacity: loading ? 0.5 : 1 }}>
          <Save size={16} />
          {loading ? 'MENYIMPAN...' : 'SIMPAN PENGATURAN'}
        </button>
      </div>
    </div>
  )
}