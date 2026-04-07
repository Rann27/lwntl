/**
 * LWNTL Onboarding Modal
 * First-run setup wizard for API keys
 */

import { useState } from 'react'
import { Rocket, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { PROVIDERS } from '../types'

interface OnboardingModalProps {
  open: boolean
  onComplete: (provider: 'zhipuai' | 'qwen', apiKey: string) => void
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0)
  const [provider, setProvider] = useState<'zhipuai' | 'qwen'>('zhipuai')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleNext = () => {
    if (step === 0) {
      setStep(1)
    } else {
      setLoading(true)
      onComplete(provider, apiKey)
    }
  }

  const providerInfo: Record<string, { name: string; description: string; models: string[] }> = {
    zhipuai: {
      name: 'ZhipuAI (Z.AI)',
      description: 'Provider AI China dengan model GLM. Recommended untuk terjemahan JP/ID.',
      models: PROVIDERS.zhipuai.models,
    },
    qwen: {
      name: 'Alibaba Cloud (Qwen)',
      description: 'Provider AI Alibaba dengan model Qwen & DeepSeek.',
      models: PROVIDERS.qwen.models,
    },
  }

  return (
    <div
      className="neo-modal-backdrop"
      style={{ backgroundColor: 'rgba(17, 17, 17, 0.9)' }}
    >
      <div
        className="neo-modal"
        style={{ maxWidth: '520px', animation: 'slideUp 200ms ease' }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-16 h-16 mb-4"
              style={{
                backgroundColor: '#00F7FF',
                border: '3px solid #111',
                boxShadow: '6px 6px 0px #111',
              }}
            >
              <Rocket size={32} />
            </div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900,
                fontSize: '28px',
                color: '#111',
                letterSpacing: '1px',
              }}
            >
              LWNTL
            </h1>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              Light Novel / Web Novel Translator
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {[0, 1].map((s) => (
              <div
                key={s}
                style={{
                  width: step >= s ? '32px' : '12px',
                  height: '12px',
                  backgroundColor: step >= s ? '#00F7FF' : '#ddd',
                  border: '2.5px solid #111',
                  transition: 'all 200ms ease',
                }}
              />
            ))}
          </div>

          {/* Step 0: Choose Provider */}
          {step === 0 && (
            <div>
              <h2 className="text-center mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '18px' }}>
                PILIH PROVIDER AI
              </h2>
              <p className="text-center mb-5" style={{ fontSize: '13px', color: '#666' }}>
                Pilih provider LLM yang akan digunakan untuk terjemahan
              </p>

              <div className="space-y-3">
                {(['zhipuai', 'qwen'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className="w-full text-left p-4 transition-all"
                    style={{
                      border: `2.5px solid ${provider === p ? '#00F7FF' : '#111'}`,
                      boxShadow: provider === p ? '4px 4px 0px #00F7FF' : '4px 4px 0px #111',
                      backgroundColor: provider === p ? 'rgba(0,247,255,0.05)' : '#fff',
                      cursor: 'pointer',
                      transform: provider === p ? 'translate(2px, 2px)' : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '15px' }}>{providerInfo[p].name}</p>
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{providerInfo[p].description}</p>
                      </div>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          border: `2.5px solid #111`,
                          backgroundColor: provider === p ? '#00F7FF' : 'transparent',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {providerInfo[p].models.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            border: '1.5px solid #111',
                            backgroundColor: '#F8F3EA',
                          }}
                        >
                          {PROVIDERS[p].displayNames[m] || m}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Enter API Key */}
          {step === 1 && (
            <div>
              <h2 className="text-center mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '18px' }}>
                MASUKKAN API KEY
              </h2>
              <p className="text-center mb-5" style={{ fontSize: '13px', color: '#666' }}>
                Masukkan API key untuk {providerInfo[provider].name}
              </p>

              <div className="mb-4">
                <label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste API key di sini..."
                    className="neo-input"
                    style={{ paddingRight: '40px' }}
                    autoFocus
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => { setStep(0); setApiKey('') }}
                className="text-sm font-semibold"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', textDecoration: 'underline' }}
              >
                ← Ganti provider
              </button>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-center mt-6">
            <button
              onClick={handleNext}
              disabled={step === 1 && !apiKey.trim()}
              className="neo-button flex items-center gap-2"
              style={{
                padding: '12px 32px',
                fontSize: '15px',
                opacity: step === 1 && !apiKey.trim() ? 0.5 : 1,
              }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {step === 0 ? 'LANJUT' : 'MULAI MENGGUNAKAN LWNTL'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}