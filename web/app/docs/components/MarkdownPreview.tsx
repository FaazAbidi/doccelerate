'use client'

import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/app/components/Button'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

// Enhanced code component with syntax highlighting and copy functionality
function CodeBlock({ 
  children, 
  className
}: { 
  children: string; 
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  
  // Extract language from className, handling both markdown and highlight.js formats
  const extractLanguage = (className?: string): string => {
    if (!className) return 'text'
    
    // Handle various className formats:
    // - "language-python" (from markdown)
    // - "hljs language-python" (from highlight.js)
    // - "python hljs" (alternative highlight.js format)
    // - "hljs python" (another highlight.js format)
    
    const classes = className.split(' ')
    
    // Look for language-xxx pattern first
    const languageClass = classes.find(cls => cls.startsWith('language-'))
    if (languageClass) {
      return languageClass.replace('language-', '')
    }
    
    // Filter out highlight.js specific classes and get the language
    const filteredClasses = classes.filter(cls => 
      cls !== 'hljs' && 
      cls !== 'language' && 
      cls.length > 0
    )
    
    return filteredClasses[0] || 'text'
  }
  
  const language = extractLanguage(className)
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy code:', error)
    }
  }
  
  return (
    <div className="relative group mb-4 border border-neutral/20 rounded-lg overflow-hidden bg-white/80">
      {/* Language label and copy button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral/20 bg-neutral/5">
        <span className="text-caption font-sm text-neutral uppercase tracking-wide">
          {language === 'text' ? 'Code' : language}
        </span>
        
        <Button
          onClick={handleCopy}
          size="sm"
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <Check className="w-3 h-3 text-success" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>
      </div>
      
      {/* Code content */}
      <pre className="p-4 overflow-x-auto bg-transparent">
        <code 
          className={`${className} font-mono text-body-xs leading-relaxed text-neutral`}
          style={{
            // Override any default highlight.js styles for better integration
            background: 'transparent',
            padding: 0,
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
        >
          {children}
        </code>
      </pre>
    </div>
  )
}

// Enhanced inline code component
function InlineCode({ 
  children
}: { 
  children: string
}) {
  return (
    <code className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-body-sm font-mono font-medium">
      {children}
    </code>
  )
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  const markdownComponents = useMemo(() => ({
    code: ({ children, className }: { children: string; className?: string }) => {
      // Inline code (no className means it's inline)
      if (!className) {
        return <InlineCode>{children}</InlineCode>
      }
      // Code block
      return <CodeBlock className={className}>{children}</CodeBlock>
    },
    pre: ({ children }: { children: React.ReactNode }) => {
      // Let CodeBlock handle the pre styling
      return <>{children}</>
    },
    h1: ({ children }: { children: React.ReactNode }) => (
      <h1 className="text-heading-xl font-bold text-neutral mb-6 mt-8 first:mt-0 border-b border-neutral/20 pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }: { children: React.ReactNode }) => (
      <h2 className="text-heading-lg font-semibold text-neutral mb-4 mt-6 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }: { children: React.ReactNode }) => (
      <h3 className="text-heading-md font-semibold text-neutral mb-3 mt-5 first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }: { children: React.ReactNode }) => (
      <h4 className="text-heading-sm font-semibold text-neutral mb-2 mt-4 first:mt-0">
        {children}
      </h4>
    ),
    h5: ({ children }: { children: React.ReactNode }) => (
      <h5 className="text-body-lg font-semibold text-neutral mb-2 mt-3 first:mt-0">
        {children}
      </h5>
    ),
    h6: ({ children }: { children: React.ReactNode }) => (
      <h6 className="text-body-md font-semibold text-neutral mb-2 mt-3 first:mt-0">
        {children}
      </h6>
    ),
    p: ({ children }: { children: React.ReactNode }) => (
      <p className="text-body-md text-neutral mb-4 leading-relaxed">
        {children}
      </p>
    ),
    ul: ({ children }: { children: React.ReactNode }) => (
      <ul className="list-disc ml-6 mb-4 space-y-1 text-neutral">
        {children}
      </ul>
    ),
    ol: ({ children }: { children: React.ReactNode }) => (
      <ol className="list-decimal ml-6 mb-4 space-y-1 text-neutral">
        {children}
      </ol>
    ),
    li: ({ children }: { children: React.ReactNode }) => (
      <li className="text-body-md leading-relaxed">
        {children}
      </li>
    ),
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote className="border-l-4 border-primary/30 pl-4 mb-4 italic text-neutral/80">
        {children}
      </blockquote>
    ),
    a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 underline transition-colors"
      >
        {children}
      </a>
    ),
    table: ({ children }: { children: React.ReactNode }) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border border-neutral/20">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: { children: React.ReactNode }) => (
      <thead className="bg-neutral/5">
        {children}
      </thead>
    ),
    th: ({ children }: { children: React.ReactNode }) => (
      <th className="border border-neutral/20 px-4 py-2 text-left font-semibold text-neutral">
        {children}
      </th>
    ),
    td: ({ children }: { children: React.ReactNode }) => (
      <td className="border border-neutral/20 px-4 py-2 text-neutral">
        {children}
      </td>
    ),
    hr: () => (
      <hr className="border-neutral/20 my-8" />
    ),
  }), [])

  return (
    <div className={`prose prose-neutral max-w-none p-6 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeAutolinkHeadings, {behavior: 'append'}], rehypeHighlight]}
        components={markdownComponents as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
} 