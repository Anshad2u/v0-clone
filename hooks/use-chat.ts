'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useStreaming } from '@/contexts/streaming-context'
import useSWR, { mutate } from 'swr'

interface ChatMessage {
  type: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function useChat(chatId: string) {
  const router = useRouter()
  const { handoff, clearHandoff } = useStreaming()
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const historyLoadedRef = useRef(false)

  // Fetch chat data
  const { data: currentChat, isLoading: isLoadingChat } = useSWR(
    chatId ? `/api/chats/${chatId}` : null,
    {
      onError: () => router.push('/'),
      onSuccess: (chat) => {
        if (chat.messages && !historyLoadedRef.current && !handoff.stream) {
          historyLoadedRef.current = true
          setChatHistory(
            chat.messages.map((m: any) => ({
              type: m.role,
              content: m.content,
            })),
          )
        }
      },
    },
  )

  // Handle streaming from context (redirect from homepage)
  useEffect(() => {
    if (
      handoff.chatId === chatId &&
      handoff.stream &&
      handoff.userMessage
    ) {
      setChatHistory((prev) => [
        ...prev,
        { type: 'user', content: handoff.userMessage! },
        { type: 'assistant', content: '', isStreaming: true },
      ])
      processStream(handoff.stream)
      clearHandoff()
    }
  }, [chatId, handoff, clearHandoff])

  const processStream = useCallback(async (body: ReadableStream<Uint8Array>) => {
    setIsLoading(true)
    const reader = body.getReader()
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

    setChatHistory((prev) => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last?.isStreaming) {
        updated[updated.length - 1] = {
          type: 'assistant',
          content: fullText,
        }
      }
      return updated
    })
    setStreamingContent('')
    setIsLoading(false)
    mutate(`/api/chats/${chatId}`)
  }, [chatId])

  const handleSendMessage = useCallback(
    async (
      e: React.FormEvent<HTMLFormElement>,
      attachments?: Array<{ url: string }>,
    ) => {
      e.preventDefault()
      if (!message.trim() || isLoading || !chatId) return

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
            chatId,
            streaming: true,
            ...(attachments?.length ? { attachments } : {}),
          }),
        })

        if (!response.ok) {
          let errMsg = 'Sorry, there was an error.'
          try {
            const err = await response.json()
            errMsg = err.message || errMsg
          } catch {}
          throw new Error(errMsg)
        }

        if (!response.body) throw new Error('No response body')
        await processStream(response.body)
      } catch (error) {
        setIsLoading(false)
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
    },
    [message, isLoading, chatId, processStream],
  )

  return {
    message,
    setMessage,
    currentChat,
    isLoading,
    isLoadingChat,
    streamingContent,
    chatHistory,
    handleSendMessage,
  }
}
