/**
 * LWNTL Topbar Component
 * Dark navbar with LWNTL logo + settings gear
 */

import { useNavigate } from 'react-router-dom'
import { Settings, ArrowLeft, ScrollText, Activity, Layers } from 'lucide-react'
import { useI18n } from '../i18n'
import { useState } from 'react'
import { WorkerLogPanel } from './WorkerLogPanel'
import { BatchersListPanel } from './BatchersListPanel'
import { ProfileSwitcherPanel } from './ProfileSwitcherPanel'
import { useAppStore } from '../store/appStore'

interface TopbarProps {
  showBack?: boolean
  title?: string
  subtitle?: string
}

export function Topbar({ showBack, title, subtitle }: TopbarProps) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [logsOpen, setLogsOpen] = useState(false)
  const [batchersOpen, setBatchersOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const batches = useAppStore((s) => s.batches)
  const profiles = useAppStore((s) => s.profiles)
  const activeBatchCount = Object.values(batches).filter((b) => b.status === 'translating').length

  return (
    <>
    <div className="w-full flex items-center justify-between px-5 py-3" style={{ backgroundColor: '#111111', borderBottom: '2.5px solid #111111' }}>
      {/* Left section */}
      <div className="flex items-center gap-4">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm font-bold hover:opacity-80 transition-opacity"
            style={{ color: '#00F7FF' }}
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: '22px',
              color: '#00F7FF',
              letterSpacing: '2px',
            }}
          >
            LWNTL
          </span>
          <span
            className="hidden sm:inline"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '11px',
              fontWeight: 600,
              color: '#666666',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            LN/WN Translator
          </span>
        </button>

        {/* Title & Subtitle */}
        {title && (
          <div className="flex items-center gap-2 ml-2">
            <span style={{ color: '#444', fontSize: '14px' }}>|</span>
            <div>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '16px',
                  color: '#FFFFFF',
                }}
              >
                {title}
              </span>
              {subtitle && (
                <span
                  className="ml-2"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#00F7FF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {subtitle}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Profile switcher */}
        {profiles.active && (
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ color: profileOpen ? '#00F7FF' : '#888', maxWidth: '140px' }}
            title="Ganti profil"
          >
            <Layers size={14} />
            <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.3px' }}>
              {profiles.active}
            </span>
          </button>
        )}

        {/* Batchers List — active batch monitor */}
        <button
          onClick={() => setBatchersOpen(true)}
          className="relative flex items-center justify-center w-9 h-9 hover:opacity-80 transition-opacity"
          style={{ color: activeBatchCount > 0 ? '#00F7FF' : '#444' }}
          title="Batch aktif"
        >
          <Activity size={20} />
          {activeBatchCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center"
              style={{
                width: '14px',
                height: '14px',
                backgroundColor: '#00F7FF',
                color: '#111',
                fontSize: '8px',
                fontWeight: 900,
                fontFamily: 'monospace',
              }}
            >
              {activeBatchCount}
            </span>
          )}
        </button>

        {/* Worker logs */}
        <button
          onClick={() => setLogsOpen(true)}
          className="flex items-center justify-center w-9 h-9 hover:opacity-80 transition-opacity"
          style={{ color: '#00F7FF' }}
          title="Worker log"
        >
          <ScrollText size={20} />
        </button>

        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center justify-center w-9 h-9 hover:opacity-80 transition-opacity"
          style={{ color: '#00F7FF' }}
          title={t.topbar.settings}
        >
          <Settings size={20} />
        </button>
      </div>
    </div>

    <WorkerLogPanel open={logsOpen} onClose={() => setLogsOpen(false)} />
    <BatchersListPanel open={batchersOpen} onClose={() => setBatchersOpen(false)} />
    <ProfileSwitcherPanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
