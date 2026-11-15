import { createContext, useContext, useRef, type ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'

interface ModalSurfaceProps extends ComponentProps<'div'> {
  onClose: () => void
  label: string
  dismissible?: boolean
}

const ModalDepth = createContext(0)

export function ModalSurface({ onClose, label, dismissible = true, children, onClick, style, ...props }: ModalSurfaceProps) {
  const depth = useContext(ModalDepth)
  const opener = useRef(document.activeElement as HTMLElement | null)
  return <ModalDepth.Provider value={depth + 1}><DialogPrimitive.Root open onOpenChange={open => { if (!open && dismissible) onClose() }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content asChild aria-describedby={undefined} onEscapeKeyDown={event => { if (!dismissible) event.preventDefault() }} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus() }}>
        <div {...props} style={{ ...style, zIndex: 1000 + depth * 10 }} onClick={event => {
          if (event.target === event.currentTarget && dismissible) onClose()
          else onClick?.(event)
        }}>
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root></ModalDepth.Provider>
}
