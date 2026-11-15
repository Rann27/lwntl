import { ModalSurface } from '@/components/ui/modal-surface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
/**
 * ProfileSwitcherPanel
 * Dropdown panel for managing and switching profiles.
 */

import { useState } from 'react'
import { X, Check, Plus, Pencil, Trash2, Layers } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { switchProfile, createProfile, deleteProfile, renameProfile } from '../api'

interface Props {
  open: boolean
  onClose: () => void
}

export function ProfileSwitcherPanel({ open, onClose }: Props) {
  const { profiles, setProfiles } = useAppStore()
  const [creatingName, setCreatingName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [renamingProfile, setRenamingProfile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  if (!open) return null

  const handleSwitch = async (name: string) => {
    if (name === profiles.active || loading) return
    setLoading(name)
    setError('')
    try {
      await switchProfile(name)
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
      setLoading(null)
    }
  }

  const handleCreate = async () => {
    const name = creatingName.trim()
    if (!name) return
    setLoading('__create__')
    setError('')
    try {
      await createProfile(name)
      const updated = { ...profiles, profiles: [...profiles.profiles, name].sort() }
      setProfiles(updated)
      setCreatingName('')
      setIsCreating(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Hapus profil "${name}"? Semua data series di profil ini akan terhapus permanen.`)) return
    setLoading(name)
    setError('')
    try {
      await deleteProfile(name)
      const updated = { ...profiles, profiles: profiles.profiles.filter((p) => p !== name) }
      setProfiles(updated)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  const handleRenameSubmit = async (oldName: string) => {
    const newName = renameValue.trim()
    if (!newName || newName === oldName) { setRenamingProfile(null); return }
    setLoading(oldName)
    setError('')
    try {
      await renameProfile(oldName, newName)
      const updated = {
        active: profiles.active === oldName ? newName : profiles.active,
        profiles: profiles.profiles.map((p) => (p === oldName ? newName : p)).sort(),
      }
      setProfiles(updated)
      setRenamingProfile(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <ModalSurface label="Profiles" onClose={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '4px 16px 0' }}
      onClick={onClose}
    >
      <div
        style={{ borderRadius: 'var(--radius)',
          width: 'min(340px, 95vw)',
          maxHeight: '80vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          marginTop: '52px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
          <div className="flex items-center gap-2">
            <Layers size={15} style={{ color: 'var(--fg-cyan,#00F7FF)' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '14px', color: 'var(--color-text)' }}>
              Profil
            </span>
          </div>
          <Button aria-label="Close" variant="ghost" onClick={onClose} style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>
            <X size={16} />
          </Button>
        </div>

        {/* Profile list */}
        <div className="overflow-y-auto flex-1">
          {profiles.profiles.map((name) => {
            const isActive = name === profiles.active
            const isRenaming = renamingProfile === name
            const isLoadingThis = loading === name

            return (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: isActive ? 'rgba(0,247,255,0.06)' : 'transparent',
                  opacity: isLoadingThis ? 0.5 : 1,
                }}
              >
                {/* Active checkmark */}
                <div style={{ width: '16px', flexShrink: 0, color: 'var(--fg-cyan,#00F7FF)' }}>
                  {isActive && <Check size={14} />}
                </div>

                {/* Name / rename input */}
                {isRenaming ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(name); if (e.key === 'Escape' && !e.defaultPrevented) setRenamingProfile(null) }}
                    style={{ borderRadius: 'var(--radius)',  flex: 1, fontSize: '13px', fontWeight: 600, padding: '3px 6px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
                  />
                ) : (
                  <Button variant="ghost"
                    onClick={() => handleSwitch(name)}
                    disabled={isActive || !!loading}
                    style={{ borderRadius: 'var(--radius)',
                      flex: 1,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: isActive ? 'default' : 'pointer',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? 'var(--fg-cyan,#00F7FF)' : 'var(--color-text)',
                      fontFamily: 'var(--font-body)',
                      padding: 0,
                    }}
                  >
                    {name}
                  </Button>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                  {isRenaming ? (
                    <>
                      <Button variant="ghost" onClick={() => handleRenameSubmit(name)} style={{ borderRadius: 'var(--radius)',  fontSize: '10px', fontWeight: 600, color: 'var(--fg-green,#28E272)', border: '1px solid var(--fg-green,#28E272)', padding: '2px 7px', background: 'transparent', cursor: 'pointer' }}>OK</Button>
                      <Button variant="ghost" onClick={() => setRenamingProfile(null)} style={{ borderRadius: 'var(--radius)',  fontSize: '10px', fontWeight: 600, color: 'var(--fg-muted,#888)', border: '1px solid var(--fg-muted,#888)', padding: '2px 7px', background: 'transparent', cursor: 'pointer' }}>Batal</Button>
                    </>
                  ) : (
                    <>
                      <Button aria-label="Ubah nama" variant="ghost"
                        onClick={() => { setRenamingProfile(name); setRenameValue(name); setError('') }}
                        disabled={!!loading}
                        style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '2px', display: 'flex' }}
                        title="Ubah nama"
                      >
                        <Pencil size={13} />
                      </Button>
                      {!isActive && (
                        <Button aria-label="Hapus profil" variant="ghost"
                          onClick={() => handleDelete(name)}
                          disabled={!!loading}
                          style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-red,#FF3C3C)', padding: '2px', display: 'flex' }}
                          title="Hapus profil"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '8px 14px', backgroundColor: 'var(--tint-red)', borderTop: '1px solid var(--fg-red,#FF3C3C)' }}>
            <p style={{ fontSize: '11px', color: 'var(--fg-red,#FF3C3C)', fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {/* Create new profile */}
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '10px 14px', backgroundColor: 'var(--color-surface-2)' }}>
          {isCreating ? (
            <div className="flex items-center gap-2">
              <Input aria-label="Nama profil baru..."
                autoFocus
                value={creatingName}
                onChange={(e) => setCreatingName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape' && !e.defaultPrevented) { setIsCreating(false); setCreatingName('') } }}
                placeholder="Nama profil baru..."
                style={{ borderRadius: 'var(--radius)',  flex: 1, fontSize: '12px', fontWeight: 600, padding: '5px 8px', border: '1px solid var(--border)', outline: 'none', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
              <Button variant="default" onClick={handleCreate} disabled={!creatingName.trim() || !!loading} className="" style={{ color: 'var(--foreground)',  fontSize: '11px', backgroundColor: 'var(--bg-orange,#FFCF77)', opacity: (!creatingName.trim() || !!loading) ? 0.5 : 1 }}>
                Buat
              </Button>
            </div>
          ) : (
            <Button variant="ghost"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 w-full"
              style={{ borderRadius: 'var(--radius)',  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 600, padding: 0 }}
            >
              <Plus size={14} />
              Buat profil baru
            </Button>
          )}
        </div>
      </div>
    </ModalSurface>
  )
}
