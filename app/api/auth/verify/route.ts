import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  clearLoginChallengeCookie,
  getAuthSessionClaims,
  getLoginChallengeHash,
  isSameOriginRequest,
  readJsonObject,
  recordAuthAudit,
  recordSecurityEvent,
} from '@/lib/supabase/auth-challenge'
import { createAuthAdminClient, isAuthAdminConfigured } from '@/lib/supabase/auth-admin'

export async function POST(request: NextRequest) {
  if (!isAuthAdminConfigured()) {
    return NextResponse.json({ error: 'Server authentication is not configured.' }, { status: 503 })
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const body = await readJsonObject(request)
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 })
  }

  const challengeHash = getLoginChallengeHash(request)
  if (!challengeHash) {
    return NextResponse.json({ error: 'The verification request expired. Please sign in again.' }, { status: 401 })
  }

  const admin = createAuthAdminClient()
  const { data: challengeRows, error: challengeError } = await admin.rpc(
    'take_auth_login_challenge',
    { p_challenge_hash: challengeHash },
  )
  if (challengeError) {
    return NextResponse.json({ error: 'Unable to verify the code right now.' }, { status: 503 })
  }

  const challenge = challengeRows?.[0]
  if (!challenge?.user_id || !challenge.email || !challenge.password_session_id) {
    await recordSecurityEvent('otp_attempt_limited')
    return NextResponse.json({ error: 'The code is invalid, expired, or has too many attempts.' }, { status: 429 })
  }

  let authResponse = NextResponse.json({ ok: true })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            authResponse.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    email: challenge.email,
    token,
    type: 'email',
  })

  if (verifyError || !verified.user || !verified.session) {
    const expired =
      verifyError?.code?.toLowerCase().includes('expired') === true ||
      verifyError?.message.toLowerCase().includes('expired') === true
    await recordSecurityEvent(expired ? 'otp_expired' : 'otp_failed', challenge.user_id)
    await recordAuthAudit(
      challenge.user_id,
      'otp_failed',
      expired ? 'Email verification code expired' : 'Email verification code rejected',
    )
    return NextResponse.json({
      error: expired
        ? 'That code expired. Sign in again to receive a new code.'
        : 'The verification code is invalid or has expired.',
    }, { status: 400 })
  }

  const sessionClaims = getAuthSessionClaims(verified.session.access_token)
  if (
    verified.user.id !== challenge.user_id ||
    !sessionClaims ||
    sessionClaims.userId !== challenge.user_id
  ) {
    await recordSecurityEvent('otp_identity_mismatch', challenge.user_id)
    return NextResponse.json({ error: 'Unable to verify this sign-in.' }, { status: 401 })
  }

  const { data: completed, error: completeError } = await admin.rpc(
    'complete_auth_login_challenge',
    {
      p_challenge_hash: challengeHash,
      p_user_id: challenge.user_id,
      p_password_session_id: challenge.password_session_id,
      p_session_id: sessionClaims.sessionId,
    },
  )
  if (completeError || completed !== true) {
    await recordSecurityEvent('otp_challenge_completion_failed', challenge.user_id)
    return NextResponse.json({ error: 'Unable to complete sign-in. Please start again.' }, { status: 503 })
  }

  await recordAuthAudit(
    challenge.user_id,
    'login',
    'User completed password and email verification',
  )
  await recordSecurityEvent('login_completed', challenge.user_id)
  clearLoginChallengeCookie(authResponse)
  return authResponse
}
