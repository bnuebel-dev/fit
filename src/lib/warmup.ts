/** Aufwärmrampe: 50 % × 8, 70 % × 5, 85 % × 3 des Arbeitsgewichts, auf 2,5 kg gerundet. Unter 20 kg lohnt sie nicht. */
export function warmupRamp(workKg: number): { weight: number; reps: number }[] {
  if (workKg < 20) return []
  const round = (v: number) => Math.max(2.5, Math.round(v / 2.5) * 2.5)
  const steps = [[0.5, 8], [0.7, 5], [0.85, 3]] as const
  const out: { weight: number; reps: number }[] = []
  for (const [p, reps] of steps) {
    const weight = round(workKg * p)
    if (weight < workKg && !out.some((o) => o.weight === weight)) out.push({ weight, reps })
  }
  return out
}
