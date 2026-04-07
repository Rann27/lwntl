/**
 * LWNTL Settings Page
 * Full page for API keys + language management
 */

import { useState } from 'react'
import { Eye, EyeOff, Plus, X, Globe, Languages } from 'lucide-react'
import { Topbar } from '../components/Topbar'
import { useAppStore } from '../store/appStore'
import { saveConfig } from '../api'
import { useToast } from '../hooks/useToast'
import type { AppConfig } from '../types'

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

      <main className="flex-1 overflow-y-auto flex items-start justify-center p-8" style={{ backgroundColor: '#F8F3EA' }}>
        <div style={{ width: '100%', maxWidth: '520px' }} className="space-y-5">
          {/* API Keys */}
          <div
            className="p-6"
            style={{
              backgroundColor: '#fff',
              border: '2.5px solid #111',
              boxShadow: '4px 4px 0px #111',
            }}
          >
            <h2
              className="mb-5"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '20px',
                color: '#111',
              }}
            >
              API KEYS
            </h2>

            {config ? (
              <ApiKeysForm config={config} onSave={handleSave} />
            ) : (
              <p style={{ color: '#999', fontSize: '14px' }}>Memuat konfigurasi...</p>
            )}
          </div>

          {/* Language Management */}
          <div
            className="p-6"
            style={{
              backgroundColor: '#fff',
              border: '2.5px solid #111',
              boxShadow: '4px 4px 0px #111',
            }}
          >
            <h2
              className="flex items-center gap-2 mb-5"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '20px',
                color: '#111',
              }}
            >
              <Languages size={20} />
              BAHASA
            </h2>

            {config ? (
              <LanguageForm config={config} onSave={handleSave} />
            ) : (
              <p style={{ color: '#999', fontSize: '14px' }}>Memuat konfigurasi...</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function ApiKeysForm({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
  const [zhipuaiKey, setZhipuaiKey] = useState(config.zhipuaiApiKey)
  const [qwenKey, setQwenKey] = useState(config.qwenApiKey)
  const [showZhipuai, setShowZhipuai] = useState(false)
  const [showQwen, setShowQwen] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ ...config, zhipuaiApiKey: zhipuaiKey, qwenApiKey: qwenKey })
    setSaving(false)
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          ZhipuAI (Z.AI) API Key
        </label>
        <div className="relative">
          <input
            type={showZhipuai ? 'text' : 'password'}
            value={zhipuaiKey}
            onChange={(e) => setZhipuaiKey(e.target.value)}
            placeholder="Masukkan ZhipuAI API key..."
            className="neo-input"
            style={{ paddingRight: '40px' }}
          />
          <button
            onClick={() => setShowZhipuai(!showZhipuai)}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}
          >
            {showZhipuai ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Alibaba Cloud (Qwen) API Key
        </label>
        <div className="relative">
          <input
            type={showQwen ? 'text' : 'password'}
            value={qwenKey}
            onChange={(e) => setQwenKey(e.target.value)}
            placeholder="Masukkan Qwen API key..."
            className="neo-input"
            style={{ paddingRight: '40px' }}
          />
          <button
            onClick={() => setShowQwen(!showQwen)}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}
          >
            {showQwen ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="neo-button w-full"
        style={{ opacity: saving ? 0.5 : 1 }}
      >
        {saving ? 'MENYIMPAN...' : 'SIMPAN API KEYS'}
      </button>
    </div>
  )
}

function LanguageForm({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => void }) {
  const [sourceLangs, setSourceLangs] = useState<string[]>(config.sourceLanguages || ['Japanese', 'Chinese', 'Korean'])
  const [targetLangs, setTargetLangs] = useState<string[]>(config.targetLanguages || ['Indonesian', 'English'])
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [saving, setSaving] = useState(false)

  const addSourceLang = () => {
    const val = newSource.trim()
    if (val && !sourceLangs.includes(val)) {
      setSourceLangs([...sourceLangs, val])
      setNewSource('')
    }
  }

  const addTargetLang = () => {
    const val = newTarget.trim()
    if (val && !targetLangs.includes(val)) {
      setTargetLangs([...targetLangs, val])
      setNewTarget('')
    }
  }

  const removeSourceLang = (lang: string) => {
    if (sourceLangs.length <= 1) return
    setSourceLangs(sourceLangs.filter(l => l !== lang))
  }

  const removeTargetLang = (lang: string) => {
    if (targetLangs.length <= 1) return
    setTargetLangs(targetLangs.filter(l => l !== lang))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      ...config,
      sourceLanguages: sourceLangs,
      targetLanguages: targetLangs,
    })
    setSaving(false)
  }

  return (
    <div>
      {/* Source Languages */}
      <div className="mb-5">
        <label className="flex items-center gap-1.5 mb-2" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>
          <Globe size={12} />
          Bahasa Sumber
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {sourceLangs.map(lang => (
            <span
              key={lang}
              className="flex items-center gap-1"
              style={{
                padding: '4px 10px',
                border: '2px solid #111',
                background: '#fff',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {lang}
              <button
                type="button"
                onClick={() => removeSourceLang(lang)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#999', padding: 0, lineHeight: 1 }}
                disabled={sourceLangs.length <= 1}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSourceLang() } }}
            placeholder="Tambah bahasa baru..."
            className="neo-input flex-1"
            style={{ padding: '6px 10px', fontSize: '13px' }}
          />
          <button type="button" onClick={addSourceLang} className="neo-button" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Target Languages */}
      <div className="mb-5">
        <label className="flex items-center gap-1.5 mb-2" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>
          <Languages size={12} />
          Bahasa Target
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {targetLangs.map(lang => (
            <span
              key={lang}
              className="flex items-center gap-1"
              style={{
                padding: '4px 10px',
                border: '2px solid #111',
                background: '#fff',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {lang}
              <button
                type="button"
                onClick={() => removeTargetLang(lang)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#999', padding: 0, lineHeight: 1 }}
                disabled={targetLangs.length <= 1}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTargetLang() } }}
            placeholder="Tambah bahasa baru..."
            className="neo-input flex-1"
            style={{ padding: '6px 10px', fontSize: '13px' }}
          />
          <button type="button" onClick={addTargetLang} className="neo-button" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="neo-button w-full"
        style={{ opacity: saving ? 0.5 : 1 }}
      >
        {saving ? 'MENYIMPAN...' : 'SIMPAN BAHASA'}
      </button>
    </div>
  )
}