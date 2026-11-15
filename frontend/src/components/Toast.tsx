import { CheckCircle2, X, Info, CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '../store/appStore'

interface ToastProps { id: string; type: 'success' | 'error' | 'info'; message: string }

export function Toast({ id, type, message }: ToastProps) {
  const removeToast = useAppStore(state => state.removeToast)
  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? CircleAlert : Info
  const color = type === 'success' ? 'var(--fg-green)' : type === 'error' ? 'var(--fg-red)' : 'var(--primary)'
  return <div role={type === 'error' ? 'alert' : 'status'} className="flex w-[min(360px,calc(100vw-32px))] items-start gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg">
    <Icon className="mt-0.5 size-5 shrink-0" style={{ color }} />
    <p className="min-w-0 flex-1 break-words text-sm">{message}</p>
    <Button variant="ghost" size="icon-xs" onClick={() => removeToast(id)} aria-label="Close notification"><X className="size-3.5" /></Button>
  </div>
}
