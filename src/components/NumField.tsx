import { useEffect, useRef, useState } from 'react'

/** Zahlenfeld, das Zwischenstände wie "7." erlaubt und erst beim Verlassen/Ändern einen Wert meldet. */
export function NumField({
  value, onCommit, className = '', step = 1, min = 0, label,
}: { value: number; onCommit: (v: number) => void; className?: string; step?: number; min?: number; label?: string }) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])
  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'))
    if (Number.isFinite(n) && n >= min) onCommit(Math.round(n * 100) / 100)
  }
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className={`min-h-11 w-full rounded-xl bg-surface2 px-2 text-center text-base text-fg outline-none focus:ring-2 focus:ring-accent ${className}`}
      value={text}
      step={step}
      onFocus={(e) => {
        focused.current = true
        e.currentTarget.select()
      }}
      onChange={(e) => {
        setText(e.target.value)
        commit(e.target.value)
      }}
      onBlur={() => {
        focused.current = false
        commit(text)
        setText(String(value))
      }}
    />
  )
}
