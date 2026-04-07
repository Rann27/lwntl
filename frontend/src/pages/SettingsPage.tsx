/**
 * LWNTL Settings Page
 * Full page for API keys, dark mode, and language management
 */

import { useState } from 'react'
import { Eye, EyeOff, Plus, X, Globe, Languages, ExternalLink, Sun, Moon, TestTube, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Topbar } from '../components/Topbar'
import { useAppStore } from '../store/appStore'
import { saveConfig, testConfig as testConfigApi } from '../api'
import { useToast } from '../hooks/useToast'
import { PROVIDERS } from '../types'
import type { AppConfig } from '../types'

const API_KEY_FIELDS: Array<{
  provider: string
  field: keyof AppConfig
  label: string
}> = [
  { provider: 'zhipuai',   field: 'zhipuaiApiKey',   label: 'ZhipuAI (Z.AI)' },
  { provider: 'qwen',      field: 'qwenApiKey',      label: 'Alibaba Cloud (Qwen/DS)' },
  { provider: 'openai',    field: 'openaiApiKey',    label: 'OpenAI' },
  { provider: 'gemini',    field: 'geminiApiKey',    label: 'Google Gemini' },
  { provider: 'anthropic', field: 'anthropicApiKey', label: 'Anthropic (Claude)' },
  { provider: 'xai',       field: 'xaiApiKey',       label: 'xAI (Grok)' },
  { provider: 'moonshot',  field: 'moonshotApiKey',  label: 'Moonshot AI (Kimi)' },
]

export function SettingsPage() {
  const { config, setConfig } = useAppStore()
  const toast = useToast()

  const handleSave = async (newConfig: AppConfig) => {
    try {
      await saveConfig(newConfig)
      setConfig(newConfig)
      toast.success('Pengaturan berhasil disimpan!')
    } catch {
      toast.error('Gagal menyimpan pengaturan')
    }
  }

  return (
    <div className="app-layout">
      <Topbar showBack title="Pengaturan" />

      <main className="flex-1 overflow-y-auto flex items-start justify-center p-8" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div style={{ width: '100%', maxWidth: '600px' }} className="space-y-5">

          {/* Dark Mode */}
          {config && <ThemeSection config={config} onSave={handleSave} />}

          {/* API Keys */}
          <div className="p-6" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow)' }}>
            <h2 className="mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
              API KEYS
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Isi key untuk provider yang ingin digunakan. Provider aktif: <strong>{PROVIDERS[config?.provider || 'zhipuai']?.label}</strong>
            </p>

            {config ? (
              <ApiKeysForm config={config} onSave={handleSave} />
            ) : (
              <p style={{ color: 'var(--color-text-subtle)', fontSize: '14px' }}>Memuat konfigurasi...</p>
            )}
          </div>

          {/* Language Management */}
          <div className="p-6" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow)' }}>
            <h2 className="flex items-center gap-2 mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
              <Languages size={20} />
              BAHASA
            </h2>
            {config ? (
              <LanguageForm config={config} onSave={handleSave} />
            ) : (
              <p style={{ color: 'var(--color-text-subtle)', fontSize: '14px' }}>Memuat konfigurasi...</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Theme Section ────────────────────────────────────────────────────────────

function ThemeSection({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
  const [theme, setTheme] = useState(config.theme || 'light')
  const [saving, setSaving] = useState(false)

  const handleSave = async (newTheme: string) => {
    setTheme(newTheme)
    setSaving(true)
    await onSave({ ...config, theme: newTheme })
    setSaving(false)
  }

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow)' }}>
      <h2 className="mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
        TAMPILAN
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
          <Sun size={16} /> LIGHT MODE
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
          <Moon size={16} /> DARK MODE
        </button>
      </div>
      {saving && <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>Menyimpan...</p>}
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
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testMsg, setTestMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const buildConfig = (): AppConfig => {
    const updated = { ...config }
    API_KEY_FIELDS.forEach(({ field }) => { ;(updated as any)[field] = keys[field] || '' })
    return updated
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(buildConfig())
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await onSave(buildConfig())
      const result = await testConfigApi()
      setTestResult(result.success ? 'success' : 'error')
      setTestMsg(result.success ? `Koneksi berhasil! (${PROVIDERS[config.provider]?.label})` : ((result as any).error || 'Gagal. Periksa API key.'))
    } catch {
      setTestResult('error')
      setTestMsg('Terjadi kesalahan saat tes.')
    }
    setTesting(false)
  }

  return (
    <div>
      {API_KEY_FIELDS.map(({ provider, field, label }) => {
        const isActive = provider === config.provider
        const docsUrl = PROVIDERS[provider]?.docsUrl
        const hasKey = !!(keys[field] || '').trim()
        return (
          <div key={field} className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                {label} API Key
              </label>
              {isActive && (
                <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: '#111', padding: '1px 6px', border: '1.5px solid var(--color-border)', textTransform: 'uppercase' }}>
                  AKTIF
                </span>
              )}
              {hasKey && !isActive && (
                <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#28E272', color: '#111', padding: '1px 6px', border: '1.5px solid var(--color-border)', textTransform: 'uppercase' }}>
                  ✓
                </span>
              )}
              {docsUrl && (
                <a href={docsUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: 600 }}>
                  <ExternalLink size={10} /> Lihat Model
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showKey[field] ? 'text' : 'password'}
                value={keys[field] || ''}
                onChange={(e) => { setKeys(prev => ({ ...prev, [field]: e.target.value })); setTestResult(null) }}
                placeholder={`Masukkan ${label} API key...`}
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
          </div>
        )
      })}

      {/* Test + Save */}
      <div className="flex items-center gap-3 mt-5 mb-3">
        <button onClick={handleTest} disabled={testing} className="neo-button flex items-center gap-2" style={{ padding: '8px 16px', fontSize: '12px', opacity: testing ? 0.5 : 1 }}>
          {testing ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
          TEST PROVIDER AKTIF
        </button>
        <button onClick={handleSave} disabled={saving} className="neo-button flex items-center gap-2" style={{ padding: '8px 16px', fontSize: '12px', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'MENYIMPAN...' : 'SIMPAN API KEYS'}
        </button>
      </div>

      {testResult && (
        <div className="flex items-center gap-2 px-3 py-2" style={{ border: `2px solid ${testResult === 'success' ? '#28E272' : '#FF3C3C'}`, backgroundColor: testResult === 'success' ? 'rgba(40,226,114,0.08)' : 'rgba(255,60,60,0.08)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
          {testResult === 'success' ? <CheckCircle size={14} style={{ color: '#28E272' }} /> : <XCircle size={14} style={{ color: '#FF3C3C' }} />}
          {testMsg}
        </div>
      )}
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
          <Globe size={12} /> Bahasa Sumber
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
          <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSourceLang() } }} placeholder="Tambah bahasa baru..." className="neo-input flex-1" style={{ padding: '6px 10px', fontSize: '13px' }} />
          <button type="button" onClick={addSourceLang} className="neo-button" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /></button>
        </div>
      </div>

      {/* Target Languages */}
      <div className="mb-5">
        <label className="flex items-center gap-1.5 mb-2" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
          <Languages size={12} /> Bahasa Target
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
          <input type="text" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTargetLang() } }} placeholder="Tambah bahasa baru..." className="neo-input flex-1" style={{ padding: '6px 10px', fontSize: '13px' }} />
          <button type="button" onClick={addTargetLang} className="neo-button" style={{ padding: '6px 12px', fontSize: '12px' }}><Plus size={14} /></button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="neo-button w-full" style={{ opacity: saving ? 0.5 : 1 }}>
        {saving ? 'MENYIMPAN...' : 'SIMPAN BAHASA'}
      </button>
    </div>
  )
}
