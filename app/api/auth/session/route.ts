import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user || userError) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const { data: verified, error: verificationError } = await supabase.rpc(
    'touch_verified_auth_session',
  )
  if (verificationError || verified !== true) {
    return NextResponse.json({ authenticated: false }, { status: 403 })
  }

  return NextResponse.json({ authenticated: true }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
