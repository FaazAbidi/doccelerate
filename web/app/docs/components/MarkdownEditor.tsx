'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  theme?: 'light' | 'dark'
  className?: string
}

export function MarkdownEditor({ 
  value, 
  onChange, 
  readOnly = false, 
  theme = 'light',
  className = ''
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const initialValueRef = useRef<string>('')

  useEffect(() => {
    if (!editorRef.current) return

    const extensions = [
      basicSetup,
      markdown(),
      EditorView.theme({
        '&': {
          fontSize: '14px',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        },
        '.cm-content': {
          padding: '16px',
          minHeight: '200px',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          borderRadius: '8px',
          border: '1px solid hsl(var(--neutral) / 0.2)',
          backgroundColor: 'hsl(var(--background))',
          height: '100%',
        },
        '.cm-scroller': {
          fontFamily: 'inherit',
          height: '100%',
          overflow: 'auto',
        },
        /* Search panel styling */
        '.cm-panel.cm-search': {
          padding: '8px',
          backgroundColor: 'hsl(var(--background))',
          borderBottom: '1px solid hsl(var(--muted))',
          color: 'hsl(var(--foreground))',
          fontFamily: 'inherit',
        },
        '.cm-panel.cm-search input': {
          backgroundColor: 'hsl(var(--input))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--muted))',
          borderRadius: '6px',
          padding: '4px 6px',
          fontSize: '12px',
          fontFamily: 'inherit',
          '&:focus': {
            outline: 'none',
          },
        },
        '.cm-panel.cm-search .cm-button': {
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          border: 'none',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        },
        '.cm-panel.cm-search .cm-button:hover': {
          filter: 'brightness(0.9)',
          fontFamily: 'inherit',
        },
        '.cm-searchMatch': {
          backgroundColor: 'hsl(var(--yellow) / 0.4)',
          outline: '2px solid hsl(var(--yellow))',
          fontFamily: 'inherit',
        },
        '.cm-selectionMatch': {
          backgroundColor: 'hsl(var(--accent) / 0.4)',
          fontFamily: 'inherit',
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.changes.empty === false) {
          const newValue = update.state.doc.toString()
          onChange(newValue)
        }
      }),
      EditorState.readOnly.of(readOnly),
    ]

    if (theme === 'dark') {
      extensions.push(oneDark)
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view
    initialValueRef.current = value
    setIsInitialized(true)

    return () => {
      view.destroy()
      viewRef.current = null
      setIsInitialized(false)
    }
  }, [theme, readOnly])

  // Only update the editor content if the value prop changes from outside
  // and it's different from what was initially set
  useEffect(() => {
    if (!viewRef.current || !isInitialized) return
    
    const currentValue = viewRef.current.state.doc.toString()
    
    // Only update if the incoming value is different from current content
    // and this is not just an echo of what the user typed
    if (value !== currentValue && value !== initialValueRef.current) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      })
      initialValueRef.current = value
    }
  }, [value, isInitialized])

  return (
    <div className={`w-full h-full ${className}`}>
      <div ref={editorRef} className="w-full h-full" />
    </div>
  )
} 