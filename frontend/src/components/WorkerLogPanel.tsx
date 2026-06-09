import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { getWorkerLogs, getWorkerStatuses } from '../api'
import type { WorkerStatus } from '../types'

interface Props {
  open: boolean
  onClose: () => void
}

export function WorkerLogPanel({ open, onClose }: Props) {
  const [workers, setWorkers] = useState<WorkerStatus[]>([])
  const [selected, setSelected] = useState('all')
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const tabs = useMemo(() => [{ id: 'all', label: 'All Workers' }, ...workers.map(w => ({ id: w.id, label: w.label }))], [workers])

  const load = async () => {
    if (!open) return
    setLoading(true)
    try {
      const [statuses, log] = await Promise.all([
        getWorkerStatuses(),
        getWorkerLogs(selected),
      ])
      setWorkers(statuses)
      setLines(log.lines || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    load()
    const timer = window.setInterval(load, 1500)
    return () => window.clearInterval(timer)
  }, [open, selected]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div style={{ width: 'min(980px, 100%)', maxHeight: '85vh', backgroundColor: 'var(--color-surface)', border: '2.5px solid var(--color-border)', boxShadow: 'var(--neo-shadow-lg)', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--color-text)' }}>
            WORKER LOG
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={load} className="neo-button flex items-center gap-1" style={{ padding: '5px 10px', fontSize: '11px', opacity: loading ? 0.5 : 1 }}>
              <RefreshCw size={13} /> REFRESH
            </button>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ borderBottom: '2px solid var(--color-border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelected(tab.id)}
              style={{
                padding: '6px 10px',
                border: '2px solid var(--color-border)',
                backgroundColor: selected === tab.id ? '#00F7FF' : 'var(--color-surface-2)',
                color: selected === tab.id ? '#111' : 'var(--color-text)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <pre
          style={{
            margin: 0,
            padding: '14px',
            minHeight: '360px',
            overflow: 'auto',
            backgroundColor: '#111',
            color: '#E8FFF9',
            fontSize: '12px',
            lineHeight: 1.55,
            fontFamily: "'Courier New', monospace",
            whiteSpace: 'pre-wrap',
          }}
        >
          {lines.length ? lines.join('\n') : 'No worker logs yet.'}
        </pre>
      </div>
    </div>
  )
}
