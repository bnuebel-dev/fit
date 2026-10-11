import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { seedExercises } from './db'
import { Layout } from './components/Layout'
import { useSettings } from './lib/settings'
import { WorkoutHome } from './screens/WorkoutHome'
import { RoutineEdit } from './screens/RoutineEdit'
import { ActiveWorkout } from './screens/ActiveWorkout'
import { History, WorkoutDetail } from './screens/History'
import { Stats } from './screens/Stats'
import { Body } from './screens/Body'
import { More } from './screens/More'
import { Exercises, ExerciseDetail } from './screens/Exercises'
import { OneRm, Plates, Stopwatch } from './screens/Tools'
import { SettingsScreen } from './screens/Settings'
import { Advisor } from './screens/Advisor'

export function App() {
  const { i18n } = useTranslation()
  const settings = useSettings()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedExercises().catch((e) => console.error('seed failed', e)).finally(() => setReady(true))
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
        <Route path="more/advisor" element={<Advisor />} />
      </Route>
    </Routes>
  )
}
