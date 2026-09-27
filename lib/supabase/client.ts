import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function signOut() {
  const response = await fetch('/api/auth/logout', { method: 'POST' })
  if (!response.ok) {
    throw new Error('Could not securely end the session.')
  }

  const { error } = await createClient().auth.signOut({ scope: 'local' })
  if (error) {
    throw new Error('The server session ended, but the browser session could not be cleared.')
  }
  return response.json()
}

export async function signIn(email: string, password: string) {
  return postAuthRequest<{ email: string }>('/api/auth/password', { email, password })
}

export async function resendLoginOtp() {
  return postAuthRequest<{ ok: true }>('/api/auth/resend', {})
}

export async function verifyLoginOtp(token: string) {
  return postAuthRequest<{ ok: true }>('/api/auth/verify', { token })
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
) {
  return createClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}

async function postAuthRequest<T>(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result: unknown = await response.json()
  if (result === null || typeof result !== 'object') {
    return { data: null, error: { message: 'Unexpected authentication response.' } }
  }

  const responseBody = result as Record<string, unknown>
  if (!response.ok) {
    return {
      data: null,
      error: {
        message: typeof responseBody.error === 'string'
          ? responseBody.error
          : 'Authentication could not be completed.',
      },
    }
  }

  return { data: responseBody as T, error: null }
}

export async function getProfile(userId: string) {
  return createClient()
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .single()
}