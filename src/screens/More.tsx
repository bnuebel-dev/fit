import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'

const ITEMS = [
  { to: '/advisor', key: 'advisor', icon: 'spark' },
  { to: '/body', key: 'body', icon: 'body' },
  { to: '/more/knowledge', key: 'knowledge', icon: 'book' },
  { to: '/more/exercises', key: 'exercises', icon: 'dumbbell' },
  { to: '/more/1rm', key: 'oneRm', icon: 'calc' },
  { to: '/more/strength-level', key: 'strengthLevel', icon: 'medal' },
  { to: '/more/energy', key: 'energy', icon: 'food' },
  { to: '/more/plates', key: 'plates', icon: 'plates' },
  { to: '/more/stopwatch', key: 'stopwatch', icon: 'timer' },
  { to: '/more/settings', key: 'settings', icon: 'gear' },
] as const

export function More() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold">{t('more.title')}</h1>
      <ul className="flex flex-col gap-2">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="card flex items-center gap-3 p-4">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/12 text-accent" aria-hidden><Icon name={i.icon} size={20} /></span>
              <span className="flex-1 font-medium">{t(`more.${i.key}`)}</span>
              <Icon name="chevron" size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
