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
    setIsInitialized(true)

    return () => {
      view.destroy()
      viewRef.current = null
      setIsInitialized(false)
    }
  }, [theme, readOnly])

  // Update content when value prop changes (but not on user input)
  useEffect(() => {
    if (!viewRef.current || !isInitialized) return
    
    const currentValue = viewRef.current.state.doc.toString()
    if (currentValue !== value) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      })
    }
  }, [value, isInitialized])

  return (
    <div className={`w-full h-full ${className}`}>
      <div ref={editorRef} className="w-full h-full" />
    </div>
  )
} 