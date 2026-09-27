import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isSameOriginRequest,
  recordAuthAudit,
  recordSecurityEvent,
  getAuthSessionClaims,
} from '@/lib/supabase/auth-challenge'
import { createAuthAdminClient, isAuthAdminConfigured } from '@/lib/supabase/auth-admin'

export async function POST(request: NextRequest) {
  if (!isAuthAdminConfigured()) {
    return NextResponse.json({ error: 'Server authentication is not configured.' }, { status: 503 })
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  let response = NextResponse.json({ ok: true })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()
  if (user && session) {
    await recordAuthAudit(user.id, 'logout', 'User signed out')
    const claims = getAuthSessionClaims(session.access_token)
    if (claims?.userId === user.id) {
      const { error } = await createAuthAdminClient()
        .from('verified_auth_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('session_id', claims.sessionId)
      if (error) {
        return NextResponse.json({ error: 'Could not securely end the session.' }, { status: 503 })
      }
    }
    await recordSecurityEvent('logout', user.id)
  }

  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) {
    return NextResponse.json({ error: 'Could not securely end the session.' }, { status: 503 })
  }
  return response
}
