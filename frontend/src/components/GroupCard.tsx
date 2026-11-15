import { useState } from 'react'
import { Folder, FolderInput, FolderPlus, MoreHorizontal, Palette, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useI18n } from '../i18n'
import type { SeriesGroup, Series, Chapter } from '../types'

export const GROUP_COLORS = [
  { value: 'var(--fg-cyan,#245cce)', label: 'Blue' }, { value: 'var(--fg-yellow,#805300)', label: 'Amber' },
  { value: 'var(--fg-green,#17613a)', label: 'Green' }, { value: 'var(--fg-red,#b42336)', label: 'Red' },
  { value: 'var(--fg-orange,#90440e)', label: 'Orange' }, { value: 'var(--fg-purple,#64509d)', label: 'Violet' },
  { value: 'var(--fg-pink,#9e3964)', label: 'Pink' },
]
interface GroupCardProps {
  group: SeriesGroup; allGroups: SeriesGroup[]; allSeries: Series[]; chaptersMap: Record<string, Chapter[]>; depth: number
  onOpen: (group: SeriesGroup) => void; onRename: (group: SeriesGroup) => void; onChangeColor: (group: SeriesGroup) => void
  onAddSubGroup: (group: SeriesGroup) => void; onDelete: (group: SeriesGroup) => void
  onDropSeries?: (seriesId: string, groupId: string) => void; anyDragging?: boolean
}

export function GroupCard({ group, allGroups, allSeries, chaptersMap, depth, onOpen, onRename, onChangeColor, onAddSubGroup, onDelete, onDropSeries, anyDragging }: GroupCardProps) {
  const { t, language } = useI18n()
  const [isDragOver, setIsDragOver] = useState(false)
  const subtree = new Set([group.id])
  let changed = true
  while (changed) {
    changed = false
    for (const child of allGroups) if (child.parentId && subtree.has(child.parentId) && !subtree.has(child.id)) { subtree.add(child.id); changed = true }
  }
  const series = allSeries.filter(s => s.groupId && subtree.has(s.groupId))
  const chapters = series.flatMap(s => chaptersMap[s.id] || [])
  const done = chapters.filter(c => c.status === 'done').length
  const progress = chapters.length ? Math.round(done / chapters.length * 100) : 0
  const subgroups = allGroups.filter(g => g.parentId === group.id).length
  return <Card className="gap-0 py-0 shadow-xs" style={{ borderColor: isDragOver ? 'var(--primary)' : undefined, background: isDragOver ? 'var(--accent)' : undefined }}
    onDragOver={e => { if (e.dataTransfer.types.includes('series-id')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true) } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false) }}
    onDrop={e => { e.preventDefault(); setIsDragOver(false); const id = e.dataTransfer.getData('series-id'); if (id) onDropSeries?.(id, group.id) }}>
    <CardContent className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-muted"><Folder size={21} style={{ color: group.color }} aria-hidden="true" /></div>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`${language === 'id' ? 'Menu grup' : 'Group menu'}: ${group.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(group)}><Pencil />{t.group.rename}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChangeColor(group)}><Palette />{t.group.changeColor}</DropdownMenuItem>
            {depth < 2 && <DropdownMenuItem onClick={() => onAddSubGroup(group)}><FolderPlus />{t.group.addSubGroup}</DropdownMenuItem>}
            <DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => onDelete(group)}><Trash2 />{t.group.delete}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button className="mb-2 block w-full rounded text-left text-base font-semibold hover:text-primary" onClick={() => !anyDragging && onOpen(group)}><span className="line-clamp-2 break-words">{group.name}</span></button>
      <p className="mb-5 text-xs text-muted-foreground">{series.length} {t.group.series}{subgroups ? ` / ${subgroups} ${t.group.subgroups}` : ''}</p>
      <Progress value={progress} aria-label={language === 'id' ? 'Progres grup' : 'Group progress'} className="mb-2 h-1.5" />
      <p className="text-xs text-muted-foreground">{done} / {chapters.length} {t.group.translated} ({progress}%)</p>
      {isDragOver && <p className="mt-3 flex items-center gap-2 text-xs font-medium text-primary"><FolderInput size={14} />{language === 'id' ? 'Lepaskan untuk memindahkan series' : 'Drop to move series'}</p>}
    </CardContent>
  </Card>
}
