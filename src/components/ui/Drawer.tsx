import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { t } from '@/i18n'

interface DrawerProps {
  open: boolean
  onClose: () => void
}

const primaryLinks = [
  { to: '/', labelKey: 'nav.addExpense' as const, end: true },
  { to: '/transactions', labelKey: 'nav.movements' as const, end: false },
  { to: '/balances', labelKey: 'nav.balances' as const, end: false },
  { to: '/monthly-stats', labelKey: 'nav.monthlyStats' as const, end: false },
  { to: '/reports', labelKey: 'nav.reports' as const, end: false },
]

export function Drawer({ open, onClose }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <>
      <div
        className={`drawer-overlay${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`drawer-panel${open ? ' is-open' : ''}`}
        aria-hidden={!open}
        aria-label={t('nav.primaryNav')}
      >
        <nav className="drawer-nav" aria-label={t('nav.primaryNav')}>
          {primaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `drawer-link${isActive ? ' is-active' : ''}`
              }
              onClick={onClose}
            >
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="drawer-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `drawer-link drawer-link--secondary${isActive ? ' is-active' : ''}`
            }
            onClick={onClose}
          >
            {t('nav.settings')}
          </NavLink>
        </div>
      </aside>
    </>
  )
}
