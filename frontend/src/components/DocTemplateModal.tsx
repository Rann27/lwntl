import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
/**
 * DocTemplateModal: choose the Word template a series exports with.
 *
 * Built-in templates ship with LWNTL; user templates are any prepared .docx/.dotx
 * (page setup, Normal/Heading styles, header and footer; body text is ignored).
 * The preview is an approximation drawn from the template's styles. "Coba
 * ekspor" renders a real sample in Word for the exact look.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  X, FileText, Upload, Check, Star, ExternalLink, Copy, Trash2, Pencil, Loader2, AlertTriangle, Info, FileOutput,
} from 'lucide-react'
import {
  listDocTemplates, importDocTemplate, renameDocTemplate, deleteDocTemplate, setDefaultDocTemplate,
  setSeriesDocTemplate, saveDocTemplateCopy, openDocTemplate, previewDocTemplate, getConfig,
} from '../api'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/useToast'
import type { DocTemplate, DocTemplateInfo, DocStyleInfo, Series } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  series: Series | null
  onSeriesUpdated: (s: Series) => void
}

const ALIGN_LABEL: Record<DocStyleInfo['align'], string> = { left: 'Rata kiri', center: 'Tengah', right: 'Rata kanan', justify: 'Rata kiri-kanan' }

const fmt = (n: number | null | undefined, digits = 1) => (n == null ? ': ' : Number(n.toFixed(digits)).toString())

function lineSpacingLabel(s: DocStyleInfo) {
  const { kind, value } = s.lineSpacing
  if (kind === 'multiple') return value === 1 ? 'Tunggal' : `${fmt(value, 2)} ×`
  return `${kind === 'exact' ? 'Tepat' : 'Minimal'} ${fmt(value)} pt`
}

function shortMeta(info?: DocTemplateInfo | null) {
  if (!info) return ''
  const body = info.body
  return [info.page.name, body ? `${body.font || 'Default'} ${fmt(body.sizePt)} pt` : ''].filter(Boolean).join(' · ')
}

// ── Preview ──────────────────────────────────────────────────────────────────

const PT = 1.333  // CSS px per point at 100%

function textStyle(s: DocStyleInfo | null, scale: number, fallbackSerif = true): CSSProperties {
  if (!s) return {}
  const lineHeight = s.lineSpacing.kind === 'multiple'
    ? s.lineSpacing.value * 1.2
    : `${Math.max(s.lineSpacing.value, s.sizePt) * PT * scale}px`
  return {
    fontFamily: `"${s.font}", ${fallbackSerif ? 'Georgia, serif' : 'sans-serif'}`,
    fontSize: `${s.sizePt * PT * scale}px`,
    fontWeight: s.bold ? 700 : 400,
    fontStyle: s.italic ? 'italic' : 'normal',
    color: s.color && s.color !== '#000000' ? s.color : undefined,
    textAlign: s.align,
    lineHeight,
    marginTop: `${s.spaceBeforePt * PT * scale}px`,
    marginBottom: `${s.spaceAfterPt * PT * scale}px`,
    textIndent: `${s.firstLineIndentCm * 37.8 * scale}px`,
  }
}

function PageThumb({ info }: { info: DocTemplateInfo }) {
  const width = 112
  const height = Math.min(190, (width * info.page.heightCm) / info.page.widthCm)
  const m = info.margins
  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const headingCentered = info.heading?.align === 'center'
  return (
    <div aria-hidden="true" className="shrink-0" style={{ width, height, position: 'relative', background: '#fff', border: '1px solid var(--border)', borderRadius: 4, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{
        position: 'absolute', top: pct(m.top, info.page.heightCm), bottom: pct(m.bottom, info.page.heightCm),
        left: pct(m.left, info.page.widthCm), right: pct(m.right, info.page.widthCm),
        outline: '1px dashed rgb(27 54 93 / 0.25)', display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden',
      }}>
        <div style={{ height: 5, width: '55%', background: '#1b365d', opacity: 0.75, borderRadius: 2, alignSelf: headingCentered ? 'center' : 'flex-start', margin: '2px 0 4px' }} />
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ height: 2.5, borderRadius: 2, background: '#9aa3ae', width: i % 4 === 3 ? '62%' : '100%', marginLeft: info.body && info.body.firstLineIndentCm > 0 && i % 4 === 0 ? '10%' : 0 }} />
        ))}
      </div>
      {info.hasFooter && <div style={{ position: 'absolute', bottom: 4, left: '45%', width: '10%', height: 2.5, background: '#9aa3ae', borderRadius: 2 }} />}
      {info.hasHeader && <div style={{ position: 'absolute', top: 4, left: '30%', width: '40%', height: 2.5, background: '#9aa3ae', borderRadius: 2 }} />}
    </div>
  )
}

function TypeSample({ info }: { info: DocTemplateInfo }) {
  const scale = 0.82
  const body = textStyle(info.body, scale)
  const heading = info.heading
    ? textStyle(info.heading, scale)
    : { ...body, fontWeight: 700, fontSize: `${16 * PT * scale}px`, textAlign: 'center' as const, textIndent: 0 }
  const sub = info.subheading ? textStyle(info.subheading, scale) : { ...body, fontWeight: 700 }
  return (
    <div aria-label="Contoh tampilan teks" className="min-w-0 flex-1 overflow-hidden" style={{ background: '#fff', color: '#1a1a1a', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', maxHeight: 250 }}>
      <p style={{ ...heading, marginTop: 0, textIndent: 0 }}>Bab 1: Pagi di toko obat</p>
      <p style={body}>Pagi itu hujan turun pelan di atas atap toko obat. Aroma akar kering dan daun mint memenuhi ruangan yang masih gelap.</p>
      <p style={body}>"Kau sudah bangun?" tanya seseorang dari balik pintu. Ia mengangguk, lalu meraih buku catatan yang <em>selalu</em> dibawanya.</p>
      <p style={{ ...body, textAlign: 'center', textIndent: 0, color: '#6b6b6b' }}>* * *</p>
      <p style={{ ...sub, textIndent: 0 }}>Bagian kedua</p>
      <p style={body}>Langkahnya ringan saat menuruni tangga menuju pasar yang mulai ramai.</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid var(--color-separator)' }}>
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-medium" style={{ overflowWrap: 'anywhere' }}>{value}</dd>
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function DocTemplateModal({ open, onClose, series, onSeriesUpdated }: Props) {
  const toast = useToast()
  const setConfig = useAppStore(s => s.setConfig)
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [defaultId, setDefaultId] = useState('builtin:classic')
  const [focusId, setFocusId] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listDocTemplates()
      setTemplates(res.templates)
      setDefaultId(res.defaultId)
      return res
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const chosenId = series?.docTemplate || ''
  const effectiveId = templates.some(t => t.id === chosenId) ? chosenId : defaultId

  useEffect(() => {
    if (!open) return
    setError(''); setRenaming(false); setConfirmDelete(false)
    load().then(res => {
      if (!res) return
      const chosen = series?.docTemplate && res.templates.some(t => t.id === series.docTemplate) ? series.docTemplate : res.defaultId
      setFocusId(chosen)
    })
  }, [open, load])  // eslint-disable-line react-hooks/exhaustive-deps

  const focused = useMemo(() => templates.find(t => t.id === focusId) ?? templates[0], [templates, focusId])
  const builtins = templates.filter(t => t.builtin)
  const mine = templates.filter(t => !t.builtin)
  const defaultName = templates.find(t => t.id === defaultId)?.name ?? 'Classic'

  if (!open || !series) return null

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError('')
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy('') }
  }

  const useForSeries = (id: string) => run('use', async () => {
    const updated = await setSeriesDocTemplate(series.id, id)
    onSeriesUpdated(updated)
    toast.success(id ? `Series ini sekarang memakai template ${templates.find(t => t.id === id)?.name ?? ''}` : `Series ini mengikuti default (${defaultName})`)
  })

  const makeDefault = (id: string) => run('default', async () => {
    const res = await setDefaultDocTemplate(id)
    setDefaultId(res.defaultId)
    setConfig(await getConfig())  // keep the settings page from saving a stale default back
  })

  const addTemplate = () => run('import', async () => {
    const res = await importDocTemplate()
    if (res.cancelled || !res.template) return
    await load()
    setFocusId(res.template.id)
    toast.success(`Template "${res.template.name}" ditambahkan`)
  })

  const saveName = (id: string) => run('rename', async () => {
    await renameDocTemplate(id, nameDraft)
    setRenaming(false)
    await load()
  })

  const remove = (id: string) => run('delete', async () => {
    await deleteDocTemplate(id)
    setConfirmDelete(false)
    const res = await load()
    if (chosenId === id) onSeriesUpdated(await setSeriesDocTemplate(series.id, ''))
    setFocusId(res?.defaultId ?? 'builtin:classic')
  })

  const preview = (id: string) => run('preview', async () => {
    const res = await previewDocTemplate(series.id, id)
    toast.info(res.chapters ? `Contoh ${res.chapters} bab dibuka di Word` : 'Contoh teks dibuka di Word (belum ada bab selesai)')
  })

  const saveCopy = (id: string) => run('copy', async () => {
    const res = await saveDocTemplateCopy(id)
    if (res.path) toast.success('Salinan disimpan. Edit di Word lalu tambahkan sebagai template baru.')
  })

  const editInWord = (id: string) => run('open', async () => {
    await openDocTemplate(id)
    toast.info('Dibuka di Word. Simpan perubahan, lalu tekan "Muat ulang" untuk memperbarui pratinjau.')
  })

  const listItem = (t: DocTemplate) => {
    const active = focused?.id === t.id
    return (
      <button key={t.id} type="button" onClick={() => { setFocusId(t.id); setRenaming(false); setConfirmDelete(false) }}
        aria-current={active ? 'true' : undefined}
        className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-(--color-surface-2)"
        style={{ backgroundColor: active ? 'var(--accent)' : undefined, outline: active ? '1px solid var(--ring)' : undefined }}
      >
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full"
          style={{ border: `1.5px solid ${effectiveId === t.id ? 'var(--primary)' : 'var(--border)'}`, backgroundColor: effectiveId === t.id ? 'var(--primary)' : 'transparent' }}>
          {effectiveId === t.id && <Check size={10} strokeWidth={3} style={{ color: 'var(--primary-foreground)' }} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{t.name}</span>
            {t.id === defaultId && <Star size={11} className="shrink-0" aria-label="Default" style={{ color: 'var(--fg-orange,#B45309)', fill: 'currentColor' }} />}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{t.error ? 'Tidak bisa dibaca' : shortMeta(t.info)}</span>
        </span>
      </button>
    )
  }

  const info = focused?.info
  const isSeriesChoice = focused && chosenId === focused.id
  const missing = info?.missingStyles ?? []

  return (
    <ModalSurface label="Template DOCX" onClose={onClose} className="ui-modal-backdrop" style={{ zIndex: 210 }} onClick={onClose}>
      <div className="ui-modal flex flex-col" style={{ width: '940px', maxWidth: '96vw', height: 'min(720px, 90vh)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted"><FileText size={18} style={{ color: 'var(--primary)' }} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-tight">Template DOCX</h2>
            <p className="truncate text-xs text-muted-foreground">{series.title} · dipakai untuk ekspor bab dan ekspor semua</p>
          </div>
          <Button aria-label="Tutup" variant="ghost" size="icon-sm" onClick={onClose}><X size={18} /></Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Template list */}
          <div className="flex min-h-0 shrink-0 flex-col md:w-[270px]" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <div>
                <p className="mb-1 px-1 text-[11px] font-semibold text-muted-foreground">Bawaan</p>
                <div className="space-y-0.5">{builtins.map(listItem)}</div>
              </div>
              <div>
                <p className="mb-1 px-1 text-[11px] font-semibold text-muted-foreground">Milikmu</p>
                {mine.length ? <div className="space-y-0.5">{mine.map(listItem)}</div> : (
                  <p className="px-1 text-xs text-muted-foreground">Belum ada. Tambahkan docx yang gaya dan spasinya sudah kamu atur.</p>
                )}
              </div>
              {loading && <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Memuat…</p>}
            </div>
            <div className="shrink-0 space-y-2 p-3" style={{ borderTop: '1px solid var(--border)' }}>
              <Button variant="outline" className="w-full gap-2" onClick={addTemplate} disabled={!!busy}>
                {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Tambah template (.docx)
              </Button>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none font-medium">Cara menyiapkan template</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
                  <li>Buka dokumen kosong di Word (atau simpan salinan template bawaan).</li>
                  <li>Atur ukuran kertas dan margin di tab Layout.</li>
                  <li>Ubah gaya lewat panel Styles → Modify: <strong>Normal</strong> untuk isi, <strong>Heading 1</strong> untuk baris <code>#</code> (judul bab di konten), <strong>Heading 2</strong> untuk <code>##</code>.</li>
                  <li>Tambahkan header, footer, atau nomor halaman bila perlu.</li>
                  <li>Simpan sebagai .docx atau .dotx. Teks di dalam dokumen diabaikan.</li>
                </ol>
              </details>
            </div>
          </div>

          {/* Details */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
            {!focused ? null : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {renaming ? (
                      <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); saveName(focused.id) }}>
                        <Input aria-label="Nama template" autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)} className="h-8 max-w-xs" />
                        <Button type="submit" size="sm" disabled={!nameDraft.trim() || busy === 'rename'}>Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>Batal</Button>
                      </form>
                    ) : (
                      <h3 className="flex items-center gap-2 text-lg font-semibold leading-tight">
                        <span className="truncate">{focused.name}</span>
                        {!focused.builtin && (
                          <Button aria-label="Ganti nama" title="Ganti nama" variant="ghost" size="icon-xs" onClick={() => { setNameDraft(focused.name); setRenaming(true) }}><Pencil size={12} /></Button>
                        )}
                      </h3>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{focused.description || focused.fileName}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {focused.builtin && <Badge variant="secondary">Bawaan</Badge>}
                    {focused.id === defaultId && <Badge variant="secondary">Default</Badge>}
                    {effectiveId === focused.id && <Badge>{isSeriesChoice ? 'Dipakai series ini' : 'Dipakai (default)'}</Badge>}
                  </div>
                </div>

                {focused.error && (
                  <p className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--tint-red,#fdecec)', color: 'var(--fg-red,#C62828)' }}>
                    <AlertTriangle size={14} className="mt-px shrink-0" /> {focused.error}
                  </p>
                )}

                {info && (
                  <>
                    <div className="flex gap-4">
                      <PageThumb info={info} />
                      <TypeSample info={info} />
                    </div>

                    {(missing.length > 0 || info.bodyBlocks > 0 || info.sections > 1) && (
                      <div className="space-y-1.5 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--tint-orange,#fff7e6)', color: 'var(--fg-orange,#8a4b00)' }}>
                        {missing.length > 0 && <p className="flex gap-2"><Info size={13} className="mt-px shrink-0" /> {missing.join(', ')} belum diatur di file ini. LWNTL memakai gaya tebal bawaan untuk judulnya; atur gayanya di Word agar sesuai selera.</p>}
                        {info.bodyBlocks > 0 && <p className="flex gap-2"><Info size={13} className="mt-px shrink-0" /> Dokumen berisi {info.bodyBlocks} paragraf/tabel. Isinya diabaikan; yang dipakai hanya gaya, halaman, header, dan footer.</p>}
                        {info.sections > 1 && <p className="flex gap-2"><Info size={13} className="mt-px shrink-0" /> Ada {info.sections} section. Hanya pengaturan section terakhir yang dipakai.</p>}
                      </div>
                    )}

                    <dl className="grid gap-x-6 sm:grid-cols-2">
                      <Detail label="Kertas" value={`${info.page.name}${info.page.landscape ? ' (landscape)' : ''}`} />
                      <Detail label="Margin (atas, bawah, kiri, kanan)" value={`${fmt(info.margins.top)} · ${fmt(info.margins.bottom)} · ${fmt(info.margins.left)} · ${fmt(info.margins.right)} cm`} />
                      {info.body && <>
                        <Detail label="Font isi" value={`${info.body.font || 'Default'} ${fmt(info.body.sizePt)} pt`} />
                        <Detail label="Spasi baris" value={lineSpacingLabel(info.body)} />
                        <Detail label="Jarak paragraf (sebelum, sesudah)" value={`${fmt(info.body.spaceBeforePt)} · ${fmt(info.body.spaceAfterPt)} pt`} />
                        <Detail label="Indentasi baris pertama" value={info.body.firstLineIndentCm ? `${fmt(info.body.firstLineIndentCm, 2)} cm` : 'Tidak ada'} />
                        <Detail label="Perataan isi" value={ALIGN_LABEL[info.body.align]} />
                      </>}
                      <Detail label="Heading 1 (baris #)" value={info.heading ? `${info.heading.font || 'Default'} ${fmt(info.heading.sizePt)} pt${info.heading.bold ? ', tebal' : ''}, ${ALIGN_LABEL[info.heading.align].toLowerCase()}` : 'Gaya bawaan LWNTL'} />
                      <Detail label="Header dan footer" value={[info.hasHeader && 'Header', info.hasFooter && 'Footer'].filter(Boolean).join(' + ') || 'Tidak ada'} />
                    </dl>
                  </>
                )}

                {error && (
                  <p className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--tint-red,#fdecec)', color: 'var(--fg-red,#C62828)' }}>
                    <AlertTriangle size={14} className="mt-px shrink-0" /> {error}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button onClick={() => useForSeries(focused.id)} disabled={!!busy || isSeriesChoice || !!focused.error} className="gap-1.5">
                    {busy === 'use' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {isSeriesChoice ? 'Dipakai series ini' : 'Pakai untuk series ini'}
                  </Button>
                  <Button variant="outline" onClick={() => preview(focused.id)} disabled={!!busy || !!focused.error} className="gap-1.5"
                    title="Ekspor 1–2 bab pertama yang sudah selesai dengan template ini lalu buka di Word">
                    {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <FileOutput size={14} />} Coba ekspor di Word
                  </Button>
                  {focused.id !== defaultId && (
                    <Button variant="ghost" onClick={() => makeDefault(focused.id)} disabled={!!busy || !!focused.error} className="gap-1.5"
                      title="Dipakai semua series yang belum memilih template sendiri">
                      <Star size={14} /> Jadikan default
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-xs" style={{ borderTop: '1px solid var(--color-separator)', paddingTop: 10 }}>
                  <Button variant="ghost" size="sm" onClick={() => saveCopy(focused.id)} disabled={!!busy} className="gap-1.5 text-xs"
                    title="Simpan file .docx-nya untuk dijadikan titik awal template sendiri">
                    <Copy size={13} /> Simpan salinan .docx
                  </Button>
                  {!focused.builtin && <>
                    <Button variant="ghost" size="sm" onClick={() => editInWord(focused.id)} disabled={!!busy} className="gap-1.5 text-xs">
                      <ExternalLink size={13} /> Edit di Word
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => load()} disabled={!!busy || loading} className="text-xs">Muat ulang</Button>
                    {confirmDelete ? (
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className="text-muted-foreground">Hapus template ini?</span>
                        <Button size="sm" variant="destructive" onClick={() => remove(focused.id)} disabled={busy === 'delete'}>Hapus</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Batal</Button>
                      </span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} disabled={!!busy} className="ml-auto gap-1.5 text-xs" style={{ color: 'var(--fg-red,#C62828)' }}>
                        <Trash2 size={13} /> Hapus
                      </Button>
                    )}
                  </>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer: what this series uses */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 px-5 py-3 text-xs" style={{ borderTop: '1px solid var(--border)', background: 'var(--color-surface-2)' }}>
          <span className="min-w-0 flex-1 text-muted-foreground">
            Series ini memakai <strong className="text-foreground">{templates.find(t => t.id === effectiveId)?.name ?? defaultName}</strong>
            {chosenId && templates.some(t => t.id === chosenId) ? '' : ' (mengikuti default)'}
          </span>
          {chosenId && (
            <Button variant="ghost" size="sm" onClick={() => useForSeries('')} disabled={!!busy} className="text-xs">Ikuti default ({defaultName})</Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Selesai</Button>
        </div>
      </div>
    </ModalSurface>
  )
}
