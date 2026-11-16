import { useNavigate } from 'react-router-dom'
import { BookOpen, MoreHorizontal, Pencil, Settings, Trash2, FolderInput, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useI18n } from '../i18n'
import type { Series, Chapter } from '../types'

interface SeriesCardProps {
  series: Series; chapters: Chapter[]
  onEdit: (series: Series) => void; onDelete: (series: Series) => void
  onMoveToGroup?: (series: Series) => void; hasGroups?: boolean
  onDragStart?: (seriesId: string) => void; onDragEnd?: () => void; isDragging?: boolean
}

export function SeriesCard({ series, chapters, onEdit, onDelete, onMoveToGroup, hasGroups, onDragStart, onDragEnd, isDragging }: SeriesCardProps) {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const done = chapters.filter(c => c.status === 'done').length
  const progress = chapters.length ? Math.round(done / chapters.length * 100) : 0
  const open = () => navigate(`/series/${series.id}/settings`)
  const id = language === 'id'
  const status = chapters.length === 0 ? (id ? 'Belum ada bab' : 'No chapters yet')
    : progress === 100 ? (id ? 'Selesai' : 'Complete')
    : done === 0 ? (id ? 'Belum dimulai' : 'Not started')
    : (id ? 'Sedang berjalan' : 'In progress')

  return (
    <Card className="group relative cursor-pointer gap-0 overflow-hidden py-0 shadow-xs transition-colors hover:border-primary/40 hover:shadow-sm" draggable
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onDragStart={e => { e.dataTransfer.setData('series-id', series.id); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(series.id) }}
      onDragEnd={onDragEnd}>
      <CardContent className="p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground"><BookOpen size={21} aria-hidden="true" /></div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="relative z-10" aria-label={`${language === 'id' ? 'Menu series' : 'Series menu'}: ${series.title}`}><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(series)}><Pencil />{t.common.edit}</DropdownMenuItem>
              <DropdownMenuItem onClick={open}><Settings />{t.topbar.settings}</DropdownMenuItem>
              {hasGroups && onMoveToGroup && <DropdownMenuItem onClick={() => onMoveToGroup(series)}><FolderInput />{language === 'id' ? 'Pindah ke grup' : 'Move to group'}</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(series)}><Trash2 />{t.common.delete}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <button onClick={open} className="mb-2 block w-full rounded text-left text-base font-semibold leading-snug text-foreground group-hover:text-primary after:absolute after:inset-0 after:z-[5] after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50" title={series.title}>
          <span className="line-clamp-2 break-words">{series.title}</span>
        </button>
        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{series.sourceLanguage}</span><ArrowRight className="size-3" aria-hidden="true" /><span>{series.targetLanguage || 'Indonesian'}</span>
        </div>
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">{done} / {chapters.length} {t.seriesCard.chapters}</span>
          <span className="font-medium text-foreground">{progress}%</span>
        </div>
        <Progress value={progress} aria-label={language === 'id' ? 'Progres terjemahan' : 'Translation progress'} className="h-1.5" />
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <Badge variant="secondary" className="text-[11px] font-normal">{status}</Badge>
          <Button variant="ghost" size="sm" className="relative z-10 -mr-2 text-primary" tabIndex={-1} onClick={open}>{language === 'id' ? 'Buka series' : 'Open series'}<ArrowRight className="size-3.5" /></Button>
        </div>
      </CardContent>
    </Card>
  )
}
