import React from 'react'
import { cn } from '@/lib/utils'

export type CardVariant = 'default' | 'shadow' | 'borderless' | 'outline'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

// Base classes shared by all cards
const baseClasses = 'rounded-[20px] max-w-md p-8 text-center transition-all duration-300 bg-white/80'

// Variant-specific style classes
const variantClasses: Record<CardVariant, string> = {
  default: 'bg-white border border-neutral border-opacity-10',
  shadow: 'bg-white shadow-lg',
  borderless: 'bg-white',
  outline: 'bg-transparent border border-dashed border-neutral border-opacity-40',
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className, children, ...rest }, ref) => {
    return (
      <div ref={ref} className={cn(baseClasses, variantClasses[variant], className)} {...rest}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card' 