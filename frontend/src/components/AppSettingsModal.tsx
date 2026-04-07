/**
 * LWNTL App Settings Modal
 * API key configuration modal
 */

import { useState, useEffect } from 'react'
import { Settings, X, Eye, EyeOff, TestTube, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { AppConfig } from '../types'
import { testConfig as testConfigApi } from '../api'

interface AppSettingsModalProps {
  open: boolean
  onClose: () => void
  config: AppConfig | null
  onSave: (config: AppConfig) => void
}

export function AppSettingsModal({ open, onClose, config, onSave }: AppSettingsModalProps) {
  const [zhipuaiKey, setZhipuaiKey] = useState('')
  const [qwenKey, setQwenKey] = useState('')
  const [showZhipuai, setShowZhipuai] = useState(false)
  const [showQwen, setShowQwen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    if (open && config) {
      setZhipuaiKey(config.zhipuaiApiKey)
      setQwenKey(config.qwenApiKey)
      setTestResult(null)
    }
  }, [open, config])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !config) return null

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // Save first so test uses the new keys
      const newConfig: AppConfig = { ...config, zhipuaiApiKey: zhipuaiKey, qwenApiKey: qwenKey }
      await onSave(newConfig)
      const result = await testConfigApi()
      setTestResult(result.success ? 'success' : 'error')
    } catch {
      setTestResult('error')
    }
    setTesting(false)
  }

  const handleSave = () => {
    const newConfig: AppConfig = { ...config, zhipuaiApiKey: zhipuaiKey, qwenApiKey: qwenKey }
    onSave(newConfig)
    onClose()
  }

  return (
    <div className="neo-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="neo-modal" style={{ maxWidth: '520px', animation: 'slideUp 150ms ease' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Settings size={20} />
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px' }}>
                PENGATURAN APLIKASI
              </h2>
            </div>
            <button onClick={onClose} className="hover:opacity-70" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          {/* ZhipuAI Key */}
          <div className="mb-4">
            <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ZhipuAI (Z.AI) API Key
            </label>
            <div className="relative">
              <input
                type={showZhipuai ? 'text' : 'password'}
                value={zhipuaiKey}
                onChange={(e) => { setZhipuaiKey(e.target.value); setTestResult(null) }}
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

          {/* Qwen Key */}
          <div className="mb-4">
            <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Alibaba Cloud (Qwen) API Key
            </label>
            <div className="relative">
              <input
                type={showQwen ? 'text' : 'password'}
                value={qwenKey}
                onChange={(e) => { setQwenKey(e.target.value); setTestResult(null) }}
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

          {/* Test connection */}
          <button
            onClick={handleTest}
            disabled={testing}
            className="neo-button flex items-center gap-2 mb-4"
            style={{ padding: '8px 16px', opacity: testing ? 0.5 : 1 }}
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
            TEST KONEKSI
          </button>

          {testResult && (
            <div
              className="flex items-center gap-2 mb-4 px-3 py-2"
              style={{
                border: `2px solid ${testResult === 'success' ? '#28E272' : '#FF3C3C'}`,
                backgroundColor: testResult === 'success' ? 'rgba(40,226,114,0.08)' : 'rgba(255,60,60,0.08)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {testResult === 'success' ? <CheckCircle size={14} style={{ color: '#28E272' }} /> : <XCircle size={14} style={{ color: '#FF3C3C' }} />}
              {testResult === 'success' ? 'Koneksi berhasil!' : 'Koneksi gagal. Periksa API key.'}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="neo-button" style={{ backgroundColor: '#F0F0F0' }}>
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