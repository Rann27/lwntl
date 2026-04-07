import { useAppStore } from '../store/appStore'

export function useToast() {
  const addToast = useAppStore((state) => state.addToast)

  return {
    success: (message: string) => addToast({ type: 'success', message }),
    error: (message: string) => addToast({ type: 'error', message }),
    info: (message: string) => addToast({ type: 'info', message })
  }
}