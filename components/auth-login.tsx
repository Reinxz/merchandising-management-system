"use client"

import Image from 'next/image'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '@/lib/supabase/client'

export function AuthLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage('')
    const result = mode === 'signin' ? await signIn(email.trim(), password) : await signUp(email.trim(), password, fullName.trim())
    setLoading(false)
    if (result.error) {
      const errorText = result.error.message.toLowerCase()
      setMessage(errorText.includes('email not confirmed') ? 'Please confirm your email before signing in.' : errorText.includes('rate limit') ? 'Too many attempts. Please try again later.' : 'Invalid email or password.')
      return
    }
    if (mode === 'signup') {
      setMessage('Check your email to confirm your account.')
      return
    }
    setMessage('Signed in. Loading your workspace...')
    router.refresh()
  }

  return <main className="min-h-screen bg-[#f7f5fb] flex items-center justify-center p-6">
    <section className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-violet-100">
      <div className="flex flex-col items-center text-center gap-4 mb-8">
        <Image src="/images/tri-m-logo.png" alt="TRI-M Global Logistics and Trading Inc." width={108} height={108} className="object-contain" />
        <div><h1 className="text-2xl font-bold text-violet-950">Merchandising Management System</h1><p className="text-sm text-slate-500">Supply Chain &amp; Inventory Management</p></div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'signup' && <label className="text-sm font-medium text-slate-700">Full name<input required value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>}
        <label className="text-sm font-medium text-slate-700">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-medium text-slate-700">Password<input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
        {message && <p role="status" aria-live="polite" className="text-sm text-violet-700">{message}</p>}
        <button type="submit" disabled={loading} aria-busy={loading} className="min-h-12 rounded-xl bg-violet-800 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-900 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Signing you in…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="mt-5 w-full text-sm text-violet-700">{mode === 'signin' ? 'Need an account? Create one' : 'Already registered? Sign in'}</button>
    </section>
  </main>
}
