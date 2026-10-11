import type { ReactNode } from 'react'

export function Sheet({ title, onClose, children, full }: { title?: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className={`flex flex-col rounded-t-3xl bg-bg ${full ? 'h-[92%]' : 'max-h-[85%]'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}
