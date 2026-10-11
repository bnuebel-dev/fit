import { create } from 'zustand'

interface RestState {
  endsAt: number | null
  total: number
  label: string
  start: (seconds: number, label?: string) => void
  add: (seconds: number) => void
  stop: () => void
}

export const useRest = create<RestState>((set, get) => ({
  endsAt: null,
  total: 0,
  label: '',
  start: (seconds, label = '') => set({ endsAt: Date.now() + seconds * 1000, total: seconds, label }),
  add: (seconds) => {
    const { endsAt, total } = get()
    if (endsAt === null) return
    set({ endsAt: Math.max(Date.now(), endsAt + seconds * 1000), total: Math.max(1, total + seconds) })
  },
  stop: () => set({ endsAt: null }),
}))

let audio: AudioContext | undefined
export function beep(): void {
  try {
    audio ??= new AudioContext()
    for (const [i, f] of [880, 880, 1320].entries()) {
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.frequency.value = f
      g.gain.value = 0.15
      o.connect(g).connect(audio.destination)
      const t = audio.currentTime + i * 0.22
      o.start(t)
      o.stop(t + 0.16)
    }
  } catch {
    /* kein Ton möglich */
  }
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    /* kein Vibrieren möglich */
  }
}
