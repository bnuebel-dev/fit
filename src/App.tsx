import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { seedExercises } from './db'
import { Layout } from './components/Layout'
import { useSettings } from './lib/settings'
import { WorkoutHome } from './screens/WorkoutHome'
import { RoutineEdit } from './screens/RoutineEdit'
import { ActiveWorkout } from './screens/ActiveWorkout'
const History = lazy(() => import('./screens/History').then((m) => ({ default: m.History })))
const WorkoutDetail = lazy(() => import('./screens/History').then((m) => ({ default: m.WorkoutDetail })))
const Stats = lazy(() => import('./screens/Stats').then((m) => ({ default: m.Stats })))
const Body = lazy(() => import('./screens/Body').then((m) => ({ default: m.Body })))
import { More } from './screens/More'
const Exercises = lazy(() => import('./screens/Exercises').then((m) => ({ default: m.Exercises })))
const ExerciseDetail = lazy(() => import('./screens/Exercises').then((m) => ({ default: m.ExerciseDetail })))
const OneRm = lazy(() => import('./screens/Tools').then((m) => ({ default: m.OneRm })))
const Plates = lazy(() => import('./screens/Tools').then((m) => ({ default: m.Plates })))
const Stopwatch = lazy(() => import('./screens/Tools').then((m) => ({ default: m.Stopwatch })))
const SettingsScreen = lazy(() => import('./screens/Settings').then((m) => ({ default: m.SettingsScreen })))
const Advisor = lazy(() => import('./screens/Advisor').then((m) => ({ default: m.Advisor })))
const Knowledge = lazy(() => import('./screens/Knowledge').then((m) => ({ default: m.Knowledge })))
const ArticleView = lazy(() => import('./screens/Knowledge').then((m) => ({ default: m.ArticleView })))
const GlossaryView = lazy(() => import('./screens/Knowledge').then((m) => ({ default: m.GlossaryView })))
const Energy = lazy(() => import('./screens/Health').then((m) => ({ default: m.Energy })))
const StrengthLevel = lazy(() => import('./screens/Health').then((m) => ({ default: m.StrengthLevel })))

export function App() {
  const { i18n } = useTranslation()
  const settings = useSettings()
  const [ready, setReady] = useState(false)

  // Übungsdaten laden; bei kurzem Netzproblem bis zu drei Versuche, erst danach wird ein Fehler gemeldet.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await seedExercises()
          break
        } catch (e) {
          if (cancelled) return
          if (attempt === 2) console.error('seed failed', e)
          else await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
        }
      }
      if (!cancelled) setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!settings) return
    if (i18n.language !== settings.language) void i18n.changeLanguage(settings.language)
    document.documentElement.lang = settings.language
    if (settings.theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings, i18n])

  if (!settings || !ready) return <div className="p-6 text-muted">…</div>

  return (
    <Suspense fallback={<div className="p-6 text-muted">…</div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<WorkoutHome />} />
        <Route path="routine/:id" element={<RoutineEdit />} />
        <Route path="workout" element={<ActiveWorkout />} />
        <Route path="stats" element={<Stats />} />
        <Route path="history" element={<History />} />
        <Route path="history/:id" element={<WorkoutDetail />} />
        <Route path="body" element={<Body />} />
        <Route path="more" element={<More />} />
        <Route path="more/exercises" element={<Exercises />} />
        <Route path="more/exercises/:id" element={<ExerciseDetail />} />
        <Route path="more/1rm" element={<OneRm />} />
        <Route path="more/plates" element={<Plates />} />
        <Route path="more/stopwatch" element={<Stopwatch />} />
        <Route path="more/settings" element={<SettingsScreen />} />
        <Route path="advisor" element={<Advisor />} />
        <Route path="more/advisor" element={<Navigate to="/advisor" replace />} />
        <Route path="more/knowledge" element={<Knowledge />} />
        <Route path="more/knowledge/glossary" element={<GlossaryView />} />
        <Route path="more/knowledge/:id" element={<ArticleView />} />
        <Route path="more/strength-level" element={<StrengthLevel />} />
        <Route path="more/energy" element={<Energy />} />
      </Route>
    </Routes>
    </Suspense>
  )
}
