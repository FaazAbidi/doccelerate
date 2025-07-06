import { createContext, useContext, useState, ReactNode } from 'react'
import { Button } from './Button'

interface TabsContextValue {
  value: string
  setValue: (v: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ value: controlledValue, defaultValue, onValueChange, children, className = '' }: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '')
  const isControlled = controlledValue !== undefined

  const currentValue = isControlled ? controlledValue! : uncontrolled

  const setValue = (v: string) => {
    if (!isControlled) {
      setUncontrolled(v)
    }
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps {
  children: ReactNode
  className?: string
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`inline-flex gap-1 p-1 ${className}`}>
      {children}
    </div>
  )
}

export interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs.Trigger must be used within Tabs')

  const isActive = ctx.value === value

  return (
    <Button
      type='button'
      size='sm'
      variant={isActive ? 'primary' : 'outline'}
      onClick={() => ctx.setValue(value)}
      className={`flex items-center gap-2 px-4 py-1.5 text-sm transition-colors focus:outline-none ${className}`}
    >
      {children}
    </Button>
  )
}

export interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs.Content must be used within Tabs')
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}

export const TabsPrimitive = {
  Root: Tabs,
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
} 