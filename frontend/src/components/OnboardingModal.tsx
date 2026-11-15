import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
/**
 * LWNTL Onboarding Modal
 * First-run setup wizard for API keys
 */

import { useState } from 'react'
import { BookOpen, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { PROVIDERS } from '../types'
import { useI18n } from '../i18n'

interface OnboardingModalProps {
  open: boolean
  onComplete: (provider: 'zhipuai' | 'qwen', apiKey: string) => void
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const { t } = useI18n()
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
    <ModalSurface label="Welcome to LWNTL" onClose={() => {}} dismissible={false}
      className="ui-modal-backdrop"
      style={{ backgroundColor: 'rgba(17, 17, 17, 0.9)' }}
    >
      <div
        className="ui-modal"
        style={{ maxWidth: '520px', animation: 'slideUp 200ms ease' }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-16 h-16 mb-4"
              style={{ borderRadius: 'var(--radius)',
                backgroundColor: 'var(--bg-cyan,#00F7FF)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <BookOpen size={32} />
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 650,
                fontSize: '28px',
                color: 'var(--on-accent,#111)',
                letterSpacing: 'normal',
              }}
            >
              LWNTL
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--fg-muted,#666)', marginTop: '4px' }}>
              Light Novel / Web Novel Translator
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {[0, 1].map((s) => (
              <div
                key={s}
                style={{ borderRadius: 'var(--radius)',
                  width: step >= s ? '32px' : '12px',
                  height: '12px',
                  backgroundColor: step >= s ? 'var(--bg-cyan,#00F7FF)' : '#ddd',
                  border: '1px solid var(--border)',
                  transition: 'all 200ms ease',
                }}
              />
            ))}
          </div>

          {/* Step 0: Choose Provider */}
          {step === 0 && (
            <div>
              <h2 className="text-center mb-4" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '18px' }}>
                {t.seriesSettings.provider}
              </h2>
              <p className="text-center mb-5" style={{ fontSize: '13px', color: 'var(--fg-muted,#666)' }}>
                {t.onboarding.step1Desc}
              </p>

              <div className="space-y-3">
                {(['zhipuai', 'qwen'] as const).map((p) => (
                  <Button variant="ghost"
                    key={p}
                    onClick={() => setProvider(p)}
                    className="h-auto w-full flex-col items-stretch whitespace-normal p-4 text-left"
                    style={{ color: 'var(--foreground)',  borderRadius: 'var(--radius)',
                      border: `1px solid ${provider === p ? 'var(--fg-cyan,#00F7FF)' : 'var(--border)'}`,
                      boxShadow: provider === p ? 'var(--shadow-sm)' : 'var(--shadow-sm)',
                      backgroundColor: provider === p ? 'rgba(0,247,255,0.05)' : 'var(--bg-surface,#fff)',
                      cursor: 'pointer',
                      transform: provider === p ? 'none' : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '15px' }}>{providerInfo[p].name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--fg-muted,#666)', marginTop: '2px' }}>{providerInfo[p].description}</p>
                      </div>
                      <div
                        style={{ borderRadius: 'var(--radius)',
                          width: '20px',
                          height: '20px',
                          border: `1px solid var(--border)`,
                          backgroundColor: provider === p ? 'var(--bg-cyan,#00F7FF)' : 'transparent',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {providerInfo[p].models.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          style={{ borderRadius: 'var(--radius)',
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-page,#F8F3EA)',
                          }}
                        >
                          {PROVIDERS[p].displayNames[m] || m}
                        </span>
                      ))}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Enter API Key */}
          {step === 1 && (
            <div>
              <h2 className="text-center mb-4" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '18px' }}>
                API KEY
              </h2>
              <p className="text-center mb-5" style={{ fontSize: '13px', color: 'var(--fg-muted,#666)' }}>
                {providerInfo[provider].name}
              </p>

              <div className="mb-4">
                <Label className="block mb-1.5" style={{ fontSize: '13px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>
                  API Key
                </Label>
                <div className="relative">
                  <Input aria-label="API Key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API key..."
                    className="ui-input"
                    style={{ paddingRight: '40px' }}
                    autoFocus
                  />
                  <Button aria-label="Show or hide API key" variant="ghost"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-muted,#666)' }}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
              </div>

              <Button variant="ghost"
                onClick={() => { setStep(0); setApiKey('') }}
                className="text-sm font-semibold"
                style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-muted,#666)', textDecoration: 'underline' }}
              >
                ← {t.seriesSettings.provider}
              </Button>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-center mt-6">
            <Button variant="default"
              onClick={handleNext}
              disabled={step === 1 && !apiKey.trim()}
              className="flex items-center gap-2"
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
                  {step === 0 ? t.onboarding.getStarted : t.onboarding.getStarted}
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalSurface>
  )
}
