/**
 * PDF PrePreview Modal
 * Renders PDF pages as images with draggable top/bottom cut-zone overlays.
 * Smart detection runs on open; user can adjust then confirm to parse all queued files.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, ScanSearch, ChevronLeft, ChevronRight } from 'lucide-react'
import { renderPdfPages, detectPdfMargins } from '../api'

interface PdfPrePreviewModalProps {
  open: boolean
  onClose: () => void
  file: File | null
  queuedCount: number
  onParseAll: (topMargin: number, bottomMargin: number) => void
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function PdfPrePreviewModal({ open, onClose, file, queuedCount, onParseAll }: PdfPrePreviewModalProps) {
  const [images, setImages] = useState<string[]>([])
  const [pageHeight, setPageHeight] = useState(842)
  const [topMargin, setTopMargin] = useState(0)
  const [bottomMargin, setBottomMargin] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [loadingImages, setLoadingImages] = useState(false)
  const [detecting, setDetecting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<'top' | 'bottom' | null>(null)

  useEffect(() => {
    if (!open || !file) return
    setImages([])
    setTopMargin(0)
    setBottomMargin(0)
    setCurrentPage(0)

    let cancelled = false

    const run = async () => {
      try {
        const b64 = await fileToBase64(file)

        // Run detection and render concurrently
        setDetecting(true)
        setLoadingImages(true)

        const [marginResult, renderResult] = await Promise.all([
          detectPdfMargins(b64),
          renderPdfPages(b64, [0, 1, 2]),
        ])

        if (cancelled) return

        setPageHeight(marginResult.pageHeight)
        setTopMargin(marginResult.topMargin)
        setBottomMargin(marginResult.bottomMargin)
        setImages(renderResult.images)
      } catch {
        // silently ignore — user can still adjust manually
      } finally {
        if (!cancelled) {
          setDetecting(false)
          setLoadingImages(false)
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [open, file])

  // Drag logic
  const onPointerDown = useCallback((which: 'top' | 'bottom') => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = which
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const fraction = Math.max(0, Math.min(1, relY / rect.height))
    const pt = Math.round(fraction * pageHeight)
    if (dragging.current === 'top') {
      setTopMargin(Math.min(pt, Math.round(pageHeight * 0.45)))
    } else {
      setBottomMargin(Math.min(Math.round((1 - fraction) * pageHeight), Math.round(pageHeight * 0.45)))
    }
  }, [pageHeight])

  const onPointerUp = useCallback(() => { dragging.current = null }, [])

  if (!open) return null

  const topPct = (topMargin / pageHeight) * 100
  const bottomPct = (bottomMargin / pageHeight) * 100
  const isLoading = loadingImages || detecting

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '640px', maxWidth: '95vw', maxHeight: '90vh',
        backgroundColor: '#fff', border: '2.5px solid #111',
        boxShadow: '6px 6px 0px #111',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '2px solid #111', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <ScanSearch size={16} />
            <span style={{ fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              PDF PRE-PREVIEW
            </span>
            {file && (
              <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>
                — {file.name}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', padding: '2px', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: '1.5px solid #eee', flexShrink: 0, backgroundColor: '#fafaf8' }}>
          {detecting ? (
            <div className="flex items-center gap-2" style={{ fontSize: '12px', color: '#888' }}>
              <Loader2 size={13} className="animate-spin" />
              Auto-detecting margins...
            </div>
          ) : (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Margin cut (pt)
            </span>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#444', fontWeight: 600 }}>
            Top
            <input
              type="number" min={0} max={Math.round(pageHeight * 0.45)} step={1} value={topMargin}
              onChange={e => setTopMargin(Math.max(0, Number(e.target.value)))}
              style={{ width: '64px', padding: '3px 6px', fontSize: '12px', border: '2px solid #111', fontWeight: 700, textAlign: 'right', outline: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#444', fontWeight: 600 }}>
            Bottom
            <input
              type="number" min={0} max={Math.round(pageHeight * 0.45)} step={1} value={bottomMargin}
              onChange={e => setBottomMargin(Math.max(0, Number(e.target.value)))}
              style={{ width: '64px', padding: '3px 6px', fontSize: '12px', border: '2px solid #111', fontWeight: 700, textAlign: 'right', outline: 'none' }}
            />
          </label>
          <span style={{ fontSize: '10px', color: '#aaa', marginLeft: 'auto' }}>
            Page height: {pageHeight} pt · drag lines to adjust
          </span>
        </div>

        {/* Page viewer */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, backgroundColor: '#e8e8e8', padding: '16px' }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center" style={{ height: '300px', gap: '12px' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: '#888' }} />
              <span style={{ fontSize: '13px', color: '#888' }}>Loading PDF preview...</span>
            </div>
          ) : images.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: '300px' }}>
              <span style={{ fontSize: '13px', color: '#aaa' }}>Could not render preview</span>
            </div>
          ) : (
            <div
              ref={containerRef}
              style={{ position: 'relative', userSelect: 'none', cursor: dragging.current ? 'ns-resize' : 'default' }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <img
                src={`data:image/png;base64,${images[currentPage]}`}
                alt={`Page ${currentPage + 1}`}
                style={{ width: '100%', display: 'block', border: '1px solid #ccc' }}
                draggable={false}
              />

              {/* Top shaded zone */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: `${topPct}%`,
                backgroundColor: 'rgba(255, 80, 80, 0.18)',
                pointerEvents: 'none',
              }} />

              {/* Top cut line — draggable */}
              <div
                onPointerDown={onPointerDown('top')}
                style={{
                  position: 'absolute', top: `${topPct}%`, left: 0, right: 0,
                  height: '3px', backgroundColor: '#FF3C3C',
                  cursor: 'ns-resize', transform: 'translateY(-1px)',
                }}
              >
                <div style={{
                  position: 'absolute', right: '8px', top: '-9px',
                  fontSize: '9px', fontWeight: 700, color: '#FF3C3C',
                  backgroundColor: '#fff', padding: '1px 4px', border: '1px solid #FF3C3C',
                  userSelect: 'none',
                }}>
                  TOP CUT {topMargin}pt
                </div>
              </div>

              {/* Bottom cut line — draggable */}
              <div
                onPointerDown={onPointerDown('bottom')}
                style={{
                  position: 'absolute', bottom: `${bottomPct}%`, left: 0, right: 0,
                  height: '3px', backgroundColor: '#FF3C3C',
                  cursor: 'ns-resize', transform: 'translateY(1px)',
                }}
              >
                <div style={{
                  position: 'absolute', right: '8px', bottom: '-9px',
                  fontSize: '9px', fontWeight: 700, color: '#FF3C3C',
                  backgroundColor: '#fff', padding: '1px 4px', border: '1px solid #FF3C3C',
                  userSelect: 'none',
                }}>
                  BOTTOM CUT {bottomMargin}pt
                </div>
              </div>

              {/* Bottom shaded zone */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${bottomPct}%`,
                backgroundColor: 'rgba(255, 80, 80, 0.18)',
                pointerEvents: 'none',
              }} />
            </div>
          )}
        </div>

        {/* Page nav + footer */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '2px solid #111', flexShrink: 0 }}>
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  style={{ border: '2px solid #111', background: '#fff', cursor: currentPage === 0 ? 'default' : 'pointer', padding: '4px', display: 'flex', opacity: currentPage === 0 ? 0.3 : 1 }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>
                  Page {currentPage + 1} / {images.length}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(images.length - 1, p + 1))}
                  disabled={currentPage === images.length - 1}
                  style={{ border: '2px solid #111', background: '#fff', cursor: currentPage === images.length - 1 ? 'default' : 'pointer', padding: '4px', display: 'flex', opacity: currentPage === images.length - 1 ? 0.3 : 1 }}
                >
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="neo-button" style={{ backgroundColor: '#F0F0F0', fontSize: '12px' }}>
              CANCEL
            </button>
            <button
              onClick={() => onParseAll(topMargin, bottomMargin)}
              disabled={isLoading}
              className="neo-button"
              style={{ backgroundColor: '#FFCF77', fontSize: '12px', opacity: isLoading ? 0.5 : 1 }}
            >
              PARSE {queuedCount} FILE{queuedCount !== 1 ? 'S' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
