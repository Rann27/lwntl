import { Check, X, Info } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface ToastProps {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

export function Toast({ id, type, message }: ToastProps) {
  const removeToast = useAppStore((state) => state.removeToast)

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check size={20} />
      case 'error':
        return <X size={20} />
      case 'info':
        return <Info size={20} />
    }
  }

  const getAccentColor = () => {
    switch (type) {
      case 'success':
        return 'var(--color-green)'
      case 'error':
        return 'var(--color-red)'
      case 'info':
        return 'var(--color-primary)'
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className="flex items-center gap-3 bg-white border-[2.5px] border-[#111111] shadow-[4px_4px_0px_#111111] p-4 min-w-[300px] max-w-md"
        style={{
          animation: 'slideIn 200ms ease-out',
          borderLeft: `6px solid ${getAccentColor()}`
        }}
      >
        {/* Accent Bar */}
        <div
          className="w-[6px] h-full"
          style={{ backgroundColor: getAccentColor() }}
        ></div>

        {/* Icon */}
        <div className="flex-shrink-0">
          {getIcon()}
        </div>

        {/* Message */}
        <p className="flex-1 text-sm text-[#111111]">{message}</p>

        {/* Close Button */}
        <button
          onClick={() => removeToast(id)}
          className="flex-shrink-0 hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] transition-all"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}