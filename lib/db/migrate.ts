import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { config } from 'dotenv'
config()

const runMigrate = async () => {
  if (!process.env.POSTGRES_URL) {
    console.log('POSTGRES_URL is not defined, skipping migrations')
    process.exit(0)
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 })
  const db = drizzle(connection)

  console.log('⏳ Running migrations...')

  // Drop old v0-specific tables if they exist
  await connection`DROP TABLE IF EXISTS anonymous_chat_logs CASCADE`
  await connection`DROP TABLE IF EXISTS chat_ownerships CASCADE`

  // Ensure new tables exist
  await connection`
    CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `

  await connection`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role VARCHAR(16) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `

  await connection`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)`
  await connection`CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)`

  console.log('✅ Migrations completed')
  process.exit(0)
}

runMigrate().catch((err) => {
  console.error('❌ Migration failed')
  console.error(err)
  process.exit(1)
})
