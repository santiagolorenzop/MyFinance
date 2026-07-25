import { Link } from 'react-router-dom'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import { shouldShowBackupReminder } from '@/services/backup'

const links = [
  { to: '/settings/accounts', labelKey: 'settings.accounts' as const },
  { to: '/settings/categories', labelKey: 'settings.categories' as const },
  { to: '/settings/budgets', labelKey: 'settings.budgets' as const },
  { to: '/settings/funds', labelKey: 'settings.funds' as const },
  { to: '/settings/treatments', labelKey: 'settings.treatments' as const },
  { to: '/settings/currencies', labelKey: 'settings.currencies' as const },
  { to: '/settings/period', labelKey: 'settings.period' as const },
  { to: '/settings/preferences', labelKey: 'settings.preferences' as const },
  { to: '/settings/backup', labelKey: 'settings.backup' as const },
  { to: '/settings/install', labelKey: 'settings.install' as const },
]

export function SettingsHomeScreen() {
  const reminderDue = shouldShowBackupReminder()

  return (
    <SettingsLayout
      title={t('nav.settings')}
      heading={t('settings.heading')}
      description={
        reminderDue ? t('settings.backupReminderDue') : t('settings.backupReminder')
      }
    >
      <nav className="stack" aria-label={t('settings.heading')}>
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="list-row">
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>
    </SettingsLayout>
  )
}
