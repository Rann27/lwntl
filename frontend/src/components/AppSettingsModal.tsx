import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose() }
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
    <ModalSurface label="Application settings" onClose={onClose} className="ui-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="ui-modal"
        style={{ borderRadius: 'var(--radius)',
          maxWidth: '560px',
          animation: 'slideUp 150ms ease',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Settings size={20} style={{ color: 'var(--color-text)' }} />
              <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '20px', color: 'var(--color-text)' }}>
                PENGATURAN APLIKASI
              </h2>
            </div>
            <Button aria-label="Close" variant="ghost" onClick={onClose} className="hover:opacity-70" style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text)' }}>
              <X size={20} />
            </Button>
          </div>

          {/* Dark Mode Toggle */}
          <div className="mb-5 p-3" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Moon size={16} style={{ color: 'var(--color-text)' }} /> : <Sun size={16} style={{ color: 'var(--color-text)' }} />}
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)', textTransform: 'none', letterSpacing: 'normal' }}>
                  Tema Tampilan
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost"
                  onClick={() => setTheme('light')}
                  style={{ borderRadius: 'var(--radius)',
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'none',
                    border: '1px solid var(--color-border)',
                    backgroundColor: theme === 'light' ? 'var(--bg-cyan,var(--color-primary))' : 'var(--color-surface)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    letterSpacing: 'normal',
                  }}
                >
                  ☀ Light
                </Button>
                <Button variant="ghost"
                  onClick={() => setTheme('dark')}
                  style={{ borderRadius: 'var(--radius)',
                    padding: '5px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'none',
                    border: '1px solid var(--color-border)',
                    backgroundColor: theme === 'dark' ? 'var(--bg-cyan,var(--color-primary))' : 'var(--color-surface)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    letterSpacing: 'normal',
                  }}
                >
                  ☽ Dark
                </Button>
              </div>
            </div>
          </div>

          {/* API Keys */}
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'none', letterSpacing: 'normal', marginBottom: '12px' }}>
            API Keys: Isi provider yang ingin digunakan
          </p>

          {API_KEY_FIELDS.map(({ provider, field, label }) => {
            const isActive = provider === config.provider
            const docsUrl = PROVIDERS[provider]?.docsUrl
            return (
              <div key={field} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {label}
                  </Label>
                  {isActive && (
                    <span style={{ borderRadius: 'var(--radius)',  fontSize: '9px', fontWeight: 600, backgroundColor: 'var(--bg-cyan,var(--color-primary))', color: 'var(--on-accent,#111)', padding: '1px 6px', border: '1px solid var(--color-border)', textTransform: 'none' }}>
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
                  <Input aria-label={`Masukkan ${label}...`}
                    type={showKey[field] ? 'text' : 'password'}
                    value={keys[field] || ''}
                    onChange={(e) => { setKeys(prev => ({ ...prev, [field]: e.target.value })); setTestResult(null) }}
                    placeholder={`Masukkan ${label}...`}
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
                {field === currentProviderField && PROVIDERS[provider]?.docsUrl && (
                  <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', marginTop: '3px' }}>
                    Provider aktif: key ini yang dipakai untuk terjemahan sekarang.
                  </p>
                )}
              </div>
            )
          })}

          {/* Test */}
          <div className="flex items-center gap-3 mt-4 mb-3">
            <Button variant="default"
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2"
              style={{ padding: '8px 16px', fontSize: '12px', opacity: testing ? 0.5 : 1 }}
            >
              {testing ? <Loader2 size={13} className="animate-spin" /> : <TestTube size={13} />}
              TEST PROVIDER AKTIF
            </Button>
          </div>

          {testResult && (
            <div
              className="flex items-center gap-2 mb-4 px-3 py-2"
              style={{ borderRadius: 'var(--radius)',
                border: `1px solid ${testResult === 'success' ? 'var(--fg-green,#28E272)' : 'var(--fg-red,#FF3C3C)'}`,
                backgroundColor: testResult === 'success' ? 'rgba(40,226,114,0.08)' : 'rgba(255,60,60,0.08)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              {testResult === 'success'
                ? <CheckCircle size={14} style={{ color: 'var(--fg-green,#28E272)' }} />
                : <XCircle size={14} style={{ color: 'var(--fg-red,#FF3C3C)' }} />}
              {testMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline"
              onClick={onClose}
              className=""
              style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
            >
              BATAL
            </Button>
            <Button variant="default" onClick={handleSave} className="">
              SIMPAN
            </Button>
          </div>
        </div>
      </div>
    </ModalSurface>
  )
}
