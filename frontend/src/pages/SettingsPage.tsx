/**
 * LWNTL Settings Page
 * Tabs: General (app language, theme, language lists), Providers & API (one card
 * per provider in a responsive grid, ChatGPT plan sign-in), Workers (worker
 * cards with live model lists). The selected tab is remembered per browser.
 */

import { useState, useEffect } from 'react'
import { Eye, EyeOff, Plus, X, Globe, Languages, ExternalLink, Sun, Moon, TestTube, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Topbar } from '../components/Topbar'
import { useAppStore } from '../store/appStore'
import { saveConfig, testConfig as testConfigApi } from '../api'
import { useToast } from '../hooks/useToast'
import { PROVIDERS } from '../types'
import type { EffortSetting } from '../types'
import { ModelPicker } from '../components/ModelPicker'
import { ChatGPTCard, ChatGPTPlanBadge } from '../components/ChatGPTCard'
import { resetProviderModels } from '../hooks/useProviderModels'
import { RequestParamsPreview } from '../components/RequestParamsPreview'
import type { AppConfig, WorkerProfile, DeepSeekApiKeyEntry } from '../types'
import { useI18n, LANGUAGE_OPTIONS, type Language } from '../i18n'

const API_KEY_FIELDS: Array<{
  provider: string
  field: keyof AppConfig
  label: string
  hasBaseUrl?: boolean
  hasThinkingToggle?: boolean
}> = [
  { provider: 'zhipuai',      field: 'zhipuaiApiKey',      label: 'ZhipuAI (Z.AI)', hasThinkingToggle: true },
  { provider: 'qwen',         field: 'qwenApiKey',         label: 'Alibaba Cloud (Qwen/DS)' },
  { provider: 'openai',       field: 'openaiApiKey',       label: 'OpenAI' },
  { provider: 'gemini',       field: 'geminiApiKey',       label: 'Google Gemini' },
  { provider: 'anthropic',    field: 'anthropicApiKey',    label: 'Anthropic (Claude)' },
  { provider: 'xai',          field: 'xaiApiKey',          label: 'xAI (Grok)' },
  { provider: 'moonshot',     field: 'moonshotApiKey',     label: 'Moonshot AI (Kimi)' },
  { provider: 'deepseek',     field: 'deepseekApiKey',     label: 'DeepSeek', hasThinkingToggle: true },
  { provider: 'mimo',         field: 'mimoApiKey',         label: 'Xiaomi MiMo', hasThinkingToggle: true },
  { provider: 'experiential', field: 'experientialApiKey', label: 'Experiential Labs' },
  { provider: 'uncensoredllm', field: 'uncensoredllmApiKey', label: 'UncensoredLLM' },
  { provider: 'openrouter',   field: 'openrouterApiKey',   label: 'OpenRouter' },
  { provider: 'openaicompat', field: 'openaicompatApiKey', label: 'OpenAI Compatible', hasBaseUrl: true },
]

type SettingsTab = 'general' | 'providers' | 'workers'
const TAB_KEY = 'lwntl.settingsTab'

function readTab(): SettingsTab {
  try {
    const v = localStorage.getItem(TAB_KEY)
    if (v === 'general' || v === 'providers' || v === 'workers') return v
  } catch { /* storage unavailable */ }
  return 'general'
}

/** Cards flow into as many columns as the window allows, one column on narrow windows. */
const gridStyle = (min: number): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))`,
  gap: '20px',
  alignItems: 'start',
})

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow)', minWidth: 0,
}

export function SettingsPage() {
  const { config, setConfig } = useAppStore()
  const toast = useToast()
  const { t } = useI18n()
  const [tab, setTabState] = useState<SettingsTab>(readTab)
  const setTab = (next: SettingsTab) => {
    setTabState(next)
    try { localStorage.setItem(TAB_KEY, next) } catch { /* storage unavailable */ }
  }
  const tabs: [SettingsTab, string][] = [
    ['general', t.settings.tabGeneral], ['providers', t.settings.tabProviders], ['workers', t.settings.tabWorkers],
  ]

  const handleSave = async (newConfig: AppConfig) => {
    try {
      await saveConfig(newConfig)
      setConfig(newConfig)
      toast.success(t.settings.saveSuccess)
    } catch {
      toast.error(t.settings.saveFailed)
    }
  }

  return (
    <div className="app-layout">
      <Topbar showBack title={t.settings.title} />

      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="flex flex-col gap-5" style={{ width: '100%', maxWidth: '1320px', margin: '0 auto', padding: 'clamp(12px, 3vw, 32px)' }}>

          {/* Tabs */}
          <div className="flex flex-wrap self-start" style={{ ...cardStyle }}>
            {tabs.map(([key, label], i) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: '9px 18px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                border: 'none', borderLeft: i ? '2.5px solid var(--color-border)' : 'none', cursor: 'pointer',
                backgroundColor: tab === key ? 'var(--color-primary)' : 'transparent', color: tab === key ? '#111' : 'var(--color-text)',
              }}>{label}</button>
            ))}
          </div>

          {!config && <p style={{ color: 'var(--color-text-subtle)', fontSize: '14px' }}>{t.common.loading}</p>}

          {config && tab === 'general' && (
            <div style={gridStyle(380)}>
              <AppLanguageSection config={config} onSave={handleSave} />
              <ThemeSection config={config} onSave={handleSave} />
              <div className="p-6" style={cardStyle}>
                <h2 className="flex items-center gap-2 mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
                  <Languages size={20} />
                  {t.settings.languages}
                </h2>
                <LanguageForm config={config} onSave={handleSave} />
              </div>
            </div>
          )}

          {config && tab === 'providers' && (
            <>
              <div>
                <h2 className="mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
                  {t.settings.apiKeys}
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {t.settings.apiKeysDesc} <strong>{PROVIDERS[config.provider || 'zhipuai']?.label}</strong>
                </p>
              </div>
              <ApiKeysForm config={config} onSave={handleSave} />
            </>
          )}

          {config && tab === 'workers' && <WorkerSection config={config} onSave={handleSave} />}
        </div>
      </main>
    </div>
  )
}

// Worker Section

function WorkerSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
  const [workers, setWorkers] = useState<WorkerProfile[]>(config.workers || [])
  const [saving, setSaving] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    setWorkers(config.workers || [])
  }, [config.workers])

  const updateWorker = (id: string, patch: Partial<WorkerProfile>) => {
    setWorkers(prev => prev.map(w => {
      if (w.id !== id) return w
      const next = { ...w, ...patch }
      if (patch.provider) {
        const models = PROVIDERS[patch.provider]?.models || []
        next.model = patch.provider === 'openaicompat' ? '' : (models[0] || '')
      }
      return next
    }))
  }

  const addWorker = () => {
    const provider = config.provider || 'zhipuai'
    const models = PROVIDERS[provider]?.models || []
    setWorkers(prev => [
      ...prev,
      {
        id: crypto.randomUUID?.() || `${Date.now()}`,
        label: `worker ${prev.length + 1}`,
        provider,
        model: provider === 'openaicompat' ? (config.model || '') : (models[0] || config.model || ''),
        maxConcurrent: 1,
      },
    ])
  }

  const removeWorker = (id: string) => {
    if (workers.length <= 1) return
    setWorkers(prev => prev.filter(w => w.id !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    const normalized = workers.map((w, i) => ({
      ...w,
      label: w.label.trim() || `worker ${i + 1}`,
      model: w.model.trim(),
      maxConcurrent: Math.max(1, w.maxConcurrent ?? 1),
    }))
    await onSave({ ...config, workers: normalized })
    setSaving(false)
  }

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow)' }}>
      <div className="flex items-center justify-between mb-2">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
          WORKERS
        </h2>
        <button onClick={addWorker} className="neo-button flex items-center gap-1" style={{ padding: '6px 12px', fontSize: '12px' }}>
          <Plus size={14} /> {t.common.add}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        Setiap worker adalah slot AI terpisah. Worker tidak terkunci ke satu series — setiap request menggunakan worker dengan slot tersedia (prioritas ke worker pilihan series). Naikkan <strong>Max Concurrent</strong> untuk menjalankan beberapa translasi sekaligus dalam satu worker.
      </p>

      <div style={gridStyle(340)}>
        {workers.map((worker, index) => {
          return (
            <div key={worker.id} className="p-3" style={{ border: '2px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={worker.label}
                  onChange={(e) => updateWorker(worker.id, { label: e.target.value })}
                  placeholder={`worker ${index + 1}`}
                  className="neo-input flex-1"
                  style={{ padding: '6px 10px', fontSize: '13px' }}
                />
                <button
                  onClick={() => removeWorker(worker.id)}
                  disabled={workers.length <= 1}
                  style={{ border: '2px solid var(--color-border)', background: '#FF3C3C', color: '#fff', padding: '7px', opacity: workers.length <= 1 ? 0.4 : 1, cursor: workers.length <= 1 ? 'not-allowed' : 'pointer' }}
                  title="Remove worker"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <select
                  value={worker.provider}
                  onChange={(e) => updateWorker(worker.id, { provider: e.target.value as WorkerProfile['provider'] })}
                  className="neo-input"
                  style={{ padding: '6px 10px', fontSize: '13px', backgroundColor: 'var(--color-surface)' }}
                >
                  {Object.entries(PROVIDERS).map(([key, provider]) => {
                    const apiKeyField = provider.apiKeyName as keyof AppConfig
                    const hasKey = !!(config[apiKeyField] as string)
                    return (
                      <option key={key} value={key} disabled={!hasKey && key !== 'openaicompat'}>
                        {provider.label}{!hasKey && key !== 'openaicompat' ? (key === 'chatgpt' ? ' (belum terhubung)' : ' (no key)') : ''}
                      </option>
                    )
                  })}
                </select>

                <ModelPicker provider={worker.provider} value={worker.model} onChange={(id) => updateWorker(worker.id, { model: id })} />
              </div>

              <RequestParamsPreview provider={worker.provider} model={worker.model} revision={config} />
              {worker.provider === 'chatgpt' && <div className="mt-2"><ChatGPTPlanBadge /></div>}

              {worker.provider === 'deepseek' && config.deepseekApiKeys?.length > 1 && (
                <div className="flex items-center gap-2 mt-2">
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    DeepSeek Key
                  </label>
                  <select
                    value={worker.deepseekApiKeyId || ''}
                    onChange={e => updateWorker(worker.id, { deepseekApiKeyId: e.target.value || undefined })}
                    className="neo-input flex-1"
                    style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: 'var(--color-surface)' }}
                  >
                    <option value="">Default ({config.deepseekApiKeys[0]?.label})</option>
                    {config.deepseekApiKeys.map(k => (
                      <option key={k.id} value={k.id}>{k.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  Max Concurrent
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={worker.maxConcurrent ?? 1}
                  onChange={(e) => updateWorker(worker.id, { maxConcurrent: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                  className="neo-input"
                  style={{ width: '70px', padding: '4px 8px', fontSize: '13px', backgroundColor: 'var(--color-surface)', textAlign: 'center' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--color-text-subtle)' }}>
                  jobs sekaligus (1–10)
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={handleSave} disabled={saving || workers.some(w => !w.model.trim())} className="neo-button w-full mt-4" style={{ opacity: saving ? 0.5 : 1 }}>
        {saving ? t.common.saving : 'SIMPAN WORKERS'}
      </button>
    </div>
  )
}

// ─── App Language Section ────────────────────────────────────────────────────

function AppLanguageSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
  const [saving, setSaving] = useState(false)
  const { t, setLanguage, language } = useI18n()

  const handleChange = async (lang: Language) => {
    setSaving(true)
    setLanguage(lang)
    await onSave({ ...config, uiLanguage: lang })
    setSaving(false)
  }

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow)' }}>
      <h2 className="flex items-center gap-2 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
        <Globe size={20} />
        {t.settings.appLanguage}
      </h2>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        {t.settings.appLanguageDesc}
      </p>
      <div className="flex items-center gap-3">
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            disabled={saving}
            style={{
              flex: 1,
              padding: '14px',
              border: `2.5px solid var(--color-border)`,
              boxShadow: language === opt.value ? 'var(--neo-shadow)' : 'none',
              backgroundColor: language === opt.value ? 'var(--color-primary)' : 'var(--color-surface-2)',
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '13px',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {opt.flag} {opt.label}
          </button>
        ))}
      </div>
      {saving && <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>{t.common.saving}</p>}
    </div>
  )
}

// ─── Theme Section ────────────────────────────────────────────────────────────

function ThemeSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
  const [theme, setTheme] = useState(config.theme || 'light')
  const [saving, setSaving] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    setTheme(config.theme || 'light')
  }, [config.theme])

  const handleSave = async (newTheme: string) => {
    setTheme(newTheme)
    setSaving(true)
    await onSave({ ...config, theme: newTheme })
    setSaving(false)
  }

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow)' }}>
      <h2 className="mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
        {t.settings.appearance}
      </h2>
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleSave('light')}
          disabled={saving}
          style={{
            flex: 1,
            padding: '14px',
            border: `2.5px solid var(--color-border)`,
            boxShadow: theme === 'light' ? 'var(--neo-shadow)' : 'none',
            backgroundColor: theme === 'light' ? 'var(--color-primary)' : 'var(--color-surface-2)',
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Sun size={16} /> {t.settings.lightMode}
        </button>
        <button
          onClick={() => handleSave('dark')}
          disabled={saving}
          style={{
            flex: 1,
            padding: '14px',
            border: `2.5px solid var(--color-border)`,
            boxShadow: theme === 'dark' ? 'var(--neo-shadow)' : 'none',
            backgroundColor: theme === 'dark' ? 'var(--color-primary)' : 'var(--color-surface-2)',
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Moon size={16} /> {t.settings.darkMode}
        </button>
      </div>
      {saving && <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>{t.common.saving}</p>}
    </div>
  )
}

// ─── API Keys Form ────────────────────────────────────────────────────────────

function ApiKeysForm({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
  const [keys, setKeys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    API_KEY_FIELDS.forEach(({ field }) => { init[field] = (config[field] as string) || '' })
    return init
  })
  const [baseUrl, setBaseUrl] = useState(config.openaicompatBaseUrl || '')
  const [deepseekApiKeys, setDeepseekApiKeys] = useState<DeepSeekApiKeyEntry[]>(
    config.deepseekApiKeys?.length ? config.deepseekApiKeys : []
  )
  const [deepseekThinking, setDeepseekThinking] = useState(config.deepseekThinking ?? false)
  const [deepseekReasoningEffort, setDeepseekReasoningEffort] = useState<'low' | 'high' | 'max'>(
    (['low', 'high', 'max'].includes(config.deepseekReasoningEffort) ? config.deepseekReasoningEffort : 'high')
  )
  const [zhipuaiThinking, setZhipuaiThinking] = useState(config.zhipuaiThinking ?? true)
  const [zhipuaiReasoningEffort, setZhipuaiReasoningEffort] = useState<EffortSetting>(config.zhipuaiReasoningEffort ?? 'default')
  const [mimoThinking, setMimoThinking] = useState(config.mimoThinking ?? true)
  const [mimoReasoningEffort, setMimoReasoningEffort] = useState<'low' | 'medium' | 'high'>(config.mimoReasoningEffort ?? 'medium')
  const [xaiReasoningEffort, setXaiReasoningEffort] = useState<AppConfig['xaiReasoningEffort']>(config.xaiReasoningEffort ?? 'high')
  const [openaiReasoningEffort, setOpenaiReasoningEffort] = useState<EffortSetting>(config.openaiReasoningEffort ?? 'default')
  const [anthropicEffort, setAnthropicEffort] = useState<EffortSetting>(config.anthropicEffort ?? 'default')
  const [geminiReasoningEffort, setGeminiReasoningEffort] = useState<EffortSetting>(config.geminiReasoningEffort ?? 'default')
  const [moonshotRegion, setMoonshotRegion] = useState<AppConfig['moonshotRegion']>(config.moonshotRegion ?? 'international')
  const [moonshotReasoningEffort, setMoonshotReasoningEffort] = useState<EffortSetting>(config.moonshotReasoningEffort ?? 'default')
  const [moonshotThinking, setMoonshotThinking] = useState(config.moonshotThinking ?? true)
  const [qwenThinking, setQwenThinking] = useState(config.qwenThinking ?? true)
  const [openrouterReasoning, setOpenrouterReasoning] = useState<AppConfig['openrouterReasoning']>(config.openrouterReasoning ?? 'default')
  const [openrouterSort, setOpenrouterSort] = useState<AppConfig['openrouterSort']>(config.openrouterSort ?? '')
  const [openrouterDeny, setOpenrouterDeny] = useState(config.openrouterDenyDataCollection ?? false)
  const [geminiSafetyFilter, setGeminiSafetyFilter] = useState(config.geminiSafetyFilter ?? true)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testMsg, setTestMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const { t } = useI18n()

  const buildConfig = (): AppConfig => {
    const updated = { ...config }
    API_KEY_FIELDS.forEach(({ field }) => { ;(updated as any)[field] = keys[field] || '' })
    updated.openaicompatBaseUrl = baseUrl.trim()
    updated.deepseekApiKeys = deepseekApiKeys
    updated.deepseekApiKey = deepseekApiKeys[0]?.key || keys['deepseekApiKey'] || ''
    updated.deepseekThinking = deepseekThinking
    updated.deepseekReasoningEffort = deepseekReasoningEffort
    updated.zhipuaiThinking = zhipuaiThinking
    updated.zhipuaiReasoningEffort = zhipuaiReasoningEffort
    updated.mimoThinking = mimoThinking
    updated.mimoReasoningEffort = mimoReasoningEffort
    updated.xaiReasoningEffort = xaiReasoningEffort
    updated.openaiReasoningEffort = openaiReasoningEffort
    updated.anthropicEffort = anthropicEffort
    updated.geminiReasoningEffort = geminiReasoningEffort
    updated.moonshotRegion = moonshotRegion
    updated.moonshotReasoningEffort = moonshotReasoningEffort
    updated.moonshotThinking = moonshotThinking
    updated.qwenThinking = qwenThinking
    updated.openrouterReasoning = openrouterReasoning
    updated.openrouterSort = openrouterSort
    updated.openrouterDenyDataCollection = openrouterDeny
    updated.geminiSafetyFilter = geminiSafetyFilter
    return updated
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(buildConfig())
    resetProviderModels()  // new keys → model lists are asked for again
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await onSave(buildConfig())
      const result = await testConfigApi()
      setTestResult(result.success ? 'success' : 'error')
      setTestMsg(result.success ? `${t.settings.connectionSuccess} (${PROVIDERS[config.provider]?.label})` : ((result as any).error || t.settings.connectionFailed))
    } catch {
      setTestResult('error')
      setTestMsg(t.settings.testError)
    }
    setTesting(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div style={gridStyle(360)}>
      <ChatGPTCard config={config} onSave={onSave} />
      {API_KEY_FIELDS.map(({ provider, field, label, hasBaseUrl, hasThinkingToggle }) => {
        const isActive = provider === config.provider
        const docsUrl = PROVIDERS[provider]?.docsUrl
        const hasKey = !!(keys[field] || '').trim()
        return (
          <div key={field} style={{ ...cardStyle, padding: '14px 16px' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                {label} API Key
              </label>
              {isActive && (
                <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: '#111', padding: '1px 6px', border: '1.5px solid var(--color-border)', textTransform: 'uppercase' }}>
                  {t.common.active}
                </span>
              )}
              {hasKey && !isActive && (
                <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#28E272', color: '#111', padding: '1px 6px', border: '1.5px solid var(--color-border)', textTransform: 'uppercase' }}>
                  ✓
                </span>
              )}
              {docsUrl && (
                <a href={docsUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: 600 }}>
                  <ExternalLink size={10} /> {t.settings.seeModels}
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey[field] ? 'text' : 'password'}
                value={keys[field] || ''}
                onChange={(e) => { setKeys(prev => ({ ...prev, [field]: e.target.value })); setTestResult(null) }}
                placeholder={t.settings.enterApiKey.replace('{label}', label)}
                className="neo-input"
                style={{ paddingRight: '40px', fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: isActive ? 'var(--color-border)' : 'var(--color-separator)' }}
              />
              <button
                onClick={() => setShowKey(prev => ({ ...prev, [field]: !prev[field] }))}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                {showKey[field] ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {hasBaseUrl && (
              <div className="mt-2">
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null) }}
                  placeholder="http://localhost:11434/v1"
                  className="neo-input"
                  style={{ fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: isActive ? 'var(--color-border)' : 'var(--color-separator)' }}
                />
                <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
                  Compatible with Ollama, LM Studio, LocalAI, or any OpenAI-compatible endpoint.
                </p>
              </div>
            )}
            {provider === 'deepseek' && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--color-text-muted)' }}>
                    API Keys ({deepseekApiKeys.length})
                  </label>
                  <button
                    onClick={() => {
                      const newEntry: DeepSeekApiKeyEntry = { id: crypto.randomUUID(), label: `Key ${deepseekApiKeys.length + 1}`, key: '' }
                      setDeepseekApiKeys(prev => [...prev, newEntry])
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '10px', fontWeight: 700, border: '2px solid var(--color-border)', backgroundColor: 'var(--color-primary)', cursor: 'pointer', textTransform: 'uppercase' }}
                  >
                    <Plus size={11} /> ADD KEY
                  </button>
                </div>
                <div className="space-y-2">
                  {deepseekApiKeys.map((entry, idx) => (
                    <div key={entry.id} className="flex items-center gap-2">
                      <input
                        value={entry.label}
                        onChange={e => setDeepseekApiKeys(prev => prev.map(k => k.id === entry.id ? { ...k, label: e.target.value } : k))}
                        placeholder="Label"
                        className="neo-input"
                        style={{ width: '110px', flexShrink: 0, padding: '5px 8px', fontSize: '12px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                      />
                      <div className="relative flex-1">
                        <input
                          type={showKey[`ds_${entry.id}`] ? 'text' : 'password'}
                          value={entry.key}
                          onChange={e => setDeepseekApiKeys(prev => prev.map(k => k.id === entry.id ? { ...k, key: e.target.value } : k))}
                          placeholder="sk-..."
                          className="neo-input"
                          style={{ paddingRight: '36px', fontSize: '12px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                        />
                        <button
                          onClick={() => setShowKey(prev => ({ ...prev, [`ds_${entry.id}`]: !prev[`ds_${entry.id}`] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                        >
                          {showKey[`ds_${entry.id}`] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      {idx === 0 && (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#888', whiteSpace: 'nowrap' }}>DEFAULT</span>
                      )}
                      <button
                        onClick={() => setDeepseekApiKeys(prev => prev.filter(k => k.id !== entry.id))}
                        disabled={deepseekApiKeys.length <= 1}
                        style={{ border: '2px solid var(--color-border)', background: '#FF3C3C', color: '#fff', padding: '5px', cursor: deepseekApiKeys.length <= 1 ? 'not-allowed' : 'pointer', opacity: deepseekApiKeys.length <= 1 ? 0.4 : 1, flexShrink: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {deepseekApiKeys.length === 0 && (
                    <p style={{ fontSize: '11px', color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>
                      Belum ada key. Klik ADD KEY untuk menambahkan.
                    </p>
                  )}
                </div>
              </div>
            )}
            {provider === 'gemini' && (
              <div className="mt-2 flex items-center justify-between px-3 py-2" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Safety Filter
                  </span>
                  <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', maxWidth: '420px', lineHeight: 1.5 }}>
                    {geminiSafetyFilter
                      ? 'Default Google — konten fanservice/ecchi kadang ditolak.'
                      : 'Mode paling longgar: threshold OFF untuk harassment, hate speech, seksual, dan dangerous content. Proteksi inti Google tetap berlaku.'}
                  </p>
                </div>
                <button
                  onClick={() => { setGeminiSafetyFilter(v => !v); setTestResult(null) }}
                  style={{
                    flexShrink: 0, marginLeft: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 700,
                    border: '2px solid var(--color-border)', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.4px',
                    backgroundColor: geminiSafetyFilter ? '#28E272' : '#FF3C3C',
                    color: '#fff',
                  }}
                >
                  {geminiSafetyFilter ? 'ON' : 'OFF'}
                </button>
              </div>
            )}
            {provider === 'zhipuai' && (
              <OptionRow title="Reasoning Effort" desc="Mulai GLM-5.2. GLM-5.3 / 5.3-Flash hanya LOW/HIGH/MAX (MED dan XHIGH dipetakan otomatis); GLM-5.2 dan 5.3-FlashX menerima semua level. DEFAULT = MAX. Tidak dikirim saat thinking OFF."
                value={zhipuaiReasoningEffort} onChange={v => { setZhipuaiReasoningEffort(v as EffortSetting); setTestResult(null) }}
                options={[['default', 'DEFAULT'], ['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH'], ['xhigh', 'XHIGH'], ['max', 'MAX']]} />
            )}
            {provider === 'xai' && (
              <OptionRow title="Reasoning Effort" desc="Grok selalu berpikir. Grok 4.6/4.7 menerima XHIGH; 4.5 maksimal HIGH; 4.3 dan 4.20 tidak menerima effort (otomatis tidak dikirim)."
                value={xaiReasoningEffort} onChange={v => { setXaiReasoningEffort(v as AppConfig['xaiReasoningEffort']); setTestResult(null) }}
                options={[['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH'], ['xhigh', 'XHIGH']]} />
            )}
            {provider === 'openai' && (
              <OptionRow title="Reasoning Effort" desc="GPT-6 selalu reasoning dan tidak menerima temperature. NONE hanya ada di GPT-6 Luna (model lain otomatis ke LOW). DEFAULT = bawaan model (medium)."
                value={openaiReasoningEffort} onChange={v => { setOpenaiReasoningEffort(v as EffortSetting); setTestResult(null) }}
                options={[['default', 'DEFAULT'], ['none', 'NONE'], ['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH'], ['xhigh', 'XHIGH'], ['max', 'MAX']]} />
            )}
            {provider === 'anthropic' && (
              <OptionRow title="Effort" desc="Claude 5.x berpikir adaptif dan menolak temperature — effort mengatur kedalaman sekaligus biaya. DEFAULT = medium (Opus/Haiku 5.5) atau high (Sonnet 5.5, Fable 5.1)."
                value={anthropicEffort} onChange={v => { setAnthropicEffort(v as EffortSetting); setTestResult(null) }}
                options={[['default', 'DEFAULT'], ['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH'], ['xhigh', 'XHIGH'], ['max', 'MAX']]} />
            )}
            {provider === 'gemini' && (
              <OptionRow title="Thinking Level" desc="Gemini 3 tidak bisa mematikan thinking; LOW/MED/HIGH mengatur kedalamannya. DEFAULT = bawaan model."
                value={geminiReasoningEffort} onChange={v => { setGeminiReasoningEffort(v as EffortSetting); setTestResult(null) }}
                options={[['default', 'DEFAULT'], ['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH']]} />
            )}
            {provider === 'qwen' && (
              <ToggleRow title="Thinking" desc="Qwen 3.7/3.8 berpikir secara default. OFF = jawab langsung (lebih cepat dan murah)."
                on={qwenThinking} onToggle={() => { setQwenThinking(v => !v); setTestResult(null) }} />
            )}
            {provider === 'moonshot' && (
              <>
                <OptionRow title="Region" desc="Key dari platform internasional (platform.kimi.ai) atau China (platform.moonshot.cn) — tidak bisa dipertukarkan."
                  value={moonshotRegion} onChange={v => { setMoonshotRegion(v as AppConfig['moonshotRegion']); setTestResult(null) }}
                  options={[['international', 'INTL'], ['china', 'CHINA']]} />
                <OptionRow title="Effort (Kimi K3)" desc="Temperature Kimi dikunci 1.0 oleh provider (tidak dikirim). DEFAULT = MAX."
                  value={moonshotReasoningEffort} onChange={v => { setMoonshotReasoningEffort(v as EffortSetting); setTestResult(null) }}
                  options={[['default', 'DEFAULT'], ['low', 'LOW'], ['high', 'HIGH'], ['max', 'MAX']]} />
                <ToggleRow title="Thinking (Kimi K2.6)" desc="K2.6 bisa menjawab tanpa berpikir. K2.7 Code selalu berpikir."
                  on={moonshotThinking} onToggle={() => { setMoonshotThinking(v => !v); setTestResult(null) }} />
              </>
            )}
            {provider === 'openrouter' && (
              <>
                <OptionRow title="Reasoning" desc="Diterjemahkan per model dari katalog OpenRouter: level yang tidak ada dipetakan ke yang terdekat, model berbasis anggaran (Qwen) diberi token budget, dan OFF diabaikan bila reasoning wajib. Lihat baris 'Dikirim' di tiap worker."
                  value={openrouterReasoning} onChange={v => { setOpenrouterReasoning(v as AppConfig['openrouterReasoning']); setTestResult(null) }}
                  options={[['default', 'DEFAULT'], ['off', 'OFF'], ['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH'], ['xhigh', 'XHIGH'], ['max', 'MAX']]} />
                <OptionRow title="Routing" desc="Satu model bisa dilayani beberapa penyedia. DEFAULT = OpenRouter menyeimbangkan harga & uptime."
                  value={openrouterSort} onChange={v => { setOpenrouterSort(v as AppConfig['openrouterSort']); setTestResult(null) }}
                  options={[['', 'DEFAULT'], ['price', 'MURAH'], ['throughput', 'CEPAT'], ['latency', 'LATENSI']]} />
                <ToggleRow title="Tolak penyedia yang menyimpan data" desc="Hanya pakai penyedia yang tidak menyimpan/melatih dari prompt. Pilihan penyedia jadi lebih sedikit (kadang lebih mahal)."
                  on={openrouterDeny} onToggle={() => { setOpenrouterDeny(v => !v); setTestResult(null) }} />
              </>
            )}
            {hasThinkingToggle && (() => {
              const isZhipuai = provider === 'zhipuai'
              const isDeepseek = provider === 'deepseek'
              const isMimo = provider === 'mimo'
              const thinkingOn = isZhipuai ? zhipuaiThinking : isDeepseek ? deepseekThinking : mimoThinking
              const hasEffort = (isDeepseek || isMimo) && thinkingOn
              const currentEffort = isDeepseek ? deepseekReasoningEffort : mimoReasoningEffort
              const thinkingDesc = isZhipuai
                ? t.settings.zhipuaiThinkingDesc
                : isDeepseek
                  ? t.settings.deepseekThinkingDesc
                  : t.settings.mimoThinkingDesc
              const effortDesc = isDeepseek ? t.settings.deepseekReasoningEffortDesc : t.settings.mimoReasoningEffortDesc
              const toggle = () => {
                if (isZhipuai) setZhipuaiThinking(v => !v)
                else if (isDeepseek) setDeepseekThinking(v => !v)
                else if (isMimo) setMimoThinking(v => !v)
                setTestResult(null)
              }
              const setEffort = (v: string) => {
                if (isDeepseek) setDeepseekReasoningEffort(v as 'low' | 'high' | 'max')
                else if (isMimo) setMimoReasoningEffort(v as 'low' | 'medium' | 'high')
                setTestResult(null)
              }
              const EFFORT_OPTIONS = isDeepseek
                ? [
                    { value: 'low',  label: 'LOW',  color: '#28E272' },
                    { value: 'high', label: 'HIGH', color: '#FFD600' },
                    { value: 'max',  label: 'MAX',  color: '#FF3C3C' },
                  ]
                : [
                    { value: 'low',    label: 'LOW',  color: '#28E272' },
                    { value: 'medium', label: 'MED',  color: '#FFD600' },
                    { value: 'high',   label: 'HIGH', color: '#FF3C3C' },
                  ]
              return (
                <>
                  <div className="mt-2 flex items-center justify-between px-3 py-2" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {t.settings.deepseekThinking}
                      </span>
                      <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {thinkingDesc}
                      </p>
                    </div>
                    <button
                      onClick={toggle}
                      style={{
                        flexShrink: 0,
                        padding: '4px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '2px solid var(--color-border)',
                        backgroundColor: thinkingOn ? '#00F7FF' : 'var(--color-surface)',
                        color: thinkingOn ? '#111' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      {thinkingOn ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {hasEffort && (
                    <div className="mt-1 flex items-center justify-between px-3 py-2" style={{ border: '1.5px solid var(--color-border)', borderTop: 'none', backgroundColor: 'var(--color-surface-2)' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          {t.settings.deepseekReasoningEffort}
                        </span>
                        <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {effortDesc}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end" style={{ marginLeft: '12px' }}>
                        {EFFORT_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setEffort(opt.value)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              border: '2px solid var(--color-border)',
                              backgroundColor: currentEffort === opt.value ? opt.color : 'var(--color-surface)',
                              color: currentEffort === opt.value ? '#111' : 'var(--color-text-muted)',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )
      })}

      </div>

      {/* Test + Save — stays in view while scrolling through the provider cards */}
      <div className="flex items-center gap-3 flex-wrap" style={{ position: 'sticky', bottom: 0, zIndex: 5, padding: '10px 0', backgroundColor: 'var(--color-bg)', borderTop: '2px solid var(--color-separator)' }}>
        <button onClick={handleTest} disabled={testing} className="neo-button flex items-center gap-2" style={{ padding: '8px 16px', fontSize: '12px', opacity: testing ? 0.5 : 1 }}>
          {testing ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
          {t.settings.testProvider}
        </button>
        <button onClick={handleSave} disabled={saving} className="neo-button flex items-center gap-2" style={{ padding: '8px 16px', fontSize: '12px', opacity: saving ? 0.5 : 1 }}>
          {saving ? t.common.saving : t.settings.saveApiKeys}
        </button>
        {testResult && (
          <div className="flex items-center gap-2 px-3 py-2" style={{ flex: '1 1 260px', minWidth: 0, border: `2px solid ${testResult === 'success' ? '#28E272' : '#FF3C3C'}`, backgroundColor: testResult === 'success' ? 'rgba(40,226,114,0.08)' : 'rgba(255,60,60,0.08)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
            {testResult === 'success' ? <CheckCircle size={14} style={{ color: '#28E272', flexShrink: 0 }} /> : <XCircle size={14} style={{ color: '#FF3C3C', flexShrink: 0 }} />}
            <span style={{ overflowWrap: 'anywhere' }}>{testMsg}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Language Form ────────────────────────────────────────────────────────────

function LanguageForm({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
  const [sourceLangs, setSourceLangs] = useState<string[]>(config.sourceLanguages || ['Japanese', 'Chinese', 'Korean'])
  const [targetLangs, setTargetLangs] = useState<string[]>(config.targetLanguages || ['Indonesian', 'English'])
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [saving, setSaving] = useState(false)
  const { t } = useI18n()

  const addSourceLang = () => {
    const val = newSource.trim()
    if (val && !sourceLangs.includes(val)) { setSourceLangs([...sourceLangs, val]); setNewSource('') }
  }
  const addTargetLang = () => {
    const val = newTarget.trim()
    if (val && !targetLangs.includes(val)) { setTargetLangs([...targetLangs, val]); setNewTarget('') }
  }
  const removeSourceLang = (lang: string) => { if (sourceLangs.length > 1) setSourceLangs(sourceLangs.filter(l => l !== lang)) }
  const removeTargetLang = (lang: string) => { if (targetLangs.length > 1) setTargetLangs(targetLangs.filter(l => l !== lang)) }

  const handleSave = async () => {
    setSaving(true)
    await onSave({ ...config, sourceLanguages: sourceLangs, targetLanguages: targetLangs })
    setSaving(false)
  }

  const chipStyle = { padding: '4px 10px', border: '2px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }

  return (
    <div>
      {/* Source Languages */}
      <div className="mb-5">
        <label className="flex items-center gap-1.5 mb-2" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
          <Globe size={12} /> {t.settings.sourceLang}
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {sourceLangs.map(lang => (
            <span key={lang} className="flex items-center gap-1" style={chipStyle}>
              {lang}
              <button type="button" onClick={() => removeSourceLang(lang)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: 0, lineHeight: 1 }} disabled={sourceLangs.length <= 1}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSourceLang() } }} placeholder={t.settings.addLanguage} className="neo-input flex-1" style={{ padding: '6px 10px', fontSize: '13px' }} />
          <button type="button" onClick={addSourceLang} className="neo-button" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /></button>
        </div>
      </div>

      {/* Target Languages */}
      <div className="mb-5">
        <label className="flex items-center gap-1.5 mb-2" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
          <Languages size={12} /> {t.settings.targetLang}
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {targetLangs.map(lang => (
            <span key={lang} className="flex items-center gap-1" style={chipStyle}>
              {lang}
              <button type="button" onClick={() => removeTargetLang(lang)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: 0, lineHeight: 1 }} disabled={targetLangs.length <= 1}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTargetLang() } }} placeholder={t.settings.addLanguage} className="neo-input flex-1" style={{ padding: '6px 10px', fontSize: '13px' }} />
          <button type="button" onClick={addTargetLang} className="neo-button" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /></button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="neo-button w-full" style={{ opacity: saving ? 0.5 : 1 }}>
        {saving ? t.common.saving : t.settings.saveLanguages}
      </button>
    </div>
  )
}


// ─── Option rows ─────────────────────────────────────────────────────────────

const OPTION_COLORS = ['#E0E0E0', '#28E272', '#9BF0B8', '#FFD600', '#FFB020', '#FF8A3C', '#FF3C3C']

function OptionRow({ title, desc, options, value, onChange }: {
  title: string
  desc: string
  options: [string, string][]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mt-2 px-3 py-2" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</span>
      <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.5 }}>{desc}</p>
      <div className="flex gap-1 flex-wrap" style={{ marginTop: '6px' }}>
        {options.map(([v, label], i) => (
          <button key={v || 'default'} onClick={() => onChange(v)} style={{
            padding: '4px 10px', fontSize: '10px', fontWeight: 700, border: '2px solid var(--color-border)', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.4px',
            backgroundColor: value === v ? OPTION_COLORS[Math.min(i, OPTION_COLORS.length - 1)] : 'var(--color-surface)',
            color: value === v ? '#111' : 'var(--color-text-muted)',
          }}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ title, desc, on, onToggle }: { title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="mt-2 flex items-center justify-between px-3 py-2" style={{ border: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
      <div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{title}</span>
        <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.5, maxWidth: '420px' }}>{desc}</p>
      </div>
      <button onClick={onToggle} style={{
        flexShrink: 0, marginLeft: '12px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, border: '2px solid var(--color-border)',
        cursor: 'pointer', textTransform: 'uppercase', backgroundColor: on ? '#00F7FF' : 'var(--color-surface)', color: on ? '#111' : 'var(--color-text-muted)',
      }}>{on ? 'ON' : 'OFF'}</button>
    </div>
  )
}
