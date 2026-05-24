import { NextResponse } from 'next/server'

// Forking is not supported in this version
export async function POST() {
  return NextResponse.json(
    { error: 'Chat forking is not available' },
    { status: 400 },
  )
}
