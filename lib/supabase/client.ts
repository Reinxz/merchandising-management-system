import { createBrowserClient } from '@supabase/ssr'
import { recordAuditLog } from './audit'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function signOut() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) await recordAuditLog({ userId: user.id, action: 'logout', module: 'auth', description: 'User signed out' })
  return supabase.auth.signOut()
}

export async function signIn(email: string, password: string) {
  const result = await createClient().auth.signInWithPassword({ email, password })
  if (result.data.user) await recordAuditLog({ userId: result.data.user.id, action: 'login', module: 'auth', description: 'User signed in' })
  return result
}

export async function signUp(email: string, password: string, fullName: string) {
  return createClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
    },
  })
}

export async function getProfile(userId: string) {
  return createClient().from('profiles').select('full_name, role').eq('id', userId).single()
}
