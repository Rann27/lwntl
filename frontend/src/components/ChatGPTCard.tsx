/**
 * ChatGPTCard — connect a ChatGPT plan with OpenAI's Sign in with ChatGPT.
 *
 * Follows OpenAI's UI rules for plan usage: the sign-in button reads
 * "Continue with ChatGPT", a welcome dialog explains the first sign-in, and
 * "Using ChatGPT plan" sits next to a "Manage usage" link to the ChatGPT usage
 * settings. The sign-in itself happens in the system browser; this card polls
 * the backend for the outcome.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2, LogOut, ExternalLink } from 'lucide-react'
import { chatgptStatus, chatgptLogin, chatgptCancelLogin, chatgptDisconnect, getConfig } from '../api'
import type { ChatGPTStatus } from '../api'
import { useAppStore } from '../store/appStore'
import type { AppConfig, EffortSetting } from '../types'

export const MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage'

/** "Using ChatGPT plan · Manage usage" — shown wherever a ChatGPT worker is chosen. */
export function ChatGPTPlanBadge() {
  return (
    <span className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: '11px' }}>
      <span style={{ fontWeight: 800, padding: '1px 6px', background: '#111', color: '#fff' }}>Using ChatGPT plan</span>
      <a href={MANAGE_USAGE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-0.5"
        style={{ fontWeight: 700, color: 'var(--color-text)' }}>
        Manage usage <ExternalLink size={10} />
      </a>
    </span>
  )
}

function ContinueButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className="flex items-center justify-center gap-2"
      style={{ width: '100%', padding: '10px 14px', background: '#111', color: '#fff', border: '2.5px solid #111', boxShadow: '3px 3px 0 var(--color-border)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="#fff" /></svg>
      )}
      Continue with ChatGPT
    </button>
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
    <button key={v} onClick={() => onSave({ ...config, chatgptReasoningEffort: v })}
      style={{ padding: '3px 9px', fontSize: '10px', fontWeight: 700, border: '2px solid var(--color-border)', cursor: 'pointer',
        backgroundColor: effort === v ? 'var(--bg-green,#28E272)' : 'var(--color-surface)', color: effort === v ? 'var(--on-accent,#111)' : 'var(--color-text-muted)' }}>
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-3 p-4" style={{ border: '2.5px solid var(--color-border)', backgroundColor: 'var(--color-surface)', boxShadow: 'var(--neo-shadow)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>ChatGPT</span>
        <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 6px', border: '1.5px solid var(--color-border)' }}>TANPA API KEY</span>
        {status?.connected && <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 6px', background: 'var(--bg-green,#28E272)', color: 'var(--on-accent,#111)', border: '1.5px solid var(--color-border)' }}>TERHUBUNG</span>}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        Pakai paket ChatGPT-mu (Go, Plus, Pro, Business) untuk menerjemahkan — fitur resmi OpenAI <em>Sign in with ChatGPT</em> untuk aplikasi open-source yang berjalan lokal. Login terjadi di browser; token tersimpan hanya di komputer ini.
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
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Reasoning</span>
            <div className="flex gap-1 flex-wrap">
              {effortBtn('default', 'DEFAULT')}{effortBtn('low', 'LOW')}{effortBtn('medium', 'MED')}{effortBtn('high', 'HIGH')}{effortBtn('xhigh', 'XHIGH')}{effortBtn('max', 'MAX')}{effortBtn('ultra', 'ULTRA')}
            </div>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--color-text-subtle)', lineHeight: 1.5 }}>
            Model paket ChatGPT tidak bisa mematikan reasoning — LOW adalah yang paling ringan (dan bawaan sebagian besar model).
            Level yang tidak ada di model terpilih dipetakan ke yang terdekat (mis. ULTRA → MAX di Luna).
            Temperature dan batas output tidak dikirim; daftar model mengikuti paketmu (pilih di tab Worker).
          </p>
          <button onClick={disconnect} className="flex items-center gap-1.5 self-start"
            style={{ fontSize: '11px', fontWeight: 700, border: '2px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', padding: '4px 10px', cursor: 'pointer' }}>
            <LogOut size={12} /> PUTUSKAN
          </button>
        </>
      ) : pending ? (
        <div className="flex flex-col gap-2" style={{ fontSize: '12px' }}>
          <span className="flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Menunggu login di browser…</span>
          <div className="flex gap-3 flex-wrap">
            {status.login.url && <a href={status.login.url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'var(--color-text)' }}>Browser tidak terbuka? Buka di sini</a>}
            <button onClick={async () => { await chatgptCancelLogin(); await refresh() }}
              style={{ fontSize: '11px', fontWeight: 700, border: 'none', background: 'none', color: 'var(--color-text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>
              Batal
            </button>
          </div>
        </div>
      ) : (
        <>
          <ContinueButton onClick={connect} busy={busy} />
          {status.login.status === 'error' && status.login.error && (
            <p style={{ fontSize: '11px', color: 'var(--fg-red,#FF3C3C)', fontWeight: 700 }}>{status.login.error}</p>
          )}
        </>
      )}

      {welcome && (
        <div className="neo-modal-backdrop" style={{ zIndex: 1400 }} onClick={() => setWelcome(false)}>
          <div className="neo-modal" style={{ width: '440px', maxWidth: '92vw', padding: '22px 24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>You're using your ChatGPT plan</h3>
            <p style={{ fontSize: '13px', lineHeight: 1.6 }}>Eligible usage in this app uses your ChatGPT plan. Manage usage in your ChatGPT settings.</p>
            <p style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-text-muted)', marginTop: '6px' }}>
              Terjemahan dengan worker ChatGPT memakai kuota paket ChatGPT-mu, bukan saldo API.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <a href={MANAGE_USAGE_URL} target="_blank" rel="noreferrer" className="neo-button" style={{ fontSize: '12px', textDecoration: 'none', color: 'var(--on-accent,#111)', backgroundColor: 'var(--bg-cyan,#00F7FF)' }}>Manage usage</a>
              <button onClick={() => setWelcome(false)} className="neo-button" style={{ fontSize: '12px', backgroundColor: 'var(--color-surface-2)' }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
