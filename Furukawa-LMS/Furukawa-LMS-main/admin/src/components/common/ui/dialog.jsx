import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/utils/classNames.js"

const Dialog = ({ children, open, onOpenChange, className }) => {
  const onOpenChangeRef = React.useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  // Escape closes the dialog. Capture phase + preventDefault so page-level Escape handlers
  // (e.g. the Daily 5M full-screen sheet) see e.defaultPrevented and leave themselves open.
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      // A select/menu/popover open inside the dialog closes first; the next Escape closes the dialog.
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="listbox"], [role="menu"]')) return
      e.preventDefault()
      onOpenChangeRef.current?.(false)
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [open])

  if (!open) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm backdrop-saturate-150 transition-all duration-300"
        onClick={() => onOpenChange(false)}
      />
      <div className={cn("relative bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto transform transition-all", className || "max-w-md")}>
        {children}
      </div>
    </div>,
    document.body
  )
}

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative p-6", className)}
    {...props}
  >
    {children}
  </div>
))
DialogContent.displayName = "DialogContent"

const DialogHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 text-center sm:text-left mb-4", className)}
    {...props}
  />
))
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold text-gray-900", className)}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-gray-600", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"

const DialogFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)}
    {...props}
  />
))
DialogFooter.displayName = "DialogFooter"

const DialogTrigger = ({ children, asChild, ...props }) => {
  return React.cloneElement(children, props)
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
}
