import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAppState } from '@/app/appState'
import { ExpenseEntryScreen } from '@/features/expense/ExpenseEntryScreen'
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen'
import { MovementsScreen } from '@/features/transactions/MovementsScreen'
import { TransactionDetailScreen } from '@/features/transactions/TransactionDetailScreen'
import { BalancesScreen } from '@/features/balances/BalancesScreen'
import { AccountDetailScreen } from '@/features/balances/AccountDetailScreen'
import { MonthlyStatsScreen } from '@/features/monthlyStats/MonthlyStatsScreen'
import { CategoryStatsScreen } from '@/features/monthlyStats/CategoryStatsScreen'
import { ReportsScreen } from '@/features/reports/ReportsScreen'
import { ReportDetailScreen } from '@/features/reports/ReportDetailScreen'
import { SettingsHomeScreen } from '@/features/settings/SettingsHomeScreen'
import { AccountsSettingsScreen } from '@/features/settings/AccountsSettingsScreen'
import { CategoriesSettingsScreen } from '@/features/settings/CategoriesSettingsScreen'
import { BudgetsSettingsScreen } from '@/features/settings/BudgetsSettingsScreen'
import { FundsSettingsScreen } from '@/features/settings/FundsSettingsScreen'
import { TreatmentsSettingsScreen } from '@/features/settings/TreatmentsSettingsScreen'
import { CurrenciesSettingsScreen } from '@/features/settings/CurrenciesSettingsScreen'
import { PeriodSettingsScreen } from '@/features/settings/PeriodSettingsScreen'
import { PreferencesSettingsScreen } from '@/features/settings/PreferencesSettingsScreen'
import { BackupSettingsScreen } from '@/features/settings/BackupSettingsScreen'
import { InstallGuideScreen } from '@/features/installGuide/InstallGuideScreen'
import { IncomeScreen } from '@/features/income/IncomeScreen'
import { TransferScreen } from '@/features/transfer/TransferScreen'
import { t } from '@/i18n'

function LoadingScreen() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </main>
    </div>
  )
}

function RequireOnboardingComplete() {
  const { settings } = useAppState()
  if (!settings?.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />
  }
  return <Outlet />
}

function RedirectIfOnboarded() {
  const { settings } = useAppState()
  if (settings?.onboardingCompleted) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export function AppRouter() {
  const { ready, error } = useAppState()

  if (!ready) {
    return <LoadingScreen />
  }

  if (error) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <section className="screen">
            <p role="alert">{error}</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<RedirectIfOnboarded />}>
        <Route path="/onboarding" element={<OnboardingScreen />} />
      </Route>

      <Route element={<RequireOnboardingComplete />}>
        <Route path="/" element={<ExpenseEntryScreen />} />
        <Route path="/add-expense" element={<ExpenseEntryScreen />} />
        <Route path="/add-income" element={<IncomeScreen />} />
        <Route path="/add-transfer" element={<TransferScreen />} />
        <Route path="/transactions" element={<MovementsScreen />} />
        <Route path="/transactions/:id" element={<TransactionDetailScreen />} />
        <Route path="/balances" element={<BalancesScreen />} />
        <Route path="/balances/:id" element={<AccountDetailScreen />} />
        <Route path="/monthly-stats" element={<MonthlyStatsScreen />} />
        <Route path="/monthly-stats/category/:id" element={<CategoryStatsScreen />} />
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="/reports/:id" element={<ReportDetailScreen />} />
        <Route path="/settings" element={<SettingsHomeScreen />} />
        <Route path="/settings/accounts" element={<AccountsSettingsScreen />} />
        <Route path="/settings/categories" element={<CategoriesSettingsScreen />} />
        <Route path="/settings/budgets" element={<BudgetsSettingsScreen />} />
        <Route path="/settings/funds" element={<FundsSettingsScreen />} />
        <Route path="/settings/treatments" element={<TreatmentsSettingsScreen />} />
        <Route path="/settings/currencies" element={<CurrenciesSettingsScreen />} />
        <Route path="/settings/period" element={<PeriodSettingsScreen />} />
        <Route path="/settings/preferences" element={<PreferencesSettingsScreen />} />
        <Route path="/settings/backup" element={<BackupSettingsScreen />} />
        <Route path="/settings/install" element={<InstallGuideScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
