import { NextResponse, type NextRequest } from 'next/server'
import {
  createLoginChallengeToken,
  getAuthSessionClaims,
  isSameOriginRequest,
  loginChallengeLifetimeSeconds,
  readJsonObject,
  recordAuthAudit,
  recordSecurityEvent,
  setLoginChallengeCookie,
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

  const body = await readJsonObject(request)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || email.length > 320 || !password || password.length > 1024) {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 })
  }

  const auth = createUnauthenticatedAuthClient()
  const { data, error } = await auth.auth.signInWithPassword({ email, password })
  if (error || !data.user?.id || !data.user.email || !data.session) {
    await recordSecurityEvent('password_failed')
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const passwordSession = getAuthSessionClaims(data.session.access_token)
  if (!passwordSession || passwordSession.userId !== data.user.id) {
    await auth.auth.signOut({ scope: 'local' })
    await recordSecurityEvent('password_session_invalid', data.user.id)
    return NextResponse.json({ error: 'Unable to begin secure sign-in.' }, { status: 503 })
  }

  await recordSecurityEvent('password_verified', data.user.id)
  await recordAuthAudit(
    data.user.id,
    'login_attempt',
    'Password verified; email verification is pending',
  )

  const { token, hash } = createLoginChallengeToken()
  const admin = createAuthAdminClient()
  const { error: cleanupError } = await admin
    .from('auth_login_challenges')
    .delete()
    .lt('expires_at', new Date().toISOString())
  if (cleanupError) {
    return NextResponse.json({ error: 'Unable to begin email verification.' }, { status: 503 })
  }

  const { error: challengeError } = await admin
    .from('auth_login_challenges')
    .insert({
      challenge_hash: hash,
      user_id: data.user.id,
      password_session_id: passwordSession.sessionId,
      email: data.user.email,
    })

  if (challengeError) {
    await recordSecurityEvent('challenge_creation_failed', data.user.id)
    return NextResponse.json({ error: 'Unable to begin email verification.' }, { status: 503 })
  }

  const { error: otpError } = await auth.auth.signInWithOtp({
    email: data.user.email,
    options: { shouldCreateUser: false },
  })

  if (otpError) {
    const { error: deleteError } = await admin
      .from('auth_login_challenges')
      .delete()
      .eq('challenge_hash', hash)
    if (deleteError) {
      await recordSecurityEvent('challenge_cleanup_failed', data.user.id)
    }
    await recordSecurityEvent('otp_delivery_failed', data.user.id)
    return NextResponse.json({ error: 'Unable to send the verification code. Please try again.' }, { status: 503 })
  }

  const { error: signOutError } = await auth.auth.signOut({ scope: 'local' })
  if (signOutError) {
    const { error: deleteError } = await admin
      .from('auth_login_challenges')
      .delete()
      .eq('challenge_hash', hash)
    if (deleteError) {
      await recordSecurityEvent('challenge_cleanup_failed', data.user.id)
    }
    await recordSecurityEvent('password_session_cleanup_failed', data.user.id)
    return NextResponse.json({ error: 'Unable to complete sign-in. Please try again.' }, { status: 503 })
  }
  const response = NextResponse.json({
    ok: true,
    email: data.user.email,
    expiresIn: loginChallengeLifetimeSeconds,
  })
  setLoginChallengeCookie(response, token)
  return response
}
