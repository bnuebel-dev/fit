import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from './Icon'
import { RestTimer } from './RestTimer'

const TABS = [
  { to: '/', key: 'workout', icon: 'play' },
  { to: '/advisor', key: 'advisor', icon: 'spark' },
  { to: '/stats', key: 'stats', icon: 'stats' },
  { to: '/history', key: 'history', icon: 'history' },
  { to: '/more', key: 'more', icon: 'menu' },
] as const satisfies readonly { to: string; key: string; icon: IconName }[]

export function Layout() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <main className="flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <RestTimer />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="Main">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink to={tab.to} end={tab.to === '/'} className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`}>
                {({ isActive }) => (
                  <>
                    <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${isActive ? 'bg-accent/15' : ''}`}><Icon name={tab.icon} /></span>
                    {t(`nav.${tab.key}`)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
