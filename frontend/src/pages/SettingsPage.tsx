import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  borderRadius: '12px', overflow: 'hidden',
  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', minWidth: 0,
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
          <div><h1 className="ui-h1 mb-2">{t.settings.title}</h1><p className="text-sm text-muted-foreground">{config?.uiLanguage === 'en' ? 'Customize the app, provider connections, and translation workers.' : 'Sesuaikan aplikasi, koneksi provider, dan worker terjemahan.'}</p></div>
          <Tabs value={tab} onValueChange={value => setTab(value as SettingsTab)}>
            <TabsList aria-label={t.settings.title}>
              {tabs.map(([key, label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}
            </TabsList>

          {!config && <p style={{ color: 'var(--color-text-subtle)', fontSize: '14px' }}>{t.common.loading}</p>}

          {config && tab === 'general' && (
            <TabsContent value="general" className="mt-4" style={gridStyle(380)}>
              <AppLanguageSection config={config} onSave={handleSave} />
              <ThemeSection config={config} onSave={handleSave} />
              <div className="p-6" style={cardStyle}>
                <h2 className="flex items-center gap-2 mb-5" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '20px', color: 'var(--color-text)' }}>
                  <Languages size={20} />
                  {t.settings.languages}
                </h2>
                <LanguageForm config={config} onSave={handleSave} />
              </div>
            </TabsContent>
          )}

          {config && tab === 'providers' && (
            <TabsContent value="providers" className="mt-4 space-y-5">
              <div>
                <h2 className="mb-1" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '20px', color: 'var(--color-text)' }}>
                  {t.settings.apiKeys}
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {t.settings.apiKeysDesc} <strong>{PROVIDERS[config.provider || 'zhipuai']?.label}</strong>
                </p>
              </div>
              <ApiKeysForm config={config} onSave={handleSave} />
            </TabsContent>
          )}

          {config && tab === 'workers' && <TabsContent value="workers" className="mt-4"><WorkerSection config={config} onSave={handleSave} /></TabsContent>}
          </Tabs>
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
    <div className="p-6" style={{ borderRadius: 'var(--radius)',  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between mb-2">
        <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '20px', color: 'var(--color-text)' }}>
          WORKERS
        </h2>
        <Button variant="default" onClick={addWorker} className="flex items-center gap-1" style={{ padding: '6px 12px', fontSize: '12px' }}>
          <Plus size={14} /> {t.common.add}
        </Button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        Setiap worker adalah slot AI terpisah. Worker tidak terkunci ke satu series: setiap request menggunakan worker dengan slot tersedia (prioritas ke worker pilihan series). Naikkan <strong>Max Concurrent</strong> untuk menjalankan beberapa translasi sekaligus dalam satu worker.
      </p>

      <div style={gridStyle(340)}>
        {workers.map((worker, index) => {
          return (
            <div key={worker.id} className="p-3" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Input aria-label={`worker ${index + 1}`}
                  value={worker.label}
                  onChange={(e) => updateWorker(worker.id, { label: e.target.value })}
                  placeholder={`worker ${index + 1}`}
                  className="ui-input flex-1"
                  style={{ padding: '6px 10px', fontSize: '13px' }}
                />
                <Button aria-label="Remove worker" variant="ghost"
                  onClick={() => removeWorker(worker.id)}
                  disabled={workers.length <= 1}
                  style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', background: 'var(--bg-red,#FF3C3C)', color: 'var(--fg-red)', padding: '7px', opacity: workers.length <= 1 ? 0.4 : 1, cursor: workers.length <= 1 ? 'not-allowed' : 'pointer' }}
                  title="Remove worker"
                >
                  <X size={14} />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <select
                  value={worker.provider}
                  aria-label={`Provider worker ${index + 1}`}
                  onChange={(e) => updateWorker(worker.id, { provider: e.target.value as WorkerProfile['provider'] })}
                  className="ui-input"
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
                  <Label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    DeepSeek Key
                  </Label>
                  <select aria-label="DeepSeek Key"
                    value={worker.deepseekApiKeyId || ''}
                    onChange={e => updateWorker(worker.id, { deepseekApiKeyId: e.target.value || undefined })}
                    className="ui-input flex-1"
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
                <Label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  Max Concurrent
                </Label>
                <Input aria-label="Max Concurrent"
                  type="number"
                  min={1}
                  max={10}
                  value={worker.maxConcurrent ?? 1}
                  onChange={(e) => updateWorker(worker.id, { maxConcurrent: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
                  className="ui-input"
                  style={{ width: '70px', padding: '4px 8px', fontSize: '13px', backgroundColor: 'var(--color-surface)', textAlign: 'center' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--color-text-subtle)' }}>
                  jobs sekaligus (1–10)
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <Button variant="default" onClick={handleSave} disabled={saving || workers.some(w => !w.model.trim())} className="w-full mt-4" style={{ opacity: saving ? 0.5 : 1 }}>
        {saving ? t.common.saving : 'SIMPAN WORKERS'}
      </Button>
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
    <div className="p-6" style={{ borderRadius: 'var(--radius)',  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
      <h2 className="flex items-center gap-2 mb-2" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '20px', color: 'var(--color-text)' }}>
        <Globe size={20} />
        {t.settings.appLanguage}
      </h2>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        {t.settings.appLanguageDesc}
      </p>
      <div className="flex items-center gap-3">
        {LANGUAGE_OPTIONS.map((opt) => (
          <Button variant="ghost"
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            disabled={saving}
            style={{ borderRadius: 'var(--radius)',
              flex: 1,
              padding: '14px',
              border: `1px solid var(--color-border)`,
              boxShadow: language === opt.value ? 'var(--shadow-sm)' : 'none',
              backgroundColor: language === opt.value ? 'var(--bg-cyan,var(--color-primary))' : 'var(--color-surface-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      {saving && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>{t.common.saving}</p>}
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
    <div className="p-6" style={{ borderRadius: 'var(--radius)',  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
      <h2 className="mb-4" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '20px', color: 'var(--color-text)' }}>
        {t.settings.appearance}
      </h2>
      <div className="flex items-center gap-3">
        <Button variant="ghost"
          onClick={() => handleSave('light')}
          disabled={saving}
          style={{ borderRadius: 'var(--radius)',
            flex: 1,
            padding: '14px',
            border: `1px solid var(--color-border)`,
            boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none',
            backgroundColor: theme === 'light' ? 'var(--bg-cyan,var(--color-primary))' : 'var(--color-surface-2)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '13px',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Sun size={16} /> {t.settings.lightMode}
        </Button>
        <Button variant="ghost"
          onClick={() => handleSave('dark')}
          disabled={saving}
          style={{ borderRadius: 'var(--radius)',
            flex: 1,
            padding: '14px',
            border: `1px solid var(--color-border)`,
            boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none',
            backgroundColor: theme === 'dark' ? 'var(--bg-cyan,var(--color-primary))' : 'var(--color-surface-2)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '13px',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Moon size={16} /> {t.settings.darkMode}
        </Button>
      </div>
      {saving && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>{t.common.saving}</p>}
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
              <Label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                {label} API Key
              </Label>
              {isActive && (
                <span style={{ borderRadius: 'var(--radius)',  fontSize: '12px', fontWeight: 600, backgroundColor: 'var(--bg-cyan,var(--color-primary))', color: 'var(--on-accent,#111)', padding: '1px 6px', border: '1px solid var(--color-border)', textTransform: 'none' }}>
                  {t.common.active}
                </span>
              )}
              {hasKey && !isActive && (
                <span style={{ borderRadius: 'var(--radius)',  fontSize: '12px', fontWeight: 600, backgroundColor: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', padding: '1px 6px', border: '1px solid var(--color-border)', textTransform: 'none' }}>
                  ✓
                </span>
              )}
              {docsUrl && (
                <a href={docsUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: 600 }}>
                  <ExternalLink size={10} /> {t.settings.seeModels}
                </a>
              )}
            </div>
            <div className="relative">
              <Input aria-label={t.settings.enterApiKey.replace('{label}', label)}
                type={showKey[field] ? 'text' : 'password'}
                value={keys[field] || ''}
                onChange={(e) => { setKeys(prev => ({ ...prev, [field]: e.target.value })); setTestResult(null) }}
                placeholder={t.settings.enterApiKey.replace('{label}', label)}
                className="ui-input"
                style={{ paddingRight: '40px', fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: isActive ? 'var(--color-border)' : 'var(--color-separator)' }}
              />
              <Button aria-label="Show or hide API key" variant="ghost"
                onClick={() => setShowKey(prev => ({ ...prev, [field]: !prev[field] }))}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                {showKey[field] ? <EyeOff size={15} /> : <Eye size={15} />}
              </Button>
            </div>
            {hasBaseUrl && (
              <div className="mt-2">
                <Label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  Base URL
                </Label>
                <Input aria-label="Base URL"
                  type="text"
                  value={baseUrl}
                  onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null) }}
                  placeholder="http://localhost:11434/v1"
                  className="ui-input"
                  style={{ fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: isActive ? 'var(--color-border)' : 'var(--color-separator)' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--color-text-subtle)', marginTop: '4px' }}>
                  Compatible with Ollama, LM Studio, LocalAI, or any OpenAI-compatible endpoint.
                </p>
              </div>
            )}
            {provider === 'deepseek' && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px', color: 'var(--color-text-muted)' }}>
                    API Keys ({deepseekApiKeys.length})
                  </Label>
                  <Button variant="ghost"
                    onClick={() => {
                      const newEntry: DeepSeekApiKeyEntry = { id: crypto.randomUUID(), label: `Key ${deepseekApiKeys.length + 1}`, key: '' }
                      setDeepseekApiKeys(prev => [...prev, newEntry])
                    }}
                    style={{ color: 'var(--foreground)',  borderRadius: 'var(--radius)',  display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--color-border)', backgroundColor: 'var(--bg-cyan,var(--color-primary))', cursor: 'pointer', textTransform: 'none' }}
                  >
                    <Plus size={11} /> ADD KEY
                  </Button>
                </div>
                <div className="space-y-2">
                  {deepseekApiKeys.map((entry, idx) => (
                    <div key={entry.id} className="flex items-center gap-2">
                      <Input aria-label="Label"
                        value={entry.label}
                        onChange={e => setDeepseekApiKeys(prev => prev.map(k => k.id === entry.id ? { ...k, label: e.target.value } : k))}
                        placeholder="Label"
                        className="ui-input"
                        style={{ width: '110px', flexShrink: 0, padding: '5px 8px', fontSize: '12px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                      />
                      <div className="relative flex-1">
                        <Input aria-label="sk-..."
                          type={showKey[`ds_${entry.id}`] ? 'text' : 'password'}
                          value={entry.key}
                          onChange={e => setDeepseekApiKeys(prev => prev.map(k => k.id === entry.id ? { ...k, key: e.target.value } : k))}
                          placeholder="sk-..."
                          className="ui-input"
                          style={{ paddingRight: '36px', fontSize: '12px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                        />
                        <Button aria-label="Show or hide API key" variant="ghost"
                          onClick={() => setShowKey(prev => ({ ...prev, [`ds_${entry.id}`]: !prev[`ds_${entry.id}`] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                          style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                        >
                          {showKey[`ds_${entry.id}`] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </Button>
                      </div>
                      {idx === 0 && (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted,#888)', whiteSpace: 'nowrap' }}>DEFAULT</span>
                      )}
                      <Button aria-label="Close" variant="ghost"
                        onClick={() => setDeepseekApiKeys(prev => prev.filter(k => k.id !== entry.id))}
                        disabled={deepseekApiKeys.length <= 1}
                        style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', background: 'var(--bg-red,#FF3C3C)', color: 'var(--fg-red)', padding: '5px', cursor: deepseekApiKeys.length <= 1 ? 'not-allowed' : 'pointer', opacity: deepseekApiKeys.length <= 1 ? 0.4 : 1, flexShrink: 0 }}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                  {deepseekApiKeys.length === 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>
                      Belum ada key. Klik ADD KEY untuk menambahkan.
                    </p>
                  )}
                </div>
              </div>
            )}
            {provider === 'gemini' && (
              <div className="mt-2 flex items-center justify-between px-3 py-2" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px' }}>
                    Safety Filter
                  </span>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', maxWidth: '420px', lineHeight: 1.5 }}>
                    {geminiSafetyFilter
                      ? 'Default Google: konten fanservice/ecchi kadang ditolak.'
                      : 'Mode paling longgar: threshold OFF untuk harassment, hate speech, seksual, dan dangerous content. Proteksi inti Google tetap berlaku.'}
                  </p>
                </div>
                <Switch aria-label="Gemini safety filter" checked={geminiSafetyFilter} onCheckedChange={value => { setGeminiSafetyFilter(value); setTestResult(null) }} className="ml-3" />
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
              <OptionRow title="Effort" desc="Claude 5.x berpikir adaptif dan menolak temperature: effort mengatur kedalaman sekaligus biaya. DEFAULT = medium (Opus/Haiku 5.5) atau high (Sonnet 5.5, Fable 5.1)."
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
                <OptionRow title="Region" desc="Key dari platform internasional (platform.kimi.ai) atau China (platform.moonshot.cn): tidak bisa dipertukarkan."
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
                    { value: 'low',  label: 'LOW',  color: 'var(--fg-green,#28E272)' },
                    { value: 'high', label: 'HIGH', color: 'var(--fg-yellow,#FFD600)' },
                    { value: 'max',  label: 'MAX',  color: 'var(--fg-red,#FF3C3C)' },
                  ]
                : [
                    { value: 'low',    label: 'LOW',  color: 'var(--fg-green,#28E272)' },
                    { value: 'medium', label: 'MED',  color: 'var(--fg-yellow,#FFD600)' },
                    { value: 'high',   label: 'HIGH', color: 'var(--fg-red,#FF3C3C)' },
                  ]
              return (
                <>
                  <div className="mt-2 flex items-center justify-between px-3 py-2" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px' }}>
                        {t.settings.deepseekThinking}
                      </span>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        {thinkingDesc}
                      </p>
                    </div>
                    <Button variant="ghost"
                      onClick={toggle}
                      style={{ borderRadius: 'var(--radius)',
                        flexShrink: 0,
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: '1px solid var(--color-border)',
                        backgroundColor: thinkingOn ? 'var(--bg-cyan,#00F7FF)' : 'var(--color-surface)',
                        color: thinkingOn ? 'var(--on-accent,#111)' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        textTransform: 'none',
                        letterSpacing: '0.4px',
                      }}
                    >
                      {thinkingOn ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                  {hasEffort && (
                    <div className="mt-1 flex items-center justify-between px-3 py-2" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', borderTop: 'none', backgroundColor: 'var(--color-surface-2)' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px' }}>
                          {t.settings.deepseekReasoningEffort}
                        </span>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {effortDesc}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end" style={{ marginLeft: '12px' }}>
                        {EFFORT_OPTIONS.map(opt => (
                          <Button variant="ghost"
                            key={opt.value}
                            onClick={() => setEffort(opt.value)}
                            style={{ borderRadius: 'var(--radius)',
                              padding: '4px 10px',
                              fontSize: '12px',
                              fontWeight: 600,
                              border: '1px solid var(--color-border)',
                              backgroundColor: currentEffort === opt.value ? opt.color : 'var(--color-surface)',
                              color: currentEffort === opt.value ? 'var(--on-accent,#111)' : 'var(--color-text-muted)',
                              cursor: 'pointer',
                              textTransform: 'none',
                              letterSpacing: '0.4px',
                            }}
                          >
                            {opt.label}
                          </Button>
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

      {/* Test + Save: stays in view while scrolling through the provider cards */}
      <div className="flex items-center gap-3 flex-wrap" style={{ position: 'sticky', bottom: 0, zIndex: 5, padding: '10px 0', backgroundColor: 'var(--color-bg)', borderTop: '1px solid var(--color-separator)' }}>
        <Button variant="default" onClick={handleTest} disabled={testing} className="flex items-center gap-2" style={{ padding: '8px 16px', fontSize: '12px', opacity: testing ? 0.5 : 1 }}>
          {testing ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
          {t.settings.testProvider}
        </Button>
        <Button variant="default" onClick={handleSave} disabled={saving} className="flex items-center gap-2" style={{ padding: '8px 16px', fontSize: '12px', opacity: saving ? 0.5 : 1 }}>
          {saving ? t.common.saving : t.settings.saveApiKeys}
        </Button>
        {testResult && (
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderRadius: 'var(--radius)',  flex: '1 1 260px', minWidth: 0, border: `1px solid ${testResult === 'success' ? 'var(--fg-green,#28E272)' : 'var(--fg-red,#FF3C3C)'}`, backgroundColor: testResult === 'success' ? 'rgba(40,226,114,0.08)' : 'rgba(255,60,60,0.08)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
            {testResult === 'success' ? <CheckCircle size={14} style={{ color: 'var(--fg-green,#28E272)', flexShrink: 0 }} /> : <XCircle size={14} style={{ color: 'var(--fg-red,#FF3C3C)', flexShrink: 0 }} />}
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

  const chipStyle = { padding: '4px 10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }

  return (
    <div>
      {/* Source Languages */}
      <div className="mb-5">
        <Label className="flex items-center gap-1.5 mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', color: 'var(--color-text-muted)' }}>
          <Globe size={12} /> {t.settings.sourceLang}
        </Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {sourceLangs.map(lang => (
            <span key={lang} className="flex items-center gap-1" style={chipStyle}>
              {lang}
              <Button aria-label="Close" variant="ghost" type="button" onClick={() => removeSourceLang(lang)} style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: 0, lineHeight: 1 }} disabled={sourceLangs.length <= 1}>
                <X size={12} />
              </Button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input aria-label={t.settings.addLanguage} type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSourceLang() } }} placeholder={t.settings.addLanguage} className="ui-input flex-1" style={{ padding: '6px 10px', fontSize: '13px' }} />
          <Button aria-label="Add" variant="default" type="button" onClick={addSourceLang} className="" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /></Button>
        </div>
      </div>

      {/* Target Languages */}
      <div className="mb-5">
        <Label className="flex items-center gap-1.5 mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', color: 'var(--color-text-muted)' }}>
          <Languages size={12} /> {t.settings.targetLang}
        </Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {targetLangs.map(lang => (
            <span key={lang} className="flex items-center gap-1" style={chipStyle}>
              {lang}
              <Button aria-label="Close" variant="ghost" type="button" onClick={() => removeTargetLang(lang)} style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: 0, lineHeight: 1 }} disabled={targetLangs.length <= 1}>
                <X size={12} />
              </Button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input aria-label={t.settings.addLanguage} type="text" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTargetLang() } }} placeholder={t.settings.addLanguage} className="ui-input flex-1" style={{ padding: '6px 10px', fontSize: '13px' }} />
          <Button aria-label="Add" variant="default" type="button" onClick={addTargetLang} className="" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /></Button>
        </div>
      </div>

      <Button variant="default" onClick={handleSave} disabled={saving} className="w-full" style={{ opacity: saving ? 0.5 : 1 }}>
        {saving ? t.common.saving : t.settings.saveLanguages}
      </Button>
    </div>
  )
}


// ─── Option rows ─────────────────────────────────────────────────────────────

const OPTION_COLORS = ['var(--bg-cyan)']

function OptionRow({ title, desc, options, value, onChange }: {
  title: string
  desc: string
  options: [string, string][]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mt-2 px-3 py-2" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px' }}>{title}</span>
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.5 }}>{desc}</p>
      <div className="flex gap-1 flex-wrap" style={{ marginTop: '6px' }}>
        {options.map(([v, label], i) => (
          <Button variant="ghost" key={v || 'default'} onClick={() => onChange(v)} style={{ borderRadius: 'var(--radius)',
            padding: '4px 10px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer',
            textTransform: 'none', letterSpacing: '0.4px',
            backgroundColor: value === v ? OPTION_COLORS[Math.min(i, OPTION_COLORS.length - 1)] : 'var(--color-surface)',
            color: value === v ? 'var(--on-accent,#111)' : 'var(--color-text-muted)',
          }}>{label}</Button>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ title, desc, on, onToggle }: { title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="mt-2 flex items-center justify-between px-3 py-2" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
      <div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px' }}>{title}</span>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.5, maxWidth: '420px' }}>{desc}</p>
      </div>
      <Switch checked={on} onCheckedChange={onToggle} aria-label={title} className="ml-3" />
    </div>
  )
}
