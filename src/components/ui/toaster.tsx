// IMPORTANT: must read the SAME toast store the app dispatches into. All
// feature code calls useToast from "@app/hooks/use-toast"; the duplicate
// "@/hooks/use-toast" module is a second, independent store — importing it
// here meant no feature toast ever rendered (2026-06-06 授权码"点击没反应").
import { useToast } from "@app/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
