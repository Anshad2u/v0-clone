import type { InferSelectModel } from 'drizzle-orm'
import {
  pgTable,
  varchar,
  text,
  timestamp,
  uuid,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export type User = InferSelectModel<typeof users>

// Chat sessions - each chat is a conversation thread
export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 255 }).notNull().default('New Chat'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
})

export type Chat = InferSelectModel<typeof chats>

// Messages within a chat session
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chat_id: uuid('chat_id')
    .notNull()
    .references(() => chats.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export type Message = InferSelectModel<typeof messages>
