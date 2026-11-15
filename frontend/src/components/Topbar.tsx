import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowRight, BookOpen, FileCode2, Layers, ScrollText, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from '../i18n'
import { useAppStore } from '../store/appStore'
import { WorkerLogPanel } from './WorkerLogPanel'
import { BatchersListPanel } from './BatchersListPanel'
import { ProfileSwitcherPanel } from './ProfileSwitcherPanel'
import { ProfileTemplatesModal } from './ProfileTemplatesModal'

interface TopbarProps { showBack?: boolean; title?: string; subtitle?: string }

export function Topbar({ showBack, title, subtitle }: TopbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, language } = useI18n()
  const [logsOpen, setLogsOpen] = useState(false)
  const [batchersOpen, setBatchersOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const batches = useAppStore(s => s.batches)
  const profiles = useAppStore(s => s.profiles)
  const activeBatchCount = Object.values(batches).filter(b => b.status === 'translating').length
  const id = language === 'id'
  const actions = [
    { label: id ? 'Batch aktif' : 'Active batches', icon: Activity, action: () => setBatchersOpen(true), active: batchersOpen, count: activeBatchCount },
    { label: id ? 'Template prompt' : 'Prompt templates', icon: FileCode2, action: () => setTemplatesOpen(true), active: templatesOpen },
    { label: id ? 'Log worker' : 'Worker logs', icon: ScrollText, action: () => setLogsOpen(true), active: logsOpen },
    { label: t.topbar.settings, icon: Settings, action: () => navigate('/settings'), active: location.pathname === '/settings' },
  ]
  return (
    <>
      <TooltipProvider delayDuration={300}>
        <header className="app-topbar">
          <div className="flex min-w-0 items-center gap-3">
            {showBack && <div className="hidden items-center gap-1 sm:flex">
              <Button variant="ghost" size="icon" aria-label={id ? 'Kembali' : 'Back'} onClick={() => navigate(-1)}><ArrowLeft size={17} /></Button>
              <Button variant="ghost" size="icon" aria-label={id ? 'Maju' : 'Forward'} onClick={() => navigate(1)}><ArrowRight size={17} /></Button>
            </div>}
            <button className="app-brand rounded-lg text-left" onClick={() => navigate('/')} aria-label={id ? 'LWNTL, koleksi series' : 'LWNTL, series library'}>
              <span className="app-brand-mark"><BookOpen size={20} aria-hidden="true" /></span>
              <span><span className="app-brand-name block">LWNTL</span><span className="app-brand-description block">Translation workspace</span></span>
            </button>
            {title && <div className="topbar-context flex min-w-0 items-center gap-4">
              <Separator orientation="vertical" className="h-7" />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
            </div>}
          </div>
          <nav aria-label={id ? 'Alat aplikasi' : 'Application tools'} className="flex shrink-0 items-center gap-1 sm:gap-2">
            {profiles.active && <Button variant="outline" size="sm" onClick={() => setProfileOpen(v => !v)} aria-expanded={profileOpen} aria-label={id ? 'Ganti profil' : 'Switch profile'}>
              <Layers size={15} /><span className="topbar-profile-label max-w-28 truncate">{profiles.active}</span>
            </Button>}
            <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
            {actions.map(({ label, icon: Icon, action, active, count }) => <Tooltip key={label}>
              <TooltipTrigger asChild><Button variant={active ? 'secondary' : 'ghost'} size="icon" onClick={action} aria-label={label} title={label} className="relative text-muted-foreground">
                <Icon size={18} aria-hidden="true" />
                {!!count && <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]">{count}</Badge>}
              </Button></TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>)}
          </nav>
        </header>
      </TooltipProvider>
      <WorkerLogPanel open={logsOpen} onClose={() => setLogsOpen(false)} />
      <BatchersListPanel open={batchersOpen} onClose={() => setBatchersOpen(false)} />
      <ProfileSwitcherPanel open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ProfileTemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </>
  )
}
