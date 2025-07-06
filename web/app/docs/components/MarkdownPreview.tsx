'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface MarkdownPreviewProps {
  content: string
  className?: string
  theme?: 'light' | 'dark'
}

// Custom code component with basic styling
function CodeBlock({ 
  children, 
  className, 
  theme = 'light' 
}: { 
  children: string; 
  className?: string; 
  theme?: 'light' | 'dark' 
}) {
  const isDark = theme === 'dark'
  
  return (
    <pre className={`
      rounded-lg p-4 overflow-x-auto font-mono text-sm
      ${isDark ? 'bg-neutral-800 text-neutral-100' : 'bg-neutral/5 text-neutral-900'}
    `}>
      <code className={className}>{children}</code>
    </pre>
  )
}

export function MarkdownPreview({ content, className = '', theme = 'light' }: MarkdownPreviewProps) {
  const markdownComponents = useMemo(() => ({
    code: ({ children, className }: { children: string; className?: string }) => {
      // Inline code
      if (!className) {
        return (
          <code className="bg-neutral/10 px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        )
      }
      // Code block
      return <CodeBlock className={className} theme={theme}>{children}</CodeBlock>
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
      <ul className="list-disc list-inside mb-4 space-y-1 text-neutral">
        {children}
      </ul>
    ),
    ol: ({ children }: { children: React.ReactNode }) => (
      <ol className="list-decimal list-inside mb-4 space-y-1 text-neutral">
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
  }), [theme])

  return (
    <div className={`prose prose-neutral max-w-none p-6 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents as any}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
} 