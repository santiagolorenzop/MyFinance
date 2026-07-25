import { useState, type ReactNode } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { HamburgerIcon } from '@/components/ui/HamburgerIcon'
import { IconButton } from '@/components/ui/IconButton'
import { t } from '@/i18n'

interface AppShellProps {
  title?: string
  children: ReactNode
  showMenu?: boolean
}

export function AppShell({ title, children, showMenu = true }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="app-shell">
      <a className="sr-only" href="#main-content">
        {t('a11y.skipToContent')}
      </a>
      <header className="app-header">
        {showMenu ? (
          <IconButton
            label={drawerOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            onClick={() => setDrawerOpen((value) => !value)}
            aria-expanded={drawerOpen}
          >
            <HamburgerIcon />
          </IconButton>
        ) : (
          <span style={{ width: 'var(--touch-min)' }} aria-hidden="true" />
        )}
        {title ? <h1 className="app-header__title">{title}</h1> : null}
      </header>

      {showMenu ? (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      ) : null}

      <main id="main-content" className="app-main" aria-label={t('a11y.mainContent')}>
        {children}
      </main>
    </div>
  )
}
