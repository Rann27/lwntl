/**
 * LWNTL App Root
 * Routes + API initialization + Onboarding
 */

import { useState, useEffect, Component, type ReactNode } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ToastContainer } from './components/ToastContainer'
import { OnboardingModal } from './components/OnboardingModal'
import { HomePage } from './pages/HomePage'
import { SeriesSettingsPage } from './pages/SeriesSettingsPage'
import { ChapterWorkspacePage } from './pages/ChapterWorkspacePage'
import { SettingsPage } from './pages/SettingsPage'
import { useAppStore } from './store/appStore'
import { waitForApi, getConfig, saveConfig } from './api'
import { useToast } from './hooks/useToast'

// Error Boundary - catches render crashes and shows error instead of blank page
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, backgroundColor: '#F8F3EA', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#FF3C3C', marginBottom: 8 }}>RENDER ERROR</h1>
          <pre style={{ fontSize: 13, color: '#111', whiteSpace: 'pre-wrap', background: '#fff', padding: 16, border: '2px solid #111' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 16px', border: '2px solid #111', background: '#00F7FF', fontWeight: 700, cursor: 'pointer' }}
          >
            COBA LAGI
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppInner() {
  const { config, setConfig, setApiReady } = useAppStore()
  const toast = useToast()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [initializing, setInitializing] = useState(true)

  // Apply theme to document root whenever config.theme changes
  useEffect(() => {
    const theme = config?.theme || 'light'
    document.documentElement.setAttribute('data-theme', theme)
  }, [config?.theme])

  // Wait for pywebview API and load config
  useEffect(() => {
    const init = async () => {
      try {
        await waitForApi()
        setApiReady(true)

        const cfg = await getConfig()
        setConfig(cfg)

        // Check if onboarding needed (no API keys configured)
        const hasAnyKey = cfg.zhipuaiApiKey || cfg.qwenApiKey || cfg.openaiApiKey ||
          cfg.geminiApiKey || cfg.anthropicApiKey || cfg.xaiApiKey || cfg.moonshotApiKey
        if (!hasAnyKey) {
          setShowOnboarding(true)
        }
      } catch (err) {
        console.error('Failed to initialize:', err)
        toast.error('Gagal menginisialisasi aplikasi')
      } finally {
        setInitializing(false)
      }
    }
    init()
  }, [])

  // Onboarding complete
  const handleOnboardingComplete = async (provider: 'zhipuai' | 'qwen', apiKey: string) => {
    if (!config) return
    const newConfig = { ...config }
    if (provider === 'zhipuai') {
      newConfig.zhipuaiApiKey = apiKey
    } else {
      newConfig.qwenApiKey = apiKey
    }
    newConfig.provider = provider
    try {
      await saveConfig(newConfig)
      setConfig(newConfig)
      setShowOnboarding(false)
      toast.success('Setup selesai! Mulai dengan menambahkan series.')
    } catch {
      toast.error('Gagal menyimpan konfigurasi')
    }
  }

  if (initializing) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100vh', backgroundColor: '#F8F3EA' }}
      >
        <div className="text-center">
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: '36px',
              color: '#111',
              letterSpacing: '2px',
            }}
          >
            LWNTL
          </h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
            Memuat...
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/series/:id/settings" element={<SeriesSettingsPage />} />
        <Route path="/series/:id/chapter/:chapterId" element={<ChapterWorkspacePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      <OnboardingModal
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      <ToastContainer />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <AppInner />
      </ErrorBoundary>
    </HashRouter>
  )
}