import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import { db, ensureSystemData } from '@/db'
import { createAccount, updateSettings } from '@/repositories'

vi.mock('virtual:pwa-register', () => ({
  registerSW: () => undefined,
}))

async function seedCompletedOnboarding() {
  await ensureSystemData()
  await createAccount({
    name: 'Main Checking',
    type: 'checking',
    currencyCode: 'USD',
    initialBalanceMinor: 0,
    isDefault: true,
  })
  await updateSettings({ onboardingCompleted: true })
}

describe('App shell', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('walks through onboarding to the expense amount step', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText(/organized your way/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /get started/i }))

    expect(await screen.findByRole('heading', { name: /base currency/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(
      await screen.findByRole('heading', { name: /financial period start day/i }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(await screen.findByRole('heading', { name: /add accounts/i })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^name$/i), 'Main Checking')
    await user.click(screen.getByRole('button', { name: /add another account/i }))
    expect(await screen.findByText(/^1\s+accounts$/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(await screen.findByRole('heading', { name: /add categories/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^continue$/i }))

    expect(await screen.findByRole('heading', { name: /monthly budget/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /skip budget/i }))

    expect(
      await screen.findByRole('heading', { name: /optional advanced setup/i }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^skip$/i }))

    expect(await screen.findByRole('heading', { name: /you are ready/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /start adding expenses/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/how much did you spend/i)).toBeInTheDocument()
    })
  })

  it('returns to expense entry from the drawer Add Expense item', async () => {
    await seedCompletedOnboarding()
    const user = userEvent.setup()
    render(<App />)

    await screen.findByLabelText(/how much did you spend/i)

    await user.click(screen.getByRole('button', { name: /open menu/i }))
    await user.click(screen.getByRole('link', { name: 'Movements' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Movements' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /open menu/i }))
    await user.click(screen.getByRole('link', { name: 'Add Expense' }))

    await waitFor(() => {
      expect(screen.getByLabelText(/how much did you spend/i)).toBeInTheDocument()
    })
  })
})
