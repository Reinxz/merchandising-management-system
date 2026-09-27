import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path.startsWith('/api/auth/') || path === '/auth/callback') {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          items.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user || userError) {
    if (path === '/') return response
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  const { data: verified, error: verificationError } = await supabase.rpc(
    'touch_verified_auth_session',
  )
  if (verificationError || verified !== true) {
    response = path === '/'
      ? NextResponse.next({ request })
      : NextResponse.redirect(new URL('/', request.url))
    await supabase.auth.signOut({ scope: 'local' })
  }

  return response
}
