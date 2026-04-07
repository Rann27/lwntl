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
  const warnColor = utilization > 90 ? 'text-[#FF3C3C]' : utilization > 70 ? 'text-[#FFEF33]' : 'text-[#28E272]'

  return (
    <div className="w-full bg-white border-2.5 border-[#111] shadow-[2px_2px_0px_#111] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold font-space tracking-wide">CONTEXT WINDOW</span>
        <span className={`text-xs font-mono font-bold ${warnColor}`}>
          {formatTokens(info.totalTokens)} / {formatTokens(info.availableTokens)} tokens ({utilization}%)
        </span>
      </div>

      {/* Utilization bar */}
      <div className="h-3 bg-[#eee] border-2 border-[#111] relative mb-2">
        {/* Segmented fill */}
        <div className="h-full flex" style={{ width: `${Math.min(utilization, 100)}%` }}>
          <div className="h-full bg-[#666] transition-all" title={`System: ${breakdown.system}`}
            style={{ width: `${(breakdown.system / info.totalTokens) * 100}%` }} />
          <div className="h-full bg-[#00F7FF] transition-all" title={`Rolling: ${breakdown.rolling}`}
            style={{ width: `${(breakdown.rolling / info.totalTokens) * 100}%` }} />
          <div className="h-full bg-[#FFEF33] transition-all" title={`Memory: ${breakdown.memory}`}
            style={{ width: `${(breakdown.memory / info.totalTokens) * 100}%` }} />
          <div className="h-full bg-[#28E272] transition-all" title={`Current: ${breakdown.current}`}
            style={{ width: `${(breakdown.current / info.totalTokens) * 100}%` }} />
        </div>
        {!fits && (
          <div className="absolute right-0 top-0 h-full w-2 bg-[#FF3C3C] animate-pulse" />
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-[#666]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-[#666]" /> System {formatTokens(breakdown.system)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-[#00F7FF]" /> Rolling {formatTokens(breakdown.rolling)}
          {info.summariesAvailable > 0 && <span className="text-[#999]">({info.summariesAvailable} bab)</span>}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-[#FFEF33]" /> Memory {formatTokens(breakdown.memory)}
          {info.memoriesAvailable > 0 && <span className="text-[#999]">({info.memoriesAvailable} blok)</span>}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-[#28E272]" /> Current {formatTokens(breakdown.current)}
        </span>
      </div>
    </div>
  )
}