export type Muscle =
  | 'abdominals' | 'abductors' | 'adductors' | 'biceps' | 'calves' | 'chest'
  | 'forearms' | 'glutes' | 'hamstrings' | 'lats' | 'lower back' | 'middle back'
  | 'neck' | 'quadriceps' | 'shoulders' | 'traps' | 'triceps'

export const MUSCLES: Muscle[] = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals',
  'lats', 'middle back', 'lower back', 'traps', 'neck',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors',
]

export interface Exercise {
  id: string
  source: 'fedb' | 'wger' | 'custom'
  name: { en: string; de?: string }
  /** weitere Suchbegriffe (z. B. gängige deutsche Studio-Namen) */
  aliases?: string[]
  category: string
  equipment: string[]
  /** Übung an einem Gerät/an der Maschine (inkl. Kabelzug) */
  machine: 0 | 1
  level?: string
  mechanic?: string
  force?: string
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  instructions: { en?: string[]; de?: string[] }
  images: string[]
  favorite: 0 | 1
  /** Grundübung/-gerät aus dem Trainer-Skript (wird in Liste und Suche bevorzugt) */
  core?: 1
}

export interface RoutineItem {
  exerciseId: string
  sets: number
  /** Ziel-Wiederholungen (untere Grenze des Bereichs) */
  reps: number
  /** obere Grenze des Wiederholungsbereichs (für doppelte Progression) */
  repsMax?: number
  restSec: number
  supersetGroup?: number
}

export interface Routine {
  id?: number
  name: string
  color: string
  weekday?: number
  note?: string
  items: RoutineItem[]
  order: number
}

export interface WorkoutItem {
  exerciseId: string
  restSec: number
  targetReps?: number
  targetRepsMax?: number
  supersetGroup?: number
  note?: string
}

export interface Workout {
  id?: number
  routineId?: number
  name: string
  startedAt: number
  endedAt?: number
  note?: string
  items: WorkoutItem[]
}

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure'

export interface SetLog {
  id?: number
  workoutId: number
  exerciseId: string
  order: number
  weight: number
  reps: number
  rpe?: number
  type: SetType
  done: 0 | 1
  note?: string
}

export interface BodyEntry {
  id?: number
  date: string // YYYY-MM-DD
  values: Record<string, number>
}

export interface Photo {
  id?: number
  date: string // YYYY-MM-DD
  /** verkleinertes JPEG als Data-URL (bleibt so im JSON-Backup enthalten) */
  data: string
  note?: string
}

export type Lang = 'de' | 'en'
export type Units = 'kg' | 'lb'
export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  language: Lang
  units: Units
  theme: Theme
  restDefault: number
  advisorKey: string
  advisorModel: string
  /** Trainings pro Woche, die das Wochenziel ausmachen */
  weeklyGoal: number
}
