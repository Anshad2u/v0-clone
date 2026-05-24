import { NextResponse } from 'next/server'

// Ownership is managed server-side through the auth session
export async function POST() {
  return NextResponse.json({ success: true })
}
