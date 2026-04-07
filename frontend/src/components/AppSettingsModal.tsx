/**
 * LWNTL App Settings Modal
 * API key configuration for all providers + dark mode toggle
 */

import { useState, useEffect } from 'react'
import { Settings, X, Eye, EyeOff, TestTube, CheckCircle, XCircle, Loader2, ExternalLink, Moon, Sun } from 'lucide-react'
import type { AppConfig } from '../types'
import { PROVIDERS } from '../types'
import { testConfig as testConfigApi } from '../api'

interface AppSettingsModalProps {
  open: boolean
  onClose: () => void
  config: AppConfig | null
  onSave: (config: AppConfig) => void
}

const API_KEY_FIELDS: Array<{
  provider: string
  field: keyof AppConfig
  label: string
}> = [
  { provider: 'zhipuai',   field: 'zhipuaiApiKey',   label: 'ZhipuAI (Z.AI) API Key' },
  { provider: 'qwen',      field: 'qwenApiKey',      label: 'Alibaba Cloud (Qwen) API Key' },
  { provider: 'openai',    field: 'openaiApiKey',    label: 'OpenAI API Key' },
  { provider: 'gemini',    field: 'geminiApiKey',    label: 'Google Gemini API Key' },
  { provider: 'anthropic', field: 'anthropicApiKey', label: 'Anthropic (Claude) API Key' },
  { provider: 'xai',       field: 'xaiApiKey',       label: 'xAI (Grok) API Key' },
  { provider: 'moonshot',  field: 'moonshotApiKey',  label: 'Moonshot AI (Kimi) API Key' },
]

export function AppSettingsModal({ open, onClose, config, onSave }: AppSettingsModalProps) {
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [theme, setTheme] = useState<string>('light')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    if (open && config) {
      const initial: Record<string, string> = {}
      API_KEY_FIELDS.forEach(({ field }) => {
        initial[field] = (config[field] as string) || ''
      })
      setKeys(initial)
      setTheme(config.theme || 'light')
      setTestResult(null)
      setTestMessage('')
    }
  }, [open, config])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !config) return null

  const buildNewConfig = (): AppConfig => {
    const updated = { ...config, theme }
    API_KEY_FIELDS.forEach(({ field }) => {
      ;(updated as any)[field] = keys[field] || ''
    })
    return updated
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await onSave(buildNewConfig())
      const result = await testConfigApi()
      setTestResult(result.success ? 'success' : 'error')
      setTestMessage(result.success ? 'Koneksi berhasil!' : ((result as any).error || 'Koneksi gagal. Periksa API key.'))
    } catch {
      setTestResult('error')
      setTestMessage('Terjadi kesalahan saat tes.')
    }
    setTesting(false)
  }

  const handleSave = () => {
    onSave(buildNewConfig())
    onClose()
  }

  const currentProviderField = PROVIDERS[config.provider]?.apiKeyName as string | undefined

  return (
    <div className="neo-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="neo-modal"
        style={{
          maxWidth: '560px',
          animation: 'slideUp 150ms ease',
          backgroundColor: 'var(--color-surface)',
          border: '2.5px solid var(--color-border)',
          boxShadow: '6px 6px 0px var(--color-border)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Settings size={20} style={{ color: 'var(--color-text)' }} />
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--color-text)' }}>
                PENGATURAN APLIKASI
              </h2>
            </div>
            <button onClick={onClose} className="hover:opacity-70" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text)' }}>
              <X size={20} />
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <div className="mb-5 p-3" style={{ border: '2px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Moon size={16} style={{ color: 'var(--color-text)' }} /> : <Sun size={16} style={{ color: 'var(--color-text)' }} />}
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tema Tampilan
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    border: '2px solid var(--color-border)',
                    backgroundColor: theme === 'light' ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    letterSpacing: '0.3px',
                  }}
                >
                  ☀ Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    border: '2px solid var(--color-border)',
                    backgroundColor: theme === 'dark' ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    letterSpacing: '0.3px',
                  }}
                >
                  ☽ Dark
                </button>
              </div>
            </div>
          </div>

          {/* API Keys */}
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            API Keys — Isi provider yang ingin digunakan
          </p>

          {API_KEY_FIELDS.map(({ provider, field, label }) => {
            const isActive = provider === config.provider
            const docsUrl = PROVIDERS[provider]?.docsUrl
            return (
              <div key={field} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {label}
                  </label>
                  {isActive && (
                    <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: 'var(--color-primary)', color: '#111', padding: '1px 6px', border: '1.5px solid var(--color-border)', textTransform: 'uppercase' }}>
                      AKTIF
                    </span>
                  )}
                  {docsUrl && (
                    <a
                      href={docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      <ExternalLink size={10} /> Lihat Model
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showKey[field] ? 'text' : 'password'}
                    value={keys[field] || ''}
                    onChange={(e) => { setKeys(prev => ({ ...prev, [field]: e.target.value })); setTestResult(null) }}
                    placeholder={`Masukkan ${label}...`}
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
                {field === currentProviderField && PROVIDERS[provider]?.docsUrl && (
                  <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '3px' }}>
                    Provider aktif — key ini yang dipakai untuk terjemahan sekarang.
                  </p>
                )}
              </div>
            )
          })}

          {/* Test */}
          <div className="flex items-center gap-3 mt-4 mb-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="neo-button flex items-center gap-2"
              style={{ padding: '8px 16px', fontSize: '12px', opacity: testing ? 0.5 : 1 }}
            >
              {testing ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
              TEST PROVIDER AKTIF
            </button>
          </div>

          {testResult && (
            <div
              className="flex items-center gap-2 mb-4 px-3 py-2"
              style={{
                border: `2px solid ${testResult === 'success' ? '#28E272' : '#FF3C3C'}`,
                backgroundColor: testResult === 'success' ? 'rgba(40,226,114,0.08)' : 'rgba(255,60,60,0.08)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              {testResult === 'success'
                ? <CheckCircle size={14} style={{ color: '#28E272' }} />
                : <XCircle size={14} style={{ color: '#FF3C3C' }} />}
              {testMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={onClose}
              className="neo-button"
              style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
            >
              BATAL
            </button>
            <button onClick={handleSave} className="neo-button">
              SIMPAN
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
