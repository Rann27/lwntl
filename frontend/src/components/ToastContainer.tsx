import { useAppStore } from '../store/appStore'
import { Toast } from './Toast'

export function ToastContainer() {
  const toasts = useAppStore((state) => state.toasts)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
        />
      ))}
    </div>
  )
}