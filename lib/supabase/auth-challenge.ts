import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const loginChallengeCookie = 'scims_login_challenge'
export const loginChallengeLifetimeSeconds = 10 * 60

export function createLoginChallengeToken() {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    hash: createHash('sha256').update(token).digest('hex'),
  }
}

export function getLoginChallengeHash(request: NextRequest) {
  const token = request.cookies.get(loginChallengeCookie)?.value
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null
  }

  return createHash('sha256').update(token).digest('hex')
}

export function getAuthSessionClaims(accessToken: string) {
  const payload = accessToken.split('.')[1]
  if (!payload) return null

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (claims === null || typeof claims !== 'object') return null
    const sessionId = (claims as Record<string, unknown>).session_id
    const userId = (claims as Record<string, unknown>).sub
    if (
      typeof sessionId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) ||
      typeof userId !== 'string'
    ) {
      return null
    }
    return { sessionId, userId }
  } catch {
    return null
  }
}

export function isSameOriginRequest(request: NextRequest) {
  return request.headers.get('origin') === new URL(request.url).origin
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return null
    }
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

export function setLoginChallengeCookie(
  response: NextResponse,
  token: string,
) {
  response.cookies.set(loginChallengeCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: loginChallengeLifetimeSeconds,
  })
}

export function clearLoginChallengeCookie(response: NextResponse) {
  response.cookies.set(loginChallengeCookie, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 0,
  })
}

export async function recordSecurityEvent(
  event: string,
  userId: string | null = null,
) {
  const { createAuthAdminClient } = await import('./auth-admin')
  const { error } = await createAuthAdminClient()
    .from('auth_security_events')
    .insert({ event, user_id: userId })

  if (error) {
    throw new Error(`Could not write authentication security event: ${error.message}`)
  }
}

export async function recordAuthAudit(
  userId: string,
  action: 'login' | 'login_attempt' | 'logout' | 'otp_failed',
  description: string,
) {
  const { createAuthAdminClient } = await import('./auth-admin')
  const { error } = await createAuthAdminClient()
    .from('audit_logs')
    .insert({
      user_id: userId,
      action,
      module: 'auth',
      description,
    })

  if (error) {
    throw new Error(`Could not write authentication audit log: ${error.message}`)
  }
}
