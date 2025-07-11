'use client'

import React, { useState, useRef, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type DropdownSize = "sm" | "md" | "lg"
export type DropdownVariant = "outline" | "ghost" | "filled"

export interface DropdownOption {
  value: string
  label: string
  disabled?: boolean
}

export interface DropdownProps {
  options: DropdownOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  size?: DropdownSize
  variant?: DropdownVariant
  className?: string
  error?: boolean
  leadingIcon?: React.ReactNode
}

const baseClasses =
  "relative block w-full bg-transparent text-neutral placeholder-neutral placeholder-opacity-60 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"

const variantClasses: Record<DropdownVariant, string> = {
  outline: "border border-neutral border-opacity-20 focus:ring-primary",
  ghost: "border-transparent focus:ring-primary",
  filled: "bg-neutral/5 border-transparent focus:ring-primary",
}

const sizeClasses: Record<DropdownSize, string> = {
  sm: "py-2 text-body-sm rounded-[20px]",
  md: "py-3 text-body-md rounded-[20px]",
  lg: "py-4 text-body-lg rounded-[20px]",
}

export const Dropdown = React.forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Select an option",
      disabled = false,
      size = "md",
      variant = "outline",
      className,
      error = false,
      leadingIcon,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    const selectedOption = options.find(option => option.value === value)
    const paddingLeft = leadingIcon ? "pl-10" : "pl-3"

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
          setFocusedIndex(-1)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
      if (isOpen && focusedIndex >= 0 && listRef.current) {
        const focusedElement = listRef.current.children[focusedIndex] as HTMLElement
        focusedElement?.scrollIntoView({ block: 'nearest' })
      }
    }, [isOpen, focusedIndex])

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (disabled) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
            setFocusedIndex(0)
          } else {
            setFocusedIndex(prev => Math.min(prev + 1, options.length - 1))
          }
          break
        case 'ArrowUp':
          event.preventDefault()
          if (isOpen) {
            setFocusedIndex(prev => Math.max(prev - 1, 0))
          }
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
            setFocusedIndex(0)
          } else if (focusedIndex >= 0) {
            const selectedOption = options[focusedIndex]
            if (!selectedOption.disabled) {
              onValueChange?.(selectedOption.value)
              setIsOpen(false)
              setFocusedIndex(-1)
            }
          }
          break
        case 'Escape':
          setIsOpen(false)
          setFocusedIndex(-1)
          break
      }
    }

    const handleOptionClick = (option: DropdownOption) => {
      if (option.disabled) return
      onValueChange?.(option.value)
      setIsOpen(false)
      setFocusedIndex(-1)
    }

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        {leadingIcon && (
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
            {leadingIcon}
          </span>
        )}
        
        <div
          ref={ref}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="dropdown-listbox"
          aria-haspopup="listbox"
          tabIndex={disabled ? -1 : 0}
          className={cn(
            baseClasses,
            variantClasses[variant],
            sizeClasses[size],
            paddingLeft,
            "pr-10",
            error && "border-red-500 focus:ring-red-500",
            isOpen && "ring-2 ring-primary border-transparent"
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
        >
          <span className={cn(
            "block truncate",
            !selectedOption && "text-neutral opacity-60"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDown 
              className={cn(
                "w-4 h-4 text-neutral opacity-60 transition-transform duration-200",
                isOpen && "rotate-180"
              )} 
            />
          </span>
        </div>

        {isOpen && (
          <ul
            ref={listRef}
            role="listbox"
            id="dropdown-listbox"
            className={cn(
              "absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-white border border-neutral/20 rounded-[20px] shadow-lg",
              "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral/20"
            )}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                className={cn(
                  "relative cursor-pointer select-none py-2 px-3 text-neutral transition-colors",
                  "first:rounded-t-[20px] last:rounded-b-[20px]",
                  value === option.value && "bg-primary/10 text-primary",
                  focusedIndex === index && "bg-primary/5",
                  option.disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => handleOptionClick(option)}
              >
                <div className="flex items-center justify-between">
                  <span className="block truncate">{option.label}</span>
                  {value === option.value && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }
)

Dropdown.displayName = "Dropdown" 