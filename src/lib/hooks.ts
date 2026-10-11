import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Lang } from '../types'

/** Aktuelle Zeit, die sich im gegebenen Takt aktualisiert (nur solange `active`). */
export function useNow(intervalMs = 500, active = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, active])
  return now
}

export function useLang(): Lang {
  const { i18n } = useTranslation()
  return i18n.language.startsWith('de') ? 'de' : 'en'
}
