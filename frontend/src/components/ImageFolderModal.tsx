/**
 * ImageFolderModal
 *
 * Assigns an image source to a series and links `Image Placeholder: <file>` lines
 * to the real images.
 *
 * DOCX/PDF imports bring their images along; TXT, MD and manually typed chapters
 * only carry the placeholder line. Because matching keys off the filename in that
 * line, one image source serves every input type — including older DOCX/PDF
 * chapters imported before image support existed.
 *
 * Three ways to supply images, per the same panel:
 *   - type/paste a folder path
 *   - pick a folder through the native dialog
 *   - drop image files straight in (stored in a managed pool for the series)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { DragEvent } from 'react'
import { X, FolderOpen, Upload, RefreshCw, Loader2, Check, AlertCircle, Trash2, Image as ImageIcon } from 'lucide-react'
import {
  pickImageFolder, describeImageFolder, getSeriesImageStatus,
  uploadSeriesImages, syncSeriesImages, clearSeriesImagePool, updateSeries,
} from '../api'
import type { ImageFolderInfo, ImageSyncResult } from '../api'
import type { Series } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  series: Series | null
  onSeriesUpdated: (s: Series) => void
  onSynced: () => void
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ImageFolderModal({ open, onClose, series, onSeriesUpdated, onSynced }: Props) {
  const [path, setPath] = useState('')
  const [info, setInfo] = useState<ImageFolderInfo | null>(null)
  const [poolCount, setPoolCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<ImageSyncResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshStatus = useCallback(async () => {
    if (!series) return
    try {
      const s = await getSeriesImageStatus(series.id)
      setPoolCount(s.poolCount)
    } catch { /* non-critical */ }
  }, [series])

  useEffect(() => {
    if (!open || !series) return
    setPath(series.imageFolder || '')
    setResult(null)
    setError('')
    refreshStatus()
  }, [open, series, refreshStatus])

  // Validate the typed path as the user edits it
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      if (!path.trim()) { setInfo(null); return }
      try {
        const d = await describeImageFolder(path)
        if (!cancelled) setInfo(d)
      } catch { if (!cancelled) setInfo(null) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [path, open])

  if (!open || !series) return null

  const savePath = async (next: string) => {
    setError('')
    try {
      const updated = await updateSeries(
        series.id, series.title, series.sourceLanguage, series.targetLanguage,
        undefined, undefined, undefined, undefined, next,
      )
      onSeriesUpdated(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const browse = async () => {
    try {
      const picked = await pickImageFolder(path)
      if (picked) { setPath(picked); await savePath(picked) }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const uploadFiles = async (files: File[]) => {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length || !series) return
    setUploading(true); setError('')
    try {
      const payload = await Promise.all(
        imgs.map(async f => ({ filename: f.name, data: await fileToBase64(f) }))
      )
      await uploadSeriesImages(series.id, payload)
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const runSync = async () => {
    setSyncing(true); setError(''); setResult(null)
    try {
      const res = await syncSeriesImages(series.id)
      setResult(res)
      setPoolCount(res.poolCount)
      onSynced()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  const clearPool = async () => {
    try {
      await clearSeriesImagePool(series.id)
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files) uploadFiles(Array.from(e.dataTransfer.files))
  }

  const hasSource = (info?.count ?? 0) > 0 || poolCount > 0

  return (
    <div className="neo-modal-backdrop" style={{ zIndex: 210 }} onClick={onClose}>
      <div
        className="neo-modal"
        style={{ width: '640px', maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2.5px solid var(--color-border)', backgroundColor: 'var(--bg-blue,#9AD5FF)', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <ImageIcon size={17} color="#111" />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '15px', color: 'var(--on-accent,#111)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Image Source
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-accent,#111)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4" style={{ minHeight: 0, overflowY: 'auto' }}>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
            Baris <code style={{ background: 'var(--color-surface-2)', padding: '1px 4px' }}>Image Placeholder: nama.jpg</code>{' '}
            akan dicocokkan ke gambar berdasarkan namanya. Berlaku untuk semua jenis input —
            TXT, MD, ketik manual, maupun DOCX/PDF lama.
            <br />
            <span style={{ color: 'var(--color-text-subtle)' }}>
              Nama harus <strong>sama persis</strong> termasuk huruf besar/kecil. Hanya ekstensi
              yang boleh berbeda (<code>cover.jpg</code> menemukan <code>cover.png</code>).
            </span>
          </p>

          {/* Folder path */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
              Folder gambar
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                value={path}
                onChange={e => setPath(e.target.value)}
                onBlur={() => savePath(path)}
                onKeyDown={e => { if (e.key === 'Enter') savePath(path) }}
                placeholder="C:\path\ke\folder\gambar"
                className="neo-input"
                style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
              />
              <button onClick={browse} className="neo-button flex items-center gap-1" style={{ fontSize: '11px', flexShrink: 0 }}>
                <FolderOpen size={13} /> BROWSE
              </button>
            </div>
            {path.trim() && info && (
              <p style={{ fontSize: '11px', marginTop: '5px', color: info.exists ? 'var(--fg-green,#1a8f4c)' : 'var(--fg-red,#FF3C3C)', fontWeight: 600 }}>
                {info.exists
                  ? `✓ ${info.count} gambar${info.samples.length ? ` — ${info.samples.slice(0, 3).join(', ')}${info.count > 3 ? '…' : ''}` : ''}`
                  : '✗ Folder tidak ditemukan'}
              </p>
            )}
          </div>

          {/* Drop zone */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)' }}>
              Atau jatuhkan gambar langsung
            </label>
            <div
              className="flex flex-col items-center justify-center gap-1.5 mt-1.5"
              style={{
                border: `2.5px dashed ${dragOver ? 'var(--fg-blue,#0077FF)' : 'var(--color-separator)'}`,
                background: dragOver ? 'rgba(0,119,255,0.06)' : 'var(--color-surface-2)',
                padding: '20px', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              {uploading
                ? <><Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} /><span style={{ fontSize: '12px', fontWeight: 700 }}>Menyimpan...</span></>
                : <>
                    <Upload size={22} style={{ color: dragOver ? 'var(--fg-blue,#0077FF)' : 'var(--color-text-subtle)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: dragOver ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {dragOver ? '↓ Lepaskan' : 'Drag & drop gambar ke sini'}
                    </span>
                  </>}
              <input
                ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { if (e.target.files) { uploadFiles(Array.from(e.target.files)); e.target.value = '' } }}
              />
            </div>
            {poolCount > 0 && (
              <div className="flex items-center justify-between mt-1.5">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {poolCount} gambar tersimpan di series ini
                </span>
                <button onClick={clearPool} className="flex items-center gap-1" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-red,#FF3C3C)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                  <Trash2 size={11} /> Kosongkan
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2" style={{ border: '2px solid var(--fg-red,#FF3C3C)', background: 'rgba(255,60,60,0.07)' }}>
              <AlertCircle size={14} color="var(--fg-red,#FF3C3C)" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '11px', color: 'var(--fg-red,#FF3C3C)' }}>{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="px-3 py-2.5" style={{ border: '2px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: result.missing ? '6px' : 0 }}>
                <Check size={14} color="var(--fg-green,#1a8f4c)" />
                <span style={{ fontSize: '12px', fontWeight: 700 }}>
                  {result.matched} gambar terpasang di {result.chaptersUpdated} chapter
                </span>
              </div>
              {result.missing > 0 && (
                <div>
                  <p style={{ fontSize: '11px', color: '#C97A00', fontWeight: 700, margin: '0 0 3px' }}>
                    {result.missing} placeholder tidak ketemu gambarnya:
                  </p>
                  <p style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5, wordBreak: 'break-all' }}>
                    {result.missingNames.join(', ')}
                  </p>
                </div>
              )}
              {result.matched === 0 && result.missing === 0 && (
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                  Semua placeholder sudah terpasang sebelumnya.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '2.5px solid var(--color-border)', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            Sumber: {info?.count ?? 0} folder · {poolCount} tersimpan
          </span>
          <button
            onClick={runSync}
            disabled={syncing || !hasSource}
            className="neo-button flex items-center gap-2"
            style={{ backgroundColor: 'var(--bg-blue,#9AD5FF)', opacity: syncing || !hasSource ? 0.5 : 1 }}
          >
            {syncing
              ? <><Loader2 size={14} className="animate-spin" /> MEMASANG...</>
              : <><RefreshCw size={14} /> PASANG KE CHAPTER</>}
          </button>
        </div>
      </div>
    </div>
  )
}
