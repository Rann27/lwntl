/**
 * ContextInfoBar - Token utilization display for context window
 * Shows breakdown of system/rolling/memory/current tokens
 */

import type { ContextInfo } from '../types'

interface Props {
  info: ContextInfo | null
}

const formatTokens = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function ContextInfoBar({ info }: Props) {
  if (!info) return null

  const { breakdown, fits, utilization } = info
  const warnColor = utilization > 90 ? '#FF3C3C' : utilization > 70 ? '#FFEF33' : '#28E272'

  return (
    <div style={{
      width: '100%',
      backgroundColor: 'var(--color-surface)',
      border: '2.5px solid var(--color-border)',
      boxShadow: '2px 2px 0px var(--color-border)',
      padding: '12px',
    }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em', color: 'var(--color-text)' }}>
          CONTEXT WINDOW
        </span>
        <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: warnColor }}>
          {formatTokens(info.totalTokens)} / {formatTokens(info.availableTokens)} tokens ({utilization}%)
        </span>
      </div>

      {/* Utilization bar */}
      <div style={{ height: '12px', backgroundColor: 'var(--color-surface-2)', border: '2px solid var(--color-border)', position: 'relative', marginBottom: '8px' }}>
        <div className="h-full flex" style={{ width: `${Math.min(utilization, 100)}%` }}>
          <div className="h-full transition-all" title={`System: ${breakdown.system}`}
            style={{ width: `${(breakdown.system / info.totalTokens) * 100}%`, backgroundColor: 'var(--color-text-muted)' }} />
          <div className="h-full transition-all" title={`Rolling: ${breakdown.rolling}`}
            style={{ width: `${(breakdown.rolling / info.totalTokens) * 100}%`, backgroundColor: '#00F7FF' }} />
          <div className="h-full transition-all" title={`Memory: ${breakdown.memory}`}
            style={{ width: `${(breakdown.memory / info.totalTokens) * 100}%`, backgroundColor: '#FFEF33' }} />
          <div className="h-full transition-all" title={`Current: ${breakdown.current}`}
            style={{ width: `${(breakdown.current / info.totalTokens) * 100}%`, backgroundColor: '#28E272' }} />
        </div>
        {!fits && (
          <div className="absolute right-0 top-0 h-full w-2 bg-[#FF3C3C] animate-pulse" />
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: 'var(--color-text-muted)' }} /> System {formatTokens(breakdown.system)}
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#00F7FF' }} /> Rolling {formatTokens(breakdown.rolling)}
          {info.summariesAvailable > 0 && <span style={{ color: 'var(--color-text-subtle)' }}>({info.summariesAvailable} bab)</span>}
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#FFEF33' }} /> Memory {formatTokens(breakdown.memory)}
          {info.memoriesAvailable > 0 && <span style={{ color: 'var(--color-text-subtle)' }}>({info.memoriesAvailable} blok)</span>}
        </span>
        <span className="flex items-center gap-1">
          <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#28E272' }} /> Current {formatTokens(breakdown.current)}
        </span>
      </div>
    </div>
  )
}
