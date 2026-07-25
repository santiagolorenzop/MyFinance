import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
}

export function IconButton({ label, children, className = '', ...rest }: IconButtonProps) {
  return (
    <button type="button" className={`icon-button ${className}`.trim()} aria-label={label} {...rest}>
      {children}
    </button>
  )
}
