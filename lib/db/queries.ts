import 'server-only'

import { and, count, desc, eq, gte } from 'drizzle-orm'

import { users, chats, messages, type User, type Chat, type Message } from './schema'
import db from './connection'

// ── Users ──────────────────────────────────────────────────────

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(users).where(eq(users.email, email))
  } catch (error) {
    console.error('Failed to get user from database')
    throw error
  }
}

export async function createUser(
  email: string,
  password: string,
): Promise<User[]> {
  try {
    const { generateHashedPassword } = await import('./utils')
    const hashedPassword = generateHashedPassword(password)
    return await db
      .insert(users)
      .values({ email, password: hashedPassword })
      .returning()
  } catch (error) {
    console.error('Failed to create user in database')
    throw error
  }
}

export async function createGuestUser(): Promise<User[]> {
  try {
    const { generateUUID } = await import('../utils')
    const guestId = generateUUID()
    const guestEmail = `guest-${guestId}@example.com`
    return await db
      .insert(users)
      .values({ email: guestEmail, password: null })
      .returning()
  } catch (error) {
    console.error('Failed to create guest user in database')
    throw error
  }
}

// ── Chats ───────────────────────────────────────────────────────

export async function createChat({
  userId,
  title,
}: {
  userId: string
  title?: string
}): Promise<Chat> {
  try {
    const [chat] = await db
      .insert(chats)
      .values({ user_id: userId, title: title || 'New Chat' })
      .returning()
    return chat
  } catch (error) {
    console.error('Failed to create chat')
    throw error
  }
}

export async function getChat({
  chatId,
  userId,
}: {
  chatId: string
  userId?: string
}): Promise<Chat | undefined> {
  try {
    const conditions = [eq(chats.id, chatId)]
    if (userId) conditions.push(eq(chats.user_id, userId))

    const [chat] = await db
      .select()
      .from(chats)
      .where(and(...conditions))
    return chat
  } catch (error) {
    console.error('Failed to get chat')
    throw error
  }
}

export async function getChatsByUserId({
  userId,
}: {
  userId: string
}): Promise<Chat[]> {
  try {
    return await db
      .select()
      .from(chats)
      .where(eq(chats.user_id, userId))
      .orderBy(desc(chats.updated_at))
  } catch (error) {
    console.error('Failed to get chats by user')
    throw error
  }
}

export async function deleteChat({
  chatId,
  userId,
}: {
  chatId: string
  userId: string
}): Promise<void> {
  try {
    await db
      .delete(chats)
      .where(and(eq(chats.id, chatId), eq(chats.user_id, userId)))
  } catch (error) {
    console.error('Failed to delete chat')
    throw error
  }
}

export async function updateChatTitle({
  chatId,
  title,
}: {
  chatId: string
  title: string
}): Promise<void> {
  try {
    await db
      .update(chats)
      .set({ title, updated_at: new Date() })
      .where(eq(chats.id, chatId))
  } catch (error) {
    console.error('Failed to update chat title')
    throw error
  }
}

// ── Messages ────────────────────────────────────────────────────

export async function createMessage({
  chatId,
  role,
  content,
}: {
  chatId: string
  role: string
  content: string
}): Promise<Message> {
  try {
    const [msg] = await db
      .insert(messages)
      .values({ chat_id: chatId, role, content })
      .returning()

    // Touch chat updated_at
    await db
      .update(chats)
      .set({ updated_at: new Date() })
      .where(eq(chats.id, chatId))

    return msg
  } catch (error) {
    console.error('Failed to create message')
    throw error
  }
}

export async function getMessagesByChatId({
  chatId,
}: {
  chatId: string
}): Promise<Message[]> {
  try {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.chat_id, chatId))
      .orderBy(messages.created_at)
  } catch (error) {
    console.error('Failed to get messages by chat')
    throw error
  }
}

// ── Rate Limiting ───────────────────────────────────────────────

export async function getChatCountByUserId({
  userId,
  differenceInHours,
}: {
  userId: string
  differenceInHours: number
}): Promise<number> {
  try {
    const hoursAgo = new Date(Date.now() - differenceInHours * 60 * 60 * 1000)

    const [stats] = await db
      .select({ count: count(chats.id) })
      .from(chats)
      .where(
        and(eq(chats.user_id, userId), gte(chats.created_at, hoursAgo)),
      )

    return stats?.count || 0
  } catch (error) {
    console.error('Failed to get chat count by user')
    throw error
  }
}
