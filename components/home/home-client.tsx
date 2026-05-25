'use client'

import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  PromptInput,
  PromptInputImageButton,
  PromptInputImagePreview,
  PromptInputMicButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  createImageAttachment,
  createImageAttachmentFromStored,
  savePromptToStorage,
  loadPromptFromStorage,
  clearPromptFromStorage,
  type ImageAttachment,
} from '@/components/ai-elements/prompt-input'
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion'
import { AppHeader } from '@/components/shared/app-header'
import { ChatMessages } from '@/components/chat/chat-messages'
import { ChatInput } from '@/components/chat/chat-input'
import { PreviewPanel } from '@/components/chat/preview-panel'
import { ResizableLayout } from '@/components/shared/resizable-layout'
import { BottomToolbar } from '@/components/shared/bottom-toolbar'

function SearchParamsHandler({ onReset }: { onReset: () => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('reset') === 'true') {
      onReset()
      const url = new URL(window.location.href)
      url.searchParams.delete('reset')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [searchParams, onReset])
  return null
}

export function HomeClient() {
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showChatInterface, setShowChatInterface] = useState(false)
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [chatHistory, setChatHistory] = useState<
    Array<{ type: 'user' | 'assistant'; content: string; isStreaming?: boolean }>
  >([])
  const [streamingContent, setStreamingContent] = useState('')
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [currentChat, setCurrentChat] = useState<{ id: string } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activePanel, setActivePanel] = useState<'chat' | 'preview'>('chat')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleReset = useCallback(() => {
    setShowChatInterface(false)
    setChatHistory([])
    setStreamingContent('')
    setCurrentChatId(null)
    setCurrentChat(null)
    setMessage('')
    setAttachments([])
    setIsLoading(false)
    setIsFullscreen(false)
    clearPromptFromStorage()
  }, [])

  useEffect(() => {
    textareaRef.current?.focus()
    const stored = loadPromptFromStorage()
    if (stored) {
      setMessage(stored.message)
      if (stored.attachments.length > 0) {
        setAttachments(stored.attachments.map(createImageAttachmentFromStored))
      }
    }
  }, [])

  useEffect(() => {
    if (message.trim() || attachments.length > 0) {
      savePromptToStorage(message, attachments)
    } else {
      clearPromptFromStorage()
    }
  }, [message, attachments])

  // SSE stream parser
  const processSSEStream = useCallback(
    async (response: Response, chatId: string) => {
      if (!response.body) throw new Error('No response body')

      setStreamingContent('')
      setIsLoading(false)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep partial line

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.text) {
                  fullText += parsed.text
                  setStreamingContent(fullText)
                }
              } catch {
                // ignore parse errors for non-JSON data events
              }
            }
          }
        }

        // Process any remaining buffer
        if (buffer.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(buffer.slice(6))
            if (parsed.text) {
              fullText += parsed.text
              setStreamingContent(fullText)
            }
          } catch {}
        }
      } finally {
        reader.releaseLock()
      }

      // Streaming done — finalize chat history
      setChatHistory((prev) => [
        ...prev,
        { type: 'assistant', content: fullText },
      ])
      setStreamingContent('')
    },
    [],
  )

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!message.trim() || isLoading) return

    const userMessage = message.trim()
    const currentAttachments = [...attachments]
    clearPromptFromStorage()
    setMessage('')
    setAttachments([])
    setShowChatInterface(true)
    setChatHistory([{ type: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          streaming: true,
          attachments: currentAttachments.map((a) => ({ url: a.dataUrl })),
        }),
      })

      if (!response.ok) {
        let errMsg = 'Sorry, there was an error processing your message.'
        try {
          const err = await response.json()
          errMsg = err.message || errMsg
        } catch {}
        throw new Error(errMsg)
      }

      // Get chat ID from response header
      const chatId = response.headers.get('X-Chat-Id') || ''
      if (chatId) {
        setCurrentChatId(chatId)
        setCurrentChat({ id: chatId })
        window.history.pushState(null, '', `/chats/${chatId}`)
      }

      // Process SSE stream
      await processSSEStream(response, chatId)
    } catch (error) {
      setIsLoading(false)
      setStreamingContent('')
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'Sorry, there was an error.',
        },
      ])
    }
  }

  const handleChatSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!message.trim() || isLoading || !currentChatId) return

    const userMessage = message.trim()
    setMessage('')
    setIsLoading(true)
    setChatHistory((prev) => [...prev, { type: 'user', content: userMessage }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          chatId: currentChatId,
          streaming: true,
        }),
      })

      if (!response.ok) {
        let errMsg = 'Sorry, there was an error processing your message.'
        try {
          const err = await response.json()
          errMsg = err.message || errMsg
        } catch {}
        throw new Error(errMsg)
      }
    // Update chat ID if server returned a new one
    const newChatId = response.headers.get('X-Chat-Id')
    if (newChatId) {
      setCurrentChatId(newChatId)
    }

      await processSSEStream(response, currentChatId)
    } catch (error) {
      setIsLoading(false)
      setStreamingContent('')
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'Sorry, there was an error.',
        },
      ])
    }
  }

  // SSE stream parser for existing chat (used from chat detail page)
  const processStreamFromResponse = useCallback(
    async (response: Response) => {
      if (!response.body) throw new Error('No response body')
      setIsLoading(false)
      setStreamingContent('')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.text) {
                  fullText += parsed.text
                  setStreamingContent(fullText)
                }
              } catch {}
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      setChatHistory((prev) => [
        ...prev,
        { type: 'assistant', content: fullText },
      ])
      setStreamingContent('')
      setCurrentChat((prev) => (prev ? { ...prev } : null))
    },
    [],
  )

  if (showChatInterface) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
        <Suspense fallback={null}>
          <SearchParamsHandler onReset={handleReset} />
        </Suspense>
        <AppHeader />
        <div className="flex flex-col h-[calc(100vh-64px-40px)] md:h-[calc(100vh-64px)]">
          <ResizableLayout
            className="flex-1 min-h-0"
            singlePanelMode={false}
            activePanel={activePanel === 'chat' ? 'left' : 'right'}
            leftPanel={
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto">
                  <ChatMessages
                    chatHistory={chatHistory}
                    isLoading={isLoading}
                    streamingContent={streamingContent}
                  />
                </div>
                <ChatInput
                  message={message}
                  setMessage={setMessage}
                  onSubmit={handleChatSendMessage}
                  isLoading={isLoading}
                  showSuggestions={false}
                />
              </div>
            }
            rightPanel={
              <PreviewPanel
                chatHistory={chatHistory}
                streamingContent={streamingContent}
                isFullscreen={isFullscreen}
                setIsFullscreen={setIsFullscreen}
                refreshKey={refreshKey}
                setRefreshKey={setRefreshKey}
              />
            }
          />
          <div className="md:hidden">
            <BottomToolbar
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              hasPreview={!!currentChat}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
      <Suspense fallback={null}>
        <SearchParamsHandler onReset={handleReset} />
      </Suspense>
      <AppHeader />
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              What dashboard can we build?
            </h2>
          </div>
          <div className="max-w-2xl mx-auto">
            <PromptInput
              onSubmit={handleSendMessage}
              className="w-full relative"
              onImageDrop={async (files) => {
                const newAttachments = await Promise.all(
                  files.map((f) => createImageAttachment(f)),
                )
                setAttachments((prev) => [...prev, ...newAttachments])
              }}
            >
              <PromptInputImagePreview
                attachments={attachments}
                onRemove={(id) =>
                  setAttachments((prev) => prev.filter((a) => a.id !== id))
                }
              />
              <PromptInputTextarea
                ref={textareaRef}
                onChange={(e) => setMessage(e.target.value)}
                value={message}
                placeholder="Describe the dashboard you want to build..."
                className="min-h-[80px] text-base"
                disabled={isLoading}
              />
              <PromptInputToolbar>
                <PromptInputTools>
                  <PromptInputImageButton
                    onImageSelect={async (files) => {
                      const newAttachments = await Promise.all(
                        files.map((f) => createImageAttachment(f)),
                      )
                      setAttachments((prev) => [...prev, ...newAttachments])
                    }}
                    disabled={isLoading}
                  />
                </PromptInputTools>
                <PromptInputTools>
                  <PromptInputMicButton
                    onTranscript={(t) =>
                      setMessage((prev) => prev + (prev ? ' ' : '') + t)
                    }
                    disabled={isLoading}
                  />
                  <PromptInputSubmit
                    disabled={!message.trim() || isLoading}
                    status={isLoading ? 'streaming' : 'ready'}
                  />
                </PromptInputTools>
              </PromptInputToolbar>
            </PromptInput>
          </div>
          <div className="mt-4 max-w-2xl mx-auto">
            <Suggestions>
              <Suggestion
                onClick={() => {
                  setMessage('Sales dashboard with charts and KPIs')
                  setTimeout(() => textareaRef.current?.form?.requestSubmit(), 0)
                }}
                suggestion="Sales Dashboard"
              />
              <Suggestion
                onClick={() => {
                  setMessage('Analytics dashboard with metrics grid')
                  setTimeout(() => textareaRef.current?.form?.requestSubmit(), 0)
                }}
                suggestion="Analytics Dashboard"
              />
              <Suggestion
                onClick={() => {
                  setMessage('Project management dashboard with task table')
                  setTimeout(() => textareaRef.current?.form?.requestSubmit(), 0)
                }}
                suggestion="Project Dashboard"
              />
              <Suggestion
                onClick={() => {
                  setMessage('Financial dashboard with revenue charts')
                  setTimeout(() => textareaRef.current?.form?.requestSubmit(), 0)
                }}
                suggestion="Financial Dashboard"
              />
              <Suggestion
                onClick={() => {
                  setMessage('Team performance dashboard')
                  setTimeout(() => textareaRef.current?.form?.requestSubmit(), 0)
                }}
                suggestion="Team Dashboard"
              />
              <Suggestion
                onClick={() => {
                  setMessage('Real-time monitoring dashboard')
                  setTimeout(() => textareaRef.current?.form?.requestSubmit(), 0)
                }}
                suggestion="Monitoring Dashboard"
              />
            </Suggestions>
          </div>
          <div className="mt-8 md:mt-16 text-center text-sm text-muted-foreground">
            <p>
              Powered by{' '}
              <a
                href="https://build.nvidia.com/explore/discover"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
              >
                NVIDIA NIM + MiniMax M2.7
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
