import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

// Custom markdown renderers for dashboard code display
const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const isInline = !className
    if (isInline) {
      return (
        <code
          className="bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <div className="relative group my-4">
        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded-t-lg border border-gray-200 dark:border-gray-700 px-4 py-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {className?.replace('language-', '') || 'code'}
          </span>
        </div>
        <pre className="bg-gray-50 dark:bg-gray-900 rounded-b-lg border-x border-b border-gray-200 dark:border-gray-700 p-4 overflow-x-auto">
          <code className={`${className} text-sm leading-relaxed`} {...props}>
            {children}
          </code>
        </pre>
      </div>
    )
  },
  pre({ children }) {
    return <>{children}</>
  },
  h1({ children }) {
    return <h1 className="text-2xl font-bold mt-6 mb-3 text-gray-900 dark:text-white">{children}</h1>
  },
  h2({ children }) {
    return <h2 className="text-xl font-semibold mt-5 mb-2 text-gray-900 dark:text-white">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="text-lg font-medium mt-4 mb-2 text-gray-900 dark:text-white">{children}</h3>
  },
  p({ children }) {
    return <p className="mb-4 text-gray-700 dark:text-gray-200 leading-relaxed">{children}</p>
  },
  ul({ children }) {
    return <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-200">{children}</ul>
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-200">{children}</ol>
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline">
        {children}
      </a>
    )
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-blue-500 pl-4 my-4 italic text-gray-600 dark:text-gray-400">
        {children}
      </blockquote>
    )
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700">
          {children}
        </table>
      </div>
    )
  },
  th({ children }) {
    return <th className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-left text-sm font-semibold">{children}</th>
  },
  td({ children }) {
    return <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm">{children}</td>
  },
}

interface MessageRendererProps {
  content: string | any
  messageId?: string
  role: 'user' | 'assistant'
  className?: string
}

export function MessageRenderer({
  content,
  messageId,
  role,
  className,
}: MessageRendererProps) {
  const textContent = typeof content === 'string' ? content : ''

  if (role === 'user') {
    return (
      <div className={className} key={messageId}>
        <p className="mb-4 text-gray-700 dark:text-gray-200 leading-relaxed">
          {textContent}
        </p>
      </div>
    )
  }

  return (
    <div className={className} key={messageId}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {textContent}
      </ReactMarkdown>
    </div>
  )
}
