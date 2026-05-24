import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/(auth)/auth'
import { getChatsByUserId } from '@/lib/db/queries'

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ data: [] })
    }

    const chats = await getChatsByUserId({ userId: session.user.id })

    return NextResponse.json({
      data: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
      })),
    })
  } catch (error) {
    console.error('Chats fetch error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch chats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
