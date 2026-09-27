import { NextResponse, type NextRequest } from 'next/server'
import {
  getLoginChallengeHash,
  isSameOriginRequest,
  recordSecurityEvent,
} from '@/lib/supabase/auth-challenge'
import {
  createAuthAdminClient,
  createUnauthenticatedAuthClient,
  isAuthAdminConfigured,
} from '@/lib/supabase/auth-admin'

export async function POST(request: NextRequest) {
  if (!isAuthAdminConfigured()) {
    return NextResponse.json({ error: 'Server authentication is not configured.' }, { status: 503 })
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const challengeHash = getLoginChallengeHash(request)
  if (!challengeHash) {
    return NextResponse.json({ error: 'Start sign-in again to request a code.' }, { status: 401 })
  }

  const admin = createAuthAdminClient()
  const { data, error } = await admin.rpc('take_auth_login_resend', {
    p_challenge_hash: challengeHash,
  })
  if (error) {
    return NextResponse.json({ error: 'Unable to request a new code.' }, { status: 503 })
  }

  const challenge = data?.[0]
  if (!challenge?.email || !challenge?.user_id) {
    await recordSecurityEvent('otp_resend_limited')
    return NextResponse.json({ error: 'The verification request expired. Please sign in again.' }, { status: 429 })
  }

  const auth = createUnauthenticatedAuthClient()
  const { error: otpError } = await auth.auth.signInWithOtp({
    email: challenge.email,
    options: { shouldCreateUser: false },
  })
  if (otpError) {
    await recordSecurityEvent('otp_resend_failed', challenge.user_id)
    return NextResponse.json({ error: 'Unable to resend the code. Please try again later.' }, { status: 429 })
  }

  await recordSecurityEvent('otp_resent', challenge.user_id)
  return NextResponse.json({ ok: true })
}
