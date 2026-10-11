import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RestTimer } from './RestTimer'

const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
)

const TABS = [
  { to: '/', key: 'workout', icon: 'M8 5v14l11-7z' },
  { to: '/stats', key: 'stats', icon: 'M4 20V10M10 20V4M16 20v-8M22 20H2' },
  { to: '/history', key: 'history', icon: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2' },
  { to: '/body', key: 'body', icon: 'M12 4a2 2 0 1 0 0 .01M6 21l2-9h8l2 9M8 12l-3-4M16 12l3-4' },
  { to: '/more', key: 'more', icon: 'M4 6h16M4 12h16M4 18h16' },
] as const

export function Layout() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <main className="flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <RestTimer />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink to={tab.to} end={tab.to === '/'} className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-1 text-xs ${isActive ? 'text-accent' : 'text-muted'}`}>
                <Icon d={tab.icon} />
                {t(`nav.${tab.key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
