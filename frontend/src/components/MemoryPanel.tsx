/**
 * MemoryPanel - Display and manage compacted long-term memories
 */

import { useState } from 'react'
import { Trash2, Brain, ChevronDown, ChevronUp } from 'lucide-react'
import type { MemoryEntry } from '../types'

interface Props {
  memories: MemoryEntry[]
  onDeleteMemory?: (index: number) => void
}

export default function MemoryPanel({ memories, onDeleteMemory }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (memories.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-[#666]">
        <Brain size={24} className="mx-auto mb-2 text-[#ccc]" />
        <p>Belum ada memory.</p>
        <p className="text-xs mt-1">Memory akan otomatis terbentuk setelah 5+ bab diterjemahkan.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[#eee]">
      {memories.map((mem, i) => (
        <div key={i} className="border-b border-[#eee]">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#f0ebe1] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-[#FFEF33]" />
              <span className="text-xs font-bold font-space">{mem.range}</span>
              <span className="text-[10px] text-[#999]">({mem.chapterCount} bab)</span>
            </div>
            <div className="flex items-center gap-2">
              {onDeleteMemory && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteMemory(i) }}
                  className="p-1 text-[#ccc] hover:text-[#FF3C3C] transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
              {expanded === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>
          {expanded === i && (
            <div className="px-3 pb-3 text-xs text-[#444] leading-relaxed whitespace-pre-wrap">
              {mem.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}