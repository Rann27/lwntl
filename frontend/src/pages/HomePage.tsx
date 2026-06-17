/**
 * LWNTL Home Page
 * Series collection grid with group drill-down navigation
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, ChevronRight } from 'lucide-react'
import { Topbar } from '../components/Topbar'
import { SeriesCard } from '../components/SeriesCard'
import { SkeletonCard } from '../components/SkeletonCard'
import { GroupCard } from '../components/GroupCard'
import { GroupFormModal } from '../components/GroupFormModal'
import { GroupPickerModal } from '../components/GroupPickerModal'
import { CreateSeriesModal } from '../components/CreateSeriesModal'
import { EditSeriesModal } from '../components/EditSeriesModal'
import { DeleteConfirmModal } from '../components/DeleteConfirmModal'
import { useToast } from '../hooks/useToast'
import {
  getAllSeries, createSeries, updateSeries, deleteSeries, getSeriesDeleteInfo, getChapters,
  getGroups, createGroup, updateGroup, deleteGroup, moveSeriestoGroup,
} from '../api'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import type { Series, SeriesGroup, Chapter } from '../types'

interface Crumb {
  id: string | null
  name: string
}

type GroupFormMode = 'create' | 'rename' | 'color' | null

export function HomePage() {
  const toast = useToast()
  const { t } = useI18n()
  const { apiReady, config } = useAppStore()

  // Data
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [chaptersMap, setChaptersMap] = useState<Record<string, Chapter[]>>({})
  const [groups, setGroups] = useState<SeriesGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Navigation
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([{ id: null, name: t.home.allSeries }])

  // Series modals
  const [createOpen, setCreateOpen] = useState(false)
  const [editSeries, setEditSeries] = useState<Series | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null)
  const [deleteDetails, setDeleteDetails] = useState<string[]>([])
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  // Group modals
  const [groupFormMode, setGroupFormMode] = useState<GroupFormMode>(null)
  const [groupFormTarget, setGroupFormTarget] = useState<SeriesGroup | null>(null)
  const [groupFormParentId, setGroupFormParentId] = useState<string | null>(null)
  const [groupFormLoading, setGroupFormLoading] = useState(false)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<SeriesGroup | null>(null)
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false)

  // Move series to group
  const [moveSeriesTarget, setMoveSeriesTarget] = useState<Series | null>(null)

  // Drag state
  const [draggingSeriesId, setDraggingSeriesId] = useState<string | null>(null)
  const [breadcrumbDragOver, setBreadcrumbDragOver] = useState<number | null>(null)

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [series, grps] = await Promise.all([getAllSeries(), getGroups()])
      if (!Array.isArray(series)) throw new Error('Invalid series response')
      setSeriesList(series)
      setGroups(grps)

      const chMap: Record<string, Chapter[]> = {}
      await Promise.all(
        series.map(async (s) => {
          try { chMap[s.id] = await getChapters(s.id) }
          catch { chMap[s.id] = [] }
        })
      )
      setChaptersMap(chMap)
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load')
      toast.error(t.settings.saveFailed)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (apiReady) loadData()
  }, [apiReady, loadData])

  // Navigation
  const navigateToGroup = (group: SeriesGroup) => {
    setCurrentGroupId(group.id)
    setBreadcrumb((prev) => [...prev, { id: group.id, name: group.name }])
  }

  const navigateToCrumb = (idx: number) => {
    const crumb = breadcrumb[idx]
    setCurrentGroupId(crumb.id)
    setBreadcrumb((prev) => prev.slice(0, idx + 1))
  }

  // Visible items
  const visibleGroups = useMemo(
    () => groups.filter((g) => g.parentId === currentGroupId),
    [groups, currentGroupId]
  )
  const visibleSeries = useMemo(
    () => seriesList.filter((s) => s.groupId === currentGroupId),
    [seriesList, currentGroupId]
  )

  // Depth of currentGroupId (0 = root groups are depth 0, their children depth 1, etc.)
  const currentDepth = useMemo(() => breadcrumb.length - 1, [breadcrumb])

  // Series CRUD
  const handleCreate = async (title: string, language: string, targetLanguage: string) => {
    setCreateLoading(true)
    try {
      const newSeries = await createSeries(title, language, targetLanguage)
      // New series land in root; if user is inside a group, move it there
      let finalSeries = newSeries
      if (currentGroupId) {
        finalSeries = await moveSeriestoGroup(newSeries.id, currentGroupId)
      }
      setSeriesList((prev) => [...prev, finalSeries])
      setChaptersMap((prev) => ({ ...prev, [finalSeries.id]: [] }))
      setCreateOpen(false)
      toast.success(`"${title}" ✓`)
    } catch (err: any) {
      toast.error(t.settings.saveFailed)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEdit = async (seriesId: string, title: string, language: string, targetLanguage?: string, systemPrompt?: string) => {
    setEditLoading(true)
    try {
      const updated = await updateSeries(seriesId, title, language, targetLanguage, systemPrompt)
      setSeriesList((prev) => prev.map((s) => (s.id === seriesId ? updated : s)))
      setEditSeries(null)
      toast.success('✓')
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteClick = async (series: Series) => {
    setDeleteTarget(series)
    try {
      const info = await getSeriesDeleteInfo(series.id)
      setDeleteDetails([`${info.chapterCount} ${t.seriesCard.chapters}`])
    } catch {
      setDeleteDetails([t.seriesCard.chapters])
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteSeries(deleteTarget.id)
      setSeriesList((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success('✓')
    } catch {
      toast.error(t.settings.saveFailed)
    } finally {
      setDeleteLoading(false)
    }
  }

  // Move series to group (shared handler for both drag-drop and modal)
  const handleMoveSeriestoGroup = async (series: Series, groupId: string | null) => {
    if (series.groupId === groupId) return // no-op if already in target
    try {
      const updated = await moveSeriestoGroup(series.id, groupId)
      setSeriesList((prev) => prev.map((s) => (s.id === series.id ? updated : s)))
      toast.success('✓')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // Drag-and-drop: drop onto a group card
  const handleDropOnGroup = async (seriesId: string, groupId: string) => {
    const series = seriesList.find((s) => s.id === seriesId)
    if (!series) return
    await handleMoveSeriestoGroup(series, groupId)
  }

  // Drag-and-drop: drop onto breadcrumb item (move to that level's group)
  const handleDropOnBreadcrumb = async (seriesId: string, crumbIdx: number) => {
    const series = seriesList.find((s) => s.id === seriesId)
    if (!series) return
    const targetGroupId = breadcrumb[crumbIdx].id
    await handleMoveSeriestoGroup(series, targetGroupId)
    setBreadcrumbDragOver(null)
  }

  // Group CRUD
  const openGroupCreate = () => {
    setGroupFormTarget(null)
    setGroupFormParentId(currentGroupId)
    setGroupFormMode('create')
  }

  const openGroupRename = (group: SeriesGroup) => {
    setGroupFormTarget(group)
    setGroupFormMode('rename')
  }

  const openGroupColor = (group: SeriesGroup) => {
    setGroupFormTarget(group)
    setGroupFormMode('color')
  }

  const openAddSubGroup = (parentGroup: SeriesGroup) => {
    setGroupFormTarget(null)
    setGroupFormParentId(parentGroup.id)
    setGroupFormMode('create')
  }

  const handleGroupFormSubmit = async (name: string, color: string) => {
    setGroupFormLoading(true)
    try {
      if (groupFormMode === 'create') {
        const newGroup = await createGroup(name, groupFormParentId || null, color)
        setGroups((prev) => [...prev, newGroup])
        toast.success(`"${name}" ✓`)
      } else if (groupFormMode === 'rename' && groupFormTarget) {
        const updated = await updateGroup(groupFormTarget.id, name, color)
        setGroups((prev) => prev.map((g) => (g.id === groupFormTarget.id ? updated : g)))
        toast.success('✓')
      } else if (groupFormMode === 'color' && groupFormTarget) {
        const updated = await updateGroup(groupFormTarget.id, undefined, color)
        setGroups((prev) => prev.map((g) => (g.id === groupFormTarget.id ? updated : g)))
        toast.success('✓')
      }
      setGroupFormMode(null)
      setGroupFormTarget(null)
    } catch (e: any) {
      toast.error(e.message || t.settings.saveFailed)
    } finally {
      setGroupFormLoading(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return
    setDeleteGroupLoading(true)
    try {
      const parentId = deleteGroupTarget.parentId
      await deleteGroup(deleteGroupTarget.id)
      // Re-parent series locally
      setSeriesList((prev) =>
        prev.map((s) => s.groupId === deleteGroupTarget.id ? { ...s, groupId: parentId } : s)
      )
      // Re-parent child groups locally
      setGroups((prev) =>
        prev
          .filter((g) => g.id !== deleteGroupTarget.id)
          .map((g) => g.parentId === deleteGroupTarget.id ? { ...g, parentId } : g)
      )
      // If we're currently inside the deleted group, navigate up
      if (currentGroupId === deleteGroupTarget.id) {
        const parentCrumbIdx = breadcrumb.findIndex((c) => c.id === parentId)
        if (parentCrumbIdx >= 0) {
          navigateToCrumb(parentCrumbIdx)
        } else {
          setCurrentGroupId(null)
          setBreadcrumb([{ id: null, name: t.home.allSeries }])
        }
      }
      setDeleteGroupTarget(null)
      toast.success('✓')
    } catch (e: any) {
      toast.error(e.message || t.settings.saveFailed)
    } finally {
      setDeleteGroupLoading(false)
    }
  }

  const isEmpty = !loading && !loadError && visibleGroups.length === 0 && visibleSeries.length === 0 && seriesList.length === 0 && groups.length === 0

  return (
    <div className="app-layout">
      <Topbar />

      <main className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-bg, #F8F3EA)' }}>
        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: '24px',
              color: 'var(--color-text)',
              letterSpacing: '1px',
            }}
          >
            {t.home.title}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={openGroupCreate}
              className="flex items-center gap-2 px-4 py-2 font-bold text-sm transition-all"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                border: '2.5px solid var(--color-border)',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text)',
                boxShadow: '3px 3px 0px var(--color-border)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '5px 5px 0px var(--color-border)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '3px 3px 0px var(--color-border)')}
            >
              <Plus size={15} />
              {currentGroupId ? t.group.addSubGroup : t.home.addGroup}
            </button>
            <button onClick={() => setCreateOpen(true)} className="neo-button flex items-center gap-2">
              <Plus size={18} />
              {t.home.addSeries.replace('+ ', '')}
            </button>
          </div>
        </div>

        {/* Breadcrumb — also a drop target to move series up levels */}
        {breadcrumb.length > 1 && (
          <div className="flex items-center gap-1 mb-5 flex-wrap">
            {breadcrumb.map((crumb, idx) => {
              const isLast = idx === breadcrumb.length - 1
              const isDropTarget = breadcrumbDragOver === idx && !isLast
              return (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
                  <button
                    onClick={() => navigateToCrumb(idx)}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes('series-id') || isLast) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setBreadcrumbDragOver(idx)
                    }}
                    onDragLeave={() => setBreadcrumbDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      const seriesId = e.dataTransfer.getData('series-id')
                      if (seriesId && !isLast) handleDropOnBreadcrumb(seriesId, idx)
                    }}
                    style={{
                      border: isDropTarget ? '2px solid #00F7FF' : 'none',
                      background: isDropTarget ? 'rgba(0,247,255,0.12)' : 'transparent',
                      cursor: isLast ? 'default' : 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: isLast ? 700 : 600,
                      fontSize: '13px',
                      color: isLast ? 'var(--color-text)' : 'var(--color-text-muted)',
                      padding: '2px 6px',
                      textDecoration: isLast ? 'none' : 'underline',
                      borderRadius: '2px',
                      transition: 'background 0.1s, border 0.1s',
                    }}
                  >
                    {crumb.name}
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '20px',
          }}
        >
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-20" style={{ gridColumn: '1 / -1' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '18px', color: '#FF3C3C', marginBottom: '8px' }}>
                GAGAL MEMUAT SERIES
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                {loadError}
              </p>
              <button onClick={loadData} className="neo-button">RETRY</button>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-20" style={{ gridColumn: '1 / -1' }}>
              <div
                className="flex items-center justify-center mb-4"
                style={{
                  width: '80px', height: '80px',
                  border: '3px solid var(--color-border)',
                  boxShadow: 'var(--neo-shadow-lg)',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <Plus size={32} style={{ color: 'var(--color-text-subtle)' }} />
              </div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '18px', color: 'var(--color-text)', marginBottom: '8px' }}>
                {t.home.emptyTitle.toUpperCase()}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                {t.home.emptyDesc}
              </p>
              <button onClick={() => setCreateOpen(true)} className="neo-button flex items-center gap-2">
                <Plus size={16} />
                {t.home.addSeries.replace('+ ', '')}
              </button>
            </div>
          ) : (
            <>
              {/* Group cards first */}
              {visibleGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  allGroups={groups}
                  allSeries={seriesList}
                  chaptersMap={chaptersMap}
                  depth={currentDepth}
                  onOpen={navigateToGroup}
                  onRename={openGroupRename}
                  onChangeColor={openGroupColor}
                  onAddSubGroup={openAddSubGroup}
                  onDelete={setDeleteGroupTarget}
                  onDropSeries={handleDropOnGroup}
                  anyDragging={!!draggingSeriesId}
                />
              ))}

              {/* Series cards */}
              {visibleSeries.map((series) => (
                <SeriesCard
                  key={series.id}
                  series={series}
                  chapters={chaptersMap[series.id] || []}
                  onEdit={setEditSeries}
                  onDelete={handleDeleteClick}
                  onMoveToGroup={setMoveSeriesTarget}
                  hasGroups={groups.length > 0}
                  onDragStart={setDraggingSeriesId}
                  onDragEnd={() => setDraggingSeriesId(null)}
                  isDragging={draggingSeriesId === series.id}
                />
              ))}

              {/* Show empty state for current group if it has no content */}
              {currentGroupId && visibleGroups.length === 0 && visibleSeries.length === 0 && (
                <div
                  className="flex flex-col items-center justify-center py-16"
                  style={{ gridColumn: '1 / -1', color: 'var(--color-text-muted)' }}
                >
                  <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Grup ini masih kosong.</p>
                  <div className="flex gap-3">
                    <button onClick={openGroupCreate} className="neo-button" style={{ fontSize: '12px', padding: '6px 14px' }}>
                      {t.group.addSubGroup}
                    </button>
                    <button onClick={() => setCreateOpen(true)} className="neo-button" style={{ fontSize: '12px', padding: '6px 14px' }}>
                      {t.home.addSeries.replace('+ ', '')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Series modals */}
      <CreateSeriesModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        config={config}
        loading={createLoading}
      />
      <EditSeriesModal
        open={!!editSeries}
        onClose={() => setEditSeries(null)}
        onSubmit={handleEdit}
        series={editSeries}
        config={config}
        loading={editLoading}
      />
      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t.common.delete}
        entityType="series"
        entityName={deleteTarget?.title || ''}
        details={deleteDetails}
        loading={deleteLoading}
      />

      {/* Group modals */}
      <GroupFormModal
        open={!!groupFormMode}
        mode={groupFormMode || 'create'}
        group={groupFormTarget}
        onClose={() => { setGroupFormMode(null); setGroupFormTarget(null) }}
        onSubmit={handleGroupFormSubmit}
        loading={groupFormLoading}
      />
      <DeleteConfirmModal
        open={!!deleteGroupTarget}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={handleDeleteGroup}
        title={t.group.deleteConfirm}
        entityType="group"
        entityName={deleteGroupTarget?.name || ''}
        details={[t.group.deleteDesc]}
        loading={deleteGroupLoading}
      />
      <GroupPickerModal
        open={!!moveSeriesTarget}
        series={moveSeriesTarget}
        groups={groups}
        onClose={() => setMoveSeriesTarget(null)}
        onPick={handleMoveSeriestoGroup}
      />
    </div>
  )
}
