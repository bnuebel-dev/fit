import { useState } from 'react'
import { exerciseImageUrl } from '../lib/names'
import type { Exercise } from '../types'

export function ExerciseImage({ ex, size = 48, index = 0 }: { ex: Pick<Exercise, 'images' | 'primaryMuscles'>; size?: number; index?: number }) {
  const [failed, setFailed] = useState(false)
  const src = ex.images[index] ?? ex.images[0]
  if (!src || failed) {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-xl bg-surface2 text-muted" style={{ width: size, height: size }} aria-hidden>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 12h12M4 9v6M7 7v10M20 9v6M17 7v10" />
        </svg>
      </div>
    )
  }
  return (
    <img
      src={exerciseImageUrl(src)}
      alt=""
      loading="lazy"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-xl bg-surface2 object-cover"
      style={{ width: size, height: size }}
    />
  )
}
