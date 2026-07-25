import type { ReactNode } from 'react'
import { AppShell } from '@/components/ui/AppShell'

interface SettingsLayoutProps {
  title: string
  heading: string
  description?: string
  children: ReactNode
  error?: string | null
}

export function SettingsLayout({
  title,
  heading,
  description,
  children,
  error,
}: SettingsLayoutProps) {
  return (
    <AppShell title={title}>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{heading}</h2>
          {description ? <p className="screen__subheading">{description}</p> : null}
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        {children}
      </section>
    </AppShell>
  )
}
