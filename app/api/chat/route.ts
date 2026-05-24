import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/(auth)/auth'
import {
  createChat,
  createMessage,
  getMessagesByChatId,
} from '@/lib/db/queries'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const MODEL = 'qwen/qwen3-coder-480b-a35b-instruct'
const API_KEY = process.env.NVIDIA_API_KEY

const SYSTEM_PROMPT = `You are a dashboard-building AI assistant. You generate production-quality dashboard interfaces.

When a user asks you to build a dashboard, you MUST respond with:
1. A clear explanation of what you're building
2. The complete code (React/TypeScript/Tailwind) inside a triple-backtick code block with the language "tsx"

You can generate dashboard components like:
- Charts (bar, line, pie, area)
- Data tables with sorting and filtering
- KPI cards with metrics
- Sidebars and navigation
- Layout grids and responsive designs
- Dark/light mode support
- Real-time data displays

Always use Tailwind CSS for styling. Import from 'react' and 'lucide-react' for icons.
Make dashboards visually stunning with gradients, shadows, and proper spacing.
Output ONLY valid React TSX code in the code blocks. Use "use client" directive when needed.

If the user asks something unrelated to dashboards, politely redirect them to dashboard use cases.`

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const { message, chatId } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Create or reuse chat session
    let activeChatId = chatId
    if (!activeChatId && session?.user?.id) {
      const chat = await createChat({ userId: session.user.id })
      activeChatId = chat.id
    }

    // Save user message
    if (activeChatId) {
      await createMessage({ chatId: activeChatId, role: 'user', content: message }).catch(() => {})
    }

    // Build conversation history
    let messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ]

    if (activeChatId) {
      try {
        const { getMessagesByChatId } = await import('@/lib/db/queries')
        const history = await getMessagesByChatId({ chatId: activeChatId })
        for (const msg of history) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content })
          }
        }
      } catch {
        // Fall back to just the current message if DB query fails
        messages.push({ role: 'user', content: message })
      }
    } else {
      messages.push({ role: 'user', content: message })
    }

    // Call NVIDIA NIM API with streaming
    const nvidiaResponse = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      }),
    })

    if (!nvidiaResponse.ok) {
      const errText = await nvidiaResponse.text().catch(() => 'Unknown error')
      console.error('NVIDIA API error:', nvidiaResponse.status, errText)
      return NextResponse.json(
        { error: `AI service error: ${nvidiaResponse.status}` },
        { status: 502 },
      )
    }

    if (!nvidiaResponse.body) {
      return NextResponse.json({ error: 'No response body from AI service' }, { status: 502 })
    }

    const nvidiaReader = nvidiaResponse.body.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    let fullText = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = ''
          while (true) {
            const { done, value } = await nvidiaReader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const payload = line.slice(6).trim()
                if (payload === '[DONE]') continue
                try {
                  const parsed = JSON.parse(payload)
                  const choice = parsed.choices?.[0]
                  const content = choice?.delta?.content || choice?.text || ''
                  if (content) {
                    fullText += content
                    const event = `data: ${JSON.stringify({ text: content })}\n\n`
                    controller.enqueue(encoder.encode(event))
                  }
                } catch {
                  // Skip non-JSON lines
                }
              }
            }
          }
        } finally {
          controller.close()
        }

        // Save assistant message after streaming completes
        if (activeChatId && fullText) {
          await createMessage({ chatId: activeChatId, role: 'assistant', content: fullText }).catch(() => {})
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Chat-Id': activeChatId || '',
      },
    })
  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
