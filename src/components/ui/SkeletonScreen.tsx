import type { ReactNode } from 'react'
import { AppShell } from '@/components/ui/AppShell'

interface SkeletonScreenProps {
  title: string
  heading: string
  description?: string
  note?: string
  children?: ReactNode
  showMenu?: boolean
}

export function SkeletonScreen({
  title,
  heading,
  description,
  note,
  children,
  showMenu = true,
}: SkeletonScreenProps) {
  return (
    <AppShell title={title} showMenu={showMenu}>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{heading}</h2>
          {description ? <p className="screen__subheading">{description}</p> : null}
          {note ? <p className="screen__note">{note}</p> : null}
        </div>
        {children}
      </section>
    </AppShell>
  )
}
