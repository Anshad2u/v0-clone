'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
  WebPreviewBody,
} from '@/components/ai-elements/web-preview'
import { RefreshCw, Maximize, Minimize, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMessage {
  type: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface PreviewPanelProps {
  chatHistory: ChatMessage[]
  streamingContent?: string
  isFullscreen: boolean
  setIsFullscreen: (fullscreen: boolean) => void
  refreshKey: number
  setRefreshKey: (key: number | ((prev: number) => number)) => void
}

type PreviewState = 'idle' | 'loading' | 'ready' | 'error'

/** Extract all tsx/jsx code blocks from markdown text */
function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = []
  const regex = /```(?:tsx|jsx|typescript|javascript)\s*\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim())
  }
  return blocks
}

/** Helper to debounce rapid updates (e.g. during streaming) */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function PreviewPanel({
  chatHistory,
  streamingContent,
  isFullscreen,
  setIsFullscreen,
  refreshKey,
  setRefreshKey,
}: PreviewPanelProps) {
  const [previewState, setPreviewState] = useState<PreviewState>('idle')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [lastCompiled, setLastCompiled] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)

  // Combine streaming content with the latest assistant message
  // to extract the most up-to-date code
  const latestCode = useDebounce(
    (() => {
      const lastAssistant = [...chatHistory]
        .reverse()
        .find((m) => m.type === 'assistant')
      const fullText =
        (lastAssistant?.content || '') + (streamingContent || '')
      const blocks = extractCodeBlocks(fullText)
      return blocks[0] || null
    })(),
    500,
  )

  useEffect(() => {
    if (!latestCode) {
      setPreviewState('idle')
      setPreviewHtml(null)
      setPreviewError(null)
      return
    }

    // Skip if this code was already successfully compiled
    if (latestCode === lastCompiled) return

    let cancelled = false
    const controller = new AbortController()
    abortRef.current = controller

    const compile = async () => {
      setPreviewState('loading')
      setPreviewError(null)

      try {
        const res = await fetch('/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: latestCode }),
          signal: controller.signal,
        })

        if (cancelled) return

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Compilation failed' }))
          setPreviewState('error')
          setPreviewError(err.error || `HTTP ${res.status}`)
          return
        }

        const data = await res.json()
        if (cancelled) return

        setPreviewHtml(data.html)
        setPreviewState('ready')
        setLastCompiled(latestCode)
      } catch (err) {
        if (cancelled) return
        if ((err as Error).name === 'AbortError') return
        setPreviewState('error')
        setPreviewError((err as Error).message || 'Compilation failed')
      }
    }

    compile()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [latestCode, lastCompiled])

  // Cancel pending compilations on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleRefresh = useCallback(() => {
    if (previewHtml) {
      // Force iframe remount by bumping key
      setRefreshKey((prev) => prev + 1)
    }
  }, [previewHtml, setRefreshKey])

  return (
    <div
      className={cn(
        'flex flex-col h-full transition-all duration-300',
        isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-black' : 'flex-1',
      )}
    >
      <WebPreview defaultUrl="">
        <WebPreviewNavigation>
          <WebPreviewNavigationButton
            onClick={handleRefresh}
            tooltip="Refresh preview"
            disabled={previewState !== 'ready'}
          >
            <RefreshCw className={cn('h-4 w-4', previewState === 'loading' && 'animate-spin')} />
          </WebPreviewNavigationButton>
          <WebPreviewUrl
            readOnly
            placeholder={
              previewState === 'idle'
                ? 'No code to preview — start a conversation and ask for a dashboard!'
                : previewState === 'loading'
                  ? 'Compiling dashboard...'
                  : previewState === 'error'
                    ? 'Preview error — check the code'
                    : 'Dashboard Preview'
            }
            value={
              previewState === 'loading'
                ? 'Compiling dashboard...'
                : previewState === 'error'
                  ? 'Compilation failed'
                  : previewState === 'ready'
                    ? 'Dashboard Preview — Live'
                    : ''
            }
          />
          <WebPreviewNavigationButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            tooltip={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            disabled={previewState !== 'ready'}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>

        {previewState === 'ready' && previewHtml ? (
          <WebPreviewBody
            key={`preview-${refreshKey}`}
            srcDoc={previewHtml}
            sandbox="allow-scripts"
            title="Dashboard Preview"
          />
        ) : previewState === 'loading' ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Compiling dashboard...
              </p>
              <p className="text-xs text-gray-700/50 dark:text-gray-200/50 mt-1">
                Bundling React components and dependencies
              </p>
            </div>
          </div>
        ) : previewState === 'error' ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black">
            <div className="text-center max-w-md px-4">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Compilation Error
              </p>
              <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-left overflow-x-auto max-h-32 overflow-y-auto">
                {previewError}
              </pre>
              <p className="text-xs text-gray-700/50 dark:text-gray-200/50 mt-2">
                The AI code may be incomplete while still streaming. It will update
                automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black">
            <div className="text-center max-w-sm px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 dark:from-blue-400/10 dark:to-purple-500/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-blue-500 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Live Dashboard Preview
              </p>
              <p className="text-xs text-gray-700/50 dark:text-gray-200/50 mt-1.5 leading-relaxed">
                Ask the AI to build a dashboard. When it generates code, the live
                preview will appear here.
              </p>
            </div>
          </div>
        )}
      </WebPreview>
    </div>
  )
}
