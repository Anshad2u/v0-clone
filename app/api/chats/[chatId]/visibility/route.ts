import { NextResponse } from 'next/server'

// Visibility changes are not supported in this version
export async function PATCH() {
  return NextResponse.json(
    { error: 'Chat visibility changes are not available' },
    { status: 400 },
  )
}
