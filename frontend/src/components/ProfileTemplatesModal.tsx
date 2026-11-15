import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
/**
 * ProfileTemplatesModal
 * Edit per-profile system prompt and instructions prompt templates.
 */

import { useState, useEffect } from 'react'
import { X, FileCode2, Save, Info, Library } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { getProfileTemplates, saveProfileTemplates, getDefaultTaskPrompts, listPromptPresets } from '../api'
import type { TaskPromptDefaults, TaskPromptKind } from '../api'
import type { PromptPreset } from '../types'
import { PromptPresetLibrary } from './PromptPresetLibrary'
import { approxTokens, presetLabel } from '../utils/promptPresets'

interface Props {
  open: boolean
  onClose: () => void
}

const TEMPLATE_VARS = [
  { variable: '{source_language}', description: 'Bahasa sumber series (contoh: Japanese)' },
  { variable: '{target_language}', description: 'Bahasa target terjemahan (contoh: Indonesian)' },
  { variable: '{title}', description: 'Judul series' },
]

const TASKS: { kind: TaskPromptKind; title: string; hint: string }[] = [
  { kind: 'revision', title: 'Revision Prompt', hint: 'pass ke-2 saat Revision Pass aktif' },
  { kind: 'autofix', title: 'AutoFix CJK Prompt', hint: 'mengganti kata Jepang yang bocor, per kemunculan' },
  { kind: 'prepass', title: 'Pre-Pass Terms Prompt', hint: 'mengusulkan glosarium dari raw sebelum menerjemahkan' },
]

const textareaStyle: React.CSSProperties = {
  width: '100%',
  resize: 'vertical',
  padding: '10px 12px',
  fontSize: '13px',
  fontFamily: 'monospace',
  lineHeight: '1.6',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  outline: 'none',
}

const smallButton: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, border: '1.5px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text-muted)', padding: '2px 8px', cursor: 'pointer', textTransform: 'none',
}

function TaskPromptEditor({ title, hint, value, onChange, defaults }: {
  title: string
  hint: string
  value: string
  onChange: (v: string) => void
  defaults?: { en: string; id: string }
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px', fontFamily: 'var(--font-body)' }}>
          {title}
        </Label>
        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>: {hint}</span>
        {!value.trim() && (
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', background: 'var(--bg-green,#28E272)', color: 'var(--fg-green)', textTransform: 'none' }}>
            bawaan (ikut bahasa target)
          </span>
        )}
        {defaults && (
          <div className="flex gap-1.5" style={{ marginLeft: 'auto' }}>
            <Button variant="ghost" type="button" onClick={() => onChange(defaults.id)} style={smallButton}>Muat bawaan ID</Button>
            <Button variant="ghost" type="button" onClick={() => onChange(defaults.en)} style={smallButton}>Muat bawaan EN</Button>
          </div>
        )}
      </div>
      <Textarea aria-label="Kosongkan untuk memakai bawaan LWNTL: versi Indonesia dipakai otomatis untuk series bertarget Indonesian, versi Inggris untuk lainnya."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Kosongkan untuk memakai bawaan LWNTL: versi Indonesia dipakai otomatis untuk series bertarget Indonesian, versi Inggris untuk lainnya."
        rows={7}
        style={textareaStyle}
      />
    </div>
  )
}

export function ProfileTemplatesModal({ open, onClose }: Props) {
  const profiles = useAppStore((s) => s.profiles)

  const [systemPrompt, setSystemPrompt] = useState('')
  const [systemPreset, setSystemPreset] = useState('')
  const [presets, setPresets] = useState<PromptPreset[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [tasks, setTasks] = useState<Record<TaskPromptKind, string>>({ revision: '', autofix: '', prepass: '' })
  const [defaults, setDefaults] = useState<TaskPromptDefaults | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    setSaved(false)
    getProfileTemplates()
      .then((t) => {
        setSystemPrompt(t.systemPromptTemplate)
        setSystemPreset(t.systemPromptPreset ?? '')
        setInstructions(t.instructionsTemplate)
        setTasks({
          revision: t.revisionPromptTemplate || '',
          autofix: t.autofixPromptTemplate || '',
          prepass: t.prepassPromptTemplate || '',
        })
        getDefaultTaskPrompts().then(setDefaults).catch(() => setDefaults(null))
        listPromptPresets(true).then(setPresets).catch(() => setPresets([]))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await saveProfileTemplates(systemPrompt, instructions, tasks, systemPreset)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const chosenPreset = presets.find(p => p.id === systemPreset)

  return (
    <ModalSurface label="Prompt templates" onClose={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ borderRadius: 'var(--radius)',
        width: 'min(760px, 95vw)',
        maxHeight: '90vh',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)', flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <FileCode2 size={16} style={{ color: 'var(--fg-cyan,#00F7FF)' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '14px', color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px' }}>
              Template Prompt
            </span>
            {profiles.active && (
              <span style={{ borderRadius: 'var(--radius)',  fontSize: '11px', fontWeight: 600, color: 'var(--fg-cyan,#00F7FF)', border: '1px solid var(--fg-cyan,#00F7FF)', padding: '1px 7px', fontFamily: 'monospace' }}>
                {profiles.active}
              </span>
            )}
          </div>
          <Button aria-label="Close" variant="ghost" onClick={onClose} style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </Button>
        </div>

        {/* Template variable reference */}
        <div className="flex items-start gap-2 px-5 py-2" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--tint-cyan)', flexShrink: 0 }}>
          <Info size={13} style={{ color: 'var(--fg-cyan,#00F7FF)', marginTop: '1px', flexShrink: 0 }} />
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {TEMPLATE_VARS.map((v) => (
              <span key={v.variable} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <code style={{ color: 'var(--fg-cyan,#00F7FF)', fontFamily: 'monospace', fontSize: '11px' }}>{v.variable}</code>
                {': '}{v.description}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Memuat...</span>
            </div>
          ) : (
            <>
              {/* System Prompt Template */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px', fontFamily: 'var(--font-body)' }}>
                    System Prompt Template
                  </Label>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
: digunakan jika series tidak punya custom system prompt
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Preset profil</span>
                  <select value={systemPreset} onChange={(e) => setSystemPreset(e.target.value)}
                    style={{ borderRadius: 'var(--radius)',  flex: 1, fontSize: '12px', padding: '5px 8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}>
                    <option value="">: Tanpa preset (otomatis per pasangan bahasa bila semua kosong): </option>
                    <optgroup label="Preset bawaan (hanya baca)">
                      {presets.filter(p => p.builtin).map(p => <option key={p.id} value={p.id}>{presetLabel(p)}</option>)}
                    </optgroup>
                    {presets.some(p => !p.builtin) && (
                      <optgroup label="Preset milikku">
                        {presets.filter(p => !p.builtin).map(p => <option key={p.id} value={p.id}>{presetLabel(p)}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <Button variant="ghost" type="button" onClick={() => setLibraryOpen(true)} className="flex items-center gap-1"
                    style={{ borderRadius: 'var(--radius)',  fontSize: '11px', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--bg-cyan,#00F7FF)', color: 'var(--on-accent,#111)', padding: '4px 10px', cursor: 'pointer' }}>
                    <Library size={12} /> Preset
                  </Button>
                </div>
                {chosenPreset && (
                  <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {systemPrompt.trim()
                      ? <span style={{ color: 'var(--fg-orange,#FFB020)', fontWeight: 600 }}>Teks template di bawah diutamakan: kosongkan agar preset "{chosenPreset.name}" yang dipakai.</span>
                      : <span>Dipakai: preset "{chosenPreset.name}" (≈{approxTokens(chosenPreset.text ?? '').toLocaleString()} token).</span>}
                    <Button variant="ghost" type="button" onClick={() => setSystemPrompt(chosenPreset.text ?? '')} style={smallButton}>Salin preset ke teks</Button>
                  </div>
                )}
                <PromptPresetLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} onChanged={setPresets} initialId={systemPreset} />
                <Textarea aria-label="Kosongkan jika tidak ingin menggunakan system prompt default..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin menggunakan system prompt default..."
                  rows={12}
                  style={{ borderRadius: 'var(--radius)',
                    width: '100%',
                    resize: 'vertical',
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Instructions Template */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', textTransform: 'none', letterSpacing: '0.4px', fontFamily: 'var(--font-body)' }}>
                    Instructions Template
                  </Label>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
: digunakan jika series tidak punya custom instructions
                  </span>
                </div>
                <Textarea aria-label="Kosongkan jika tidak ingin instructions default..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin instructions default..."
                  rows={6}
                  style={{ borderRadius: 'var(--radius)',
                    width: '100%',
                    resize: 'vertical',
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Helper-pass prompts. Only the guidance is editable; the output
                  format the code parses is appended automatically. */}
              <div className="flex items-start gap-2 px-3 py-2" style={{ borderRadius: 'var(--radius)',  border: '1px dashed var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                <Info size={13} style={{ color: 'var(--fg-cyan,#00F7FF)', marginTop: '2px', flexShrink: 0 }} />
                <span>
                  Tiga prompt di bawah hanya berisi <strong>aturan/arahan</strong>. Format output (JSON untuk AutoFix &amp; Pre-pass,
                  teks saja untuk Revision) selalu ditambahkan otomatis oleh aplikasi, jadi prompt kustom tidak bisa merusak parsing.
                </span>
              </div>
              {TASKS.map((task) => (
                <TaskPromptEditor
                  key={task.kind}
                  title={task.title}
                  hint={task.hint}
                  value={tasks[task.kind]}
                  onChange={(v) => setTasks((prev) => ({ ...prev, [task.kind]: v }))}
                  defaults={defaults?.[task.kind]}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div>
            {error && <p style={{ fontSize: '12px', color: 'var(--fg-red,#FF3C3C)', fontWeight: 600 }}>{error}</p>}
            {saved && <p style={{ fontSize: '12px', color: 'var(--fg-green,#28E272)', fontWeight: 600 }}>✓ Tersimpan</p>}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="" style={{ color: 'var(--foreground)',  backgroundColor: 'var(--color-surface-2)', fontSize: '12px' }}>
              Tutup
            </Button>
            <Button variant="default"
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-1.5"
              style={{ color: 'var(--foreground)',  backgroundColor: 'var(--bg-orange,#FFCF77)', fontSize: '12px', opacity: (saving || loading) ? 0.5 : 1 }}
            >
              <Save size={13} />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      </div>
    </ModalSurface>
  )
}
