import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const ITEMS = [
  { to: '/more/advisor', key: 'advisor', icon: '🧠' },
  { to: '/more/exercises', key: 'exercises', icon: '🏋️' },
  { to: '/more/1rm', key: 'oneRm', icon: '🧮' },
  { to: '/more/plates', key: 'plates', icon: '⚖️' },
  { to: '/more/stopwatch', key: 'stopwatch', icon: '⏱️' },
  { to: '/more/settings', key: 'settings', icon: '⚙️' },
] as const

export function More() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('more.title')}</h1>
      <ul className="flex flex-col gap-2">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="card flex items-center gap-3 p-4">
              <span className="text-2xl" aria-hidden>{i.icon}</span>
              <span className="flex-1 font-medium">{t(`more.${i.key}`)}</span>
              <span className="text-muted" aria-hidden>›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
