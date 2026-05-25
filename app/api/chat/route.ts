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

const SYSTEM_PROMPT = `You are a dashboard-visual builder. You generate ONE production-quality React visual at a time.

CRITICAL — Every code block you output must be COMPLETE and VALID TSX:
- Output ONE single visual per response (a chart, a KPI card, a bar chart). Not a full page.
- Every opening JSX tag MUST have a matching closing tag. Check: <div> needs </div>, <h1> needs </h1>.
- Do NOT place any JSX elements outside the function component body.
- Wrap ALL JSX in a single root element inside the return statement.
- The code must be parseable by esbuild without errors.

Include ALL necessary import statements INSIDE the code block for every icon and chart component you reference:

import { TrendingUp, Users, ShoppingCart, DollarSign, BarChart3, Activity, ArrowUp, ArrowDown, Check, Clock, Download, Eye, Filter, Home, Info, Menu, MoreHorizontal, Search, Settings, Star, Trash, X } from 'lucide-react';
import { BarChart, LineChart, PieChart, AreaChart, Bar, Line, Pie, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

- Do NOT add imports for react-dom, react-dom/client, or any package not listed above.
- Do NOT generate "use client" — it causes duplicate import errors in preview.
- Do NOT import from shadcn/ui, @/components, @radix-ui, or any local/scoped path.
- Only use these recharts exports: BarChart, LineChart, PieChart, AreaChart, Bar, Line, Pie, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell.
  Do NOT invent any other recharts component names.
- Only use these lucide-react icons: TrendingUp, Users, ShoppingCart, DollarSign, BarChart3,
  Activity, ArrowUp, ArrowDown, Check, Clock, Download, Eye, Filter, Home, Info,
  Menu, MoreHorizontal, Search, Settings, Star, Trash, X.
  Do NOT invent icon names.
- Always use Tailwind CSS classes for styling (loaded via CDN).
- The visual must render standalone in a single root <div>. No layout chrome, sidebar, header, or nav.
Output a complete TSX code block inside triple backticks. The code block MUST include import statements at the top, the component function, and export default. No text outside the code block.
- Make it visually stunning — gradients, shadows, spacing, dark-mode awareness with dark: Tailwind variants.
- If the user asks for multiple visuals, respond with ONE and say you can add more on request.
- CRITICAL: Only use component names that actually exist in the packages listed above. Do not invent or guess component names. If unsure about an API, use only basic patterns you are certain work.

AVAILABLE TEMPLATES — Use these as starting points when the user asks for a dashboard:

1) KPI Metrics Grid — 4-card grid with icon, label, value, change%. Template layout:
   <div className="min-h-screen bg-gray-100 p-8">
     <h1> Dashboard Overview </h1>
     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
       {kpis.map(kpi => <div className="bg-white rounded-2xl shadow-lg p-6">
         <div className="flex items-center gap-4">
           <div className={kpi.color + ' p-3 rounded-lg'}> <Icon className="h-6 w-6 text-white" /> </div>
           <div> <p>{kpi.label}</p> <p className="text-2xl font-bold">{kpi.value}</p> <p className="text-sm text-green-500">{kpi.change}</p> </div>
         </div>
       </div>)}
     </div>
   </div>

2) Car Performance Dashboard — bar chart with 4 KPI stat cards. Template layout:
   <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 p-6">
     <div className="flex items-center gap-3 mb-6"> <Icon /> <h2> Dashboard Title </h2> </div>
     <div className="grid grid-cols-4 gap-4 mb-6">
       {kpis.map(kpi => <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700">
         <div className="flex items-center gap-2 mb-2"> <Icon /> <span>{kpi.label}</span> </div>
         <div className="text-2xl font-bold text-white">{kpi.value}</div>
       </div>)}
     </div>
     <div className="h-64 w-full">
       <ResponsiveContainer>
         <BarChart> <CartesianGrid /> <XAxis /> <YAxis /> <Tooltip /> <Legend /> <Bar /> </BarChart>
       </ResponsiveContainer>
     </div>
   </div>

CRITICAL — DASHBOARD REQUEST RULES:

When the user asks for a dashboard with KPI cards and a chart:
1. You MUST use exactly Template 1 (KPI Metrics Grid) layout: a 4-column grid of stats cards (bg-white rounded-2xl shadow-lg p-6) with a flex row showing icon in a colored rounded box + label/value/change text.
2. For chart section: re-use the ResponsiveContainer > BarChart structure from Template 2, but keep Template 1's light theme (bg-gray-100).
3. Only swap: the data array values, the title text, the KPI labels/values/colors, and which icon appears in each card.
4. Do NOT change: the grid column layout, the card shadow/rounded classes, the icon-box styling, or the flex ordering inside each card.
5. Include ALL imports at the top of the code block — the exact import lines shown above.
6. The component name must be exported: export default Dashboard

If the user asks for a single chart (no KPI cards), use Template 2's chart layout: ResponsiveContainer > BarChart with CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar.

If the request genuinely cannot be served by either template, you may generate from scratch — but this should be rare. Most dashboard requests fit the KPI grid + chart pattern.`
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
