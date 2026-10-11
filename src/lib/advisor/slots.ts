// Übungsslots für den regelbasierten Planer (Stufe 1).
// Je Muskelgruppe eine priorisierte Liste; jeder Slot hat eine Geräte- und/oder Freihantel-Variante,
// und die Rolle (Grund- oder Isolationsübung) hängt von der Variante ab.
// Auswahl nach Modul 9 (Übungsauswahl): Geräteübungen eignen sich als Einstieg, freie
// Grundübungen sind die Basis fortgeschrittener Pläne, Isolationsübungen kommen zuletzt.

export type Group = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hams' | 'glutes' | 'calves' | 'core'
export type Role = 'compound' | 'isolation'

export interface Variant {
  /** free-exercise-db- oder eigene Übungs-ID */
  id: string
  role: Role
}

export interface Slot {
  group: Group
  machine?: Variant
  free?: Variant
}

export const GROUP_SIZE: Record<Group, 'big' | 'small'> = {
  chest: 'big', back: 'big', quads: 'big', hams: 'big', glutes: 'big',
  shoulders: 'small', biceps: 'small', triceps: 'small', calves: 'small', core: 'small',
}

const C = (id: string): Variant => ({ id, role: 'compound' })
const I = (id: string): Variant => ({ id, role: 'isolation' })

export const SLOTS: Record<Group, Slot[]> = {
  chest: [
    { group: 'chest', machine: C('Leverage_Chest_Press'), free: C('Barbell_Bench_Press_-_Medium_Grip') },
    { group: 'chest', machine: C('Leverage_Incline_Chest_Press'), free: C('Incline_Dumbbell_Press') },
    { group: 'chest', machine: I('Butterfly'), free: I('Dumbbell_Flyes') },
    { group: 'chest', machine: C('Cable_Chest_Press'), free: C('Dumbbell_Bench_Press') },
  ],
  back: [
    { group: 'back', machine: C('c-lat-pulldown-machine'), free: C('Pullups') },
    { group: 'back', machine: C('c-seated-row-machine'), free: C('Bent_Over_Barbell_Row') },
    { group: 'back', machine: C('Wide-Grip_Lat_Pulldown'), free: C('One-Arm_Dumbbell_Row') },
    { group: 'back', machine: C('Seated_Cable_Rows'), free: C('Bent_Over_Two-Dumbbell_Row') },
  ],
  shoulders: [
    { group: 'shoulders', machine: C('Leverage_Shoulder_Press'), free: C('Dumbbell_Shoulder_Press') },
    { group: 'shoulders', machine: I('c-lateral-raise-machine'), free: I('Side_Lateral_Raise') },
    { group: 'shoulders', machine: I('Reverse_Machine_Flyes'), free: I('Reverse_Flyes') },
  ],
  biceps: [
    { group: 'biceps', machine: I('Machine_Bicep_Curl'), free: I('Dumbbell_Bicep_Curl') },
    { group: 'biceps', machine: I('Standing_Biceps_Cable_Curl'), free: I('Hammer_Curls') },
    { group: 'biceps', machine: I('Machine_Preacher_Curls'), free: I('Concentration_Curls') },
  ],
  triceps: [
    { group: 'triceps', machine: I('Triceps_Pushdown_-_Rope_Attachment'), free: I('EZ-Bar_Skullcrusher') },
    { group: 'triceps', machine: I('Machine_Triceps_Extension'), free: I('Dumbbell_One-Arm_Triceps_Extension') },
    { group: 'triceps', machine: C('Dip_Machine'), free: C('Close-Grip_Barbell_Bench_Press') },
  ],
  quads: [
    { group: 'quads', machine: C('Leg_Press'), free: C('Barbell_Squat') },
    { group: 'quads', machine: I('Leg_Extensions') },
    { group: 'quads', machine: C('Hack_Squat'), free: C('Dumbbell_Lunges') },
  ],
  hams: [
    { group: 'hams', machine: I('Lying_Leg_Curls'), free: C('Romanian_Deadlift') },
    { group: 'hams', machine: I('Seated_Leg_Curl'), free: C('Barbell_Deadlift') },
    { group: 'hams', machine: I('Standing_Leg_Curl'), free: C('Stiff-Legged_Dumbbell_Deadlift') },
  ],
  glutes: [
    { group: 'glutes', machine: I('c-glute-machine'), free: C('Barbell_Hip_Thrust') },
    { group: 'glutes', machine: I('Thigh_Abductor'), free: C('Glute_Kickback') },
  ],
  calves: [
    { group: 'calves', machine: I('Seated_Calf_Raise'), free: I('Standing_Calf_Raises') },
    { group: 'calves', machine: I('Calf_Press_On_The_Leg_Press_Machine'), free: I('Standing_Calf_Raises') },
  ],
  core: [
    { group: 'core', machine: I('Ab_Crunch_Machine'), free: I('Crunches') },
    { group: 'core', machine: I('c-back-extension-machine'), free: I('Hyperextensions_Back_Extensions') },
    { group: 'core', machine: I('c-rotary-torso-machine'), free: I('Plank') },
  ],
}

/** Alle in den Slots verwendeten Übungs-IDs (für den Datentest). */
export function allSlotIds(): string[] {
  return [...new Set(Object.values(SLOTS).flat().flatMap((s) => [s.machine?.id, s.free?.id]).filter((x): x is string => !!x))]
}

/** Wählt die Variante: Geräte bevorzugt oder Freihantel bevorzugt, jeweils mit Rückfall auf die andere. */
export function pickVariant(slot: Slot, machines: boolean): Variant {
  return (machines ? (slot.machine ?? slot.free) : (slot.free ?? slot.machine))!
}
