import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
/**
 * ChatGPTCard: connect a ChatGPT plan with OpenAI's Sign in with ChatGPT.
 *
 * Follows OpenAI's UI rules for plan usage: the sign-in button reads
 * "Continue with ChatGPT", a welcome dialog explains the first sign-in, and
 * "Using ChatGPT plan" sits next to a "Manage usage" link to the ChatGPT usage
 * settings. The sign-in itself happens in the system browser; this card polls
 * the backend for the outcome.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2, LogIn, LogOut, ExternalLink } from 'lucide-react'
import { chatgptStatus, chatgptLogin, chatgptCancelLogin, chatgptDisconnect, getConfig } from '../api'
import type { ChatGPTStatus } from '../api'
import { useAppStore } from '../store/appStore'
import type { AppConfig, EffortSetting } from '../types'

export const MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage'

/** "Using ChatGPT plan · Manage usage": shown wherever a ChatGPT worker is chosen. */
export function ChatGPTPlanBadge() {
  return (
    <span className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: '11px' }}>
      <span style={{ fontWeight: 600, padding: '1px 6px', background: 'var(--muted)', color: 'var(--background)' }}>Using ChatGPT plan</span>
      <a href={MANAGE_USAGE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-0.5"
        style={{ fontWeight: 600, color: 'var(--color-text)' }}>
        Manage usage <ExternalLink size={10} />
      </a>
    </span>
  )
}

function ContinueButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <Button variant="ghost" onClick={onClick} disabled={busy} className="flex items-center justify-center gap-2"
      style={{ borderRadius: 'var(--radius)',  width: '100%', padding: '10px 14px', background: 'var(--foreground)', color: 'var(--background)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : (
        <LogIn size={16} aria-hidden="true" />
      )}
      Continue with ChatGPT
    </Button>
  )
}

export function ChatGPTCard({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> | void }) {
  const setConfig = useAppStore(s => s.setConfig)
  const [status, setStatus] = useState<ChatGPTStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [welcome, setWelcome] = useState(false)
  const wasPending = useRef(false)
  const effort = (config.chatgptReasoningEffort ?? 'default') as EffortSetting

  const refresh = async () => {
    try {
      const s = await chatgptStatus()
      setStatus(s)
      if (wasPending.current && s.login.status !== 'pending') {
        wasPending.current = false
        if (s.connected) {
          setWelcome(true)
          setConfig(await getConfig())  // pickers now see the account
        }
      }
    } catch { /* keep the last status */ }
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (status?.login.status !== 'pending') return
    const t = setInterval(refresh, 1500)
    return () => clearInterval(t)
  }, [status?.login.status])

  const connect = async () => {
    setBusy(true)
    try {
      await chatgptLogin()
      wasPending.current = true
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Putuskan akun ChatGPT? Worker yang memakai ChatGPT berhenti sampai dihubungkan lagi.')) return
    await chatgptDisconnect()
    setConfig(await getConfig())
    await refresh()
  }

  const pending = status?.login.status === 'pending'
  const effortBtn = (v: EffortSetting, label: string) => (
    <Button variant="ghost" key={v} onClick={() => onSave({ ...config, chatgptReasoningEffort: v })}
      style={{ borderRadius: 'var(--radius)',  padding: '3px 9px', fontSize: '10px', fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer',
        backgroundColor: effort === v ? 'var(--bg-green,#28E272)' : 'var(--color-surface)', color: effort === v ? 'var(--on-accent,#111)' : 'var(--color-text-muted)' }}>
      {label}
    </Button>
  )

  return (
    <div className="flex flex-col gap-3 p-4" style={{ borderRadius: 'var(--radius)',  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'none', letterSpacing: '0.4px' }}>ChatGPT</span>
        <span style={{ borderRadius: 'var(--radius)',  fontSize: '9px', fontWeight: 600, padding: '1px 6px', border: '1px solid var(--color-border)' }}>TANPA API KEY</span>
        {status?.connected && <span style={{ borderRadius: 'var(--radius)',  fontSize: '9px', fontWeight: 600, padding: '1px 6px', background: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', border: '1px solid var(--color-border)' }}>TERHUBUNG</span>}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        Pakai paket ChatGPT-mu (Go, Plus, Pro, Business) untuk menerjemahkan: fitur resmi OpenAI <em>Sign in with ChatGPT</em> untuk aplikasi open-source yang berjalan lokal. Login terjadi di browser; token tersimpan hanya di komputer ini.
      </p>

      {!status ? (
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Memuat…</p>
      ) : status.connected ? (
        <>
          <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: '12px' }}>
            <strong>{status.email}</strong>
            <span style={{ marginLeft: 'auto' }}><ChatGPTPlanBadge /></span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'none' }}>Reasoning</span>
            <div className="flex gap-1 flex-wrap">
              {effortBtn('default', 'DEFAULT')}{effortBtn('low', 'LOW')}{effortBtn('medium', 'MED')}{effortBtn('high', 'HIGH')}{effortBtn('xhigh', 'XHIGH')}{effortBtn('max', 'MAX')}{effortBtn('ultra', 'ULTRA')}
            </div>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', lineHeight: 1.5 }}>
            Model paket ChatGPT tidak bisa mematikan reasoning: LOW adalah yang paling ringan (dan bawaan sebagian besar model).
            Level yang tidak ada di model terpilih dipetakan ke yang terdekat (mis. ULTRA → MAX di Luna).
            Temperature dan batas output tidak dikirim; daftar model mengikuti paketmu (pilih di tab Worker).
          </p>
          <Button variant="ghost" onClick={disconnect} className="flex items-center gap-1.5 self-start"
            style={{ borderRadius: 'var(--radius)',  fontSize: '11px', fontWeight: 600, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '4px 10px', cursor: 'pointer' }}>
            <LogOut size={12} /> PUTUSKAN
          </Button>
        </>
      ) : pending ? (
        <div className="flex flex-col gap-2" style={{ fontSize: '12px' }}>
          <span className="flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Menunggu login di browser…</span>
          <div className="flex gap-3 flex-wrap">
            {status.login.url && <a href={status.login.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--color-text)' }}>Browser tidak terbuka? Buka di sini</a>}
            <Button variant="ghost" onClick={async () => { await chatgptCancelLogin(); await refresh() }}
              style={{ borderRadius: 'var(--radius)',  fontSize: '11px', fontWeight: 600, border: 'none', background: 'none', color: 'var(--color-text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ContinueButton onClick={connect} busy={busy} />
          {status.login.status === 'error' && status.login.error && (
            <p style={{ fontSize: '11px', color: 'var(--fg-red,#FF3C3C)', fontWeight: 600 }}>{status.login.error}</p>
          )}
        </>
      )}

      {welcome && (
        <ModalSurface label="ChatGPT connection" onClose={() => setWelcome(false)} className="ui-modal-backdrop" style={{ zIndex: 1400 }} onClick={() => setWelcome(false)}>
          <div className="ui-modal" style={{ width: '440px', maxWidth: '92vw', padding: '22px 24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '18px', marginBottom: '8px' }}>You're using your ChatGPT plan</h3>
            <p style={{ fontSize: '13px', lineHeight: 1.6 }}>Eligible usage in this app uses your ChatGPT plan. Manage usage in your ChatGPT settings.</p>
            <p style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-text-muted)', marginTop: '6px' }}>
              Terjemahan dengan worker ChatGPT memakai kuota paket ChatGPT-mu, bukan saldo API.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <a href={MANAGE_USAGE_URL} target="_blank" rel="noreferrer" className="ui-button" style={{ fontSize: '12px', textDecoration: 'none', color: 'var(--on-accent,#111)', backgroundColor: 'var(--bg-cyan,#00F7FF)' }}>Manage usage</a>
              <Button variant="outline" onClick={() => setWelcome(false)} className="" style={{ color: 'var(--foreground)',  fontSize: '12px', backgroundColor: 'var(--color-surface-2)' }}>OK</Button>
            </div>
          </div>
        </ModalSurface>
      )}
    </div>
  )
}
