/**
 * LWNTL Topbar Component
 * Dark navbar with LWNTL logo + settings gear
 */

import { useNavigate } from 'react-router-dom'
import { Settings, ArrowLeft } from 'lucide-react'

interface TopbarProps {
  showBack?: boolean
  title?: string
  subtitle?: string
}

export function Topbar({ showBack, title, subtitle }: TopbarProps) {
  const navigate = useNavigate()

  return (
    <div
      className="w-full flex items-center justify-between px-5 py-3"
      style={{
        backgroundColor: '#111111',
        borderBottom: '2.5px solid #111111',
      }}
    >
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
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center justify-center w-9 h-9 hover:opacity-80 transition-opacity"
          style={{ color: '#00F7FF' }}
          title="Pengaturan"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  )
}