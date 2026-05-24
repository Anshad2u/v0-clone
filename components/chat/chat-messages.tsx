'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { MessageRenderer } from '@/components/message-renderer'

interface ChatMessage {
  type: 'user' | 'assistant'
  content: string | any
  isStreaming?: boolean
}

interface ChatMessagesProps {
  chatHistory: ChatMessage[]
  isLoading: boolean
  isLoadingChat?: boolean
  streamingContent?: string
  onStreamingComplete?: (finalContent: any) => void
}

export function ChatMessages({
  chatHistory,
  isLoading,
  isLoadingChat,
  streamingContent,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, streamingContent])

  if (chatHistory.length === 0 && !isLoading && !isLoadingChat) {
    return (
      <Conversation>
        <ConversationContent>
          <div />
        </ConversationContent>
      </Conversation>
    )
  }

  return (
    <Conversation>
      <ConversationContent>
        {chatHistory.map((msg, index) => (
          <Message from={msg.type} key={index}>
            <MessageRenderer
              content={msg.content}
              role={msg.type}
              messageId={`msg-${index}`}
            />
          </Message>
        ))}

        {/* Show streaming content */}
        {streamingContent && (
          <Message from="assistant">
            <MessageRenderer
              content={streamingContent}
              role="assistant"
              messageId="streaming"
            />
          </Message>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingContent && (
          <div className="flex justify-center py-4">
            <Loader size={16} className="text-gray-500 dark:text-gray-400" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </ConversationContent>
    </Conversation>
  )
}
