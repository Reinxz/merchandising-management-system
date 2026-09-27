"use client"

import Image from 'next/image'
import { FormEvent, useState } from 'react'
import { resendLoginOtp, signIn, signUp, verifyLoginOtp } from '@/lib/supabase/client'

const otpLength = 6

function logSignupError(error: {
  name?: string
  status?: number
  code?: string
  message?: string
}) {
  if (process.env.NODE_ENV !== 'development') return

  const safeMessage = (error.message ?? '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(password|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[redacted]')

  console.error('Supabase sign-up failed', {
    name: error.name,
    status: error.status,
    code: error.code,
    message: safeMessage,
  })
}

export function AuthLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [isOtpStage, setIsOtpStage] = useState(false)
  const [otpDigits, setOtpDigits] = useState<string[]>(Array.from({ length: otpLength }, () => ''))
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function resetOtpState() {
    setOtpDigits(Array.from({ length: otpLength }, () => ''))
    setIsOtpStage(false)
  }

  function setOtpDigit(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '').slice(-1)
    const nextDigits = [...otpDigits]
    nextDigits[index] = cleaned
    setOtpDigits(nextDigits)

    if (cleaned && index < otpLength - 1) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement | null
      nextInput?.focus()
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault()
    if (loading) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setMessage('Please enter your email and password.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const result = await signIn(trimmedEmail, password)
      if (result.error) {
        setMessage(result.error.message)
        return
      }

      setEmail(result.data?.email || trimmedEmail)
      setIsOtpStage(true)
      setOtpDigits(Array.from({ length: otpLength }, () => ''))
      setMessage(`We’ve sent a 6-digit verification code to ${result.data?.email || trimmedEmail}.`)
    } catch {
      setMessage('Unable to sign in right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(event: FormEvent) {
    event.preventDefault()
    if (loading) return

    const code = otpDigits.join('')
    if (code.length !== otpLength) {
      setMessage('Please enter the full 6-digit verification code.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const result = await verifyLoginOtp(code)
      if (result.error) {
        setMessage(result.error.message)
        setOtpDigits(Array.from({ length: otpLength }, () => ''))
        return
      }

      setMessage('Verification successful. Loading your workspace...')
      window.location.assign('/')
    } catch {
      setMessage('Unable to verify the code right now. Please try again.')
      setOtpDigits(Array.from({ length: otpLength }, () => ''))
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    if (loading) return

    setLoading(true)
    setMessage('')
    try {
      const result = await resendLoginOtp()
      if (result.error) {
        setMessage(result.error.message)
        return
      }

      setOtpDigits(Array.from({ length: otpLength }, () => ''))
      setMessage(`A new verification code was sent to ${email.trim()}.`)
    } catch {
      setMessage('Unable to resend the verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignupSubmit(event: FormEvent) {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setMessage('')

    try {
      const result = await signUp(email.trim(), password, fullName.trim())
      if (result.error) {
        logSignupError(result.error)
        const errorText = result.error.message.toLowerCase()
        setMessage(errorText.includes('rate limit') ? 'Too many attempts. Please try again later.' : 'Unable to create your account right now.')
        return
      }

      setMessage('Check your email to confirm your account.')
    } catch (error) {
      if (error instanceof Error) {
        logSignupError({ name: error.name, message: error.message })
      } else {
        logSignupError({ message: 'Unexpected non-Error exception during sign-up.' })
      }
      setMessage('Unable to create your account right now.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="min-h-screen bg-[#f7f5fb] flex items-center justify-center p-6">
    <section className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-violet-100">
      <div className="flex flex-col items-center text-center gap-4 mb-8">
        <Image src="/images/tri-m-logo.png" alt="TRI-M Global Logistics and Trading Inc." width={108} height={108} className="object-contain" />
        <div><h1 className="text-2xl font-bold text-violet-950">Merchandising Management System</h1><p className="text-sm text-slate-500">Supply Chain &amp; Inventory Management</p></div>
      </div>

      {isOtpStage ? (
        <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xl font-semibold text-violet-950">Verify your email</p>
            <p className="mt-2 text-sm text-slate-600">We&apos;ve sent a verification code to:</p>
            <p className="mt-1 font-medium text-violet-900 break-all">{email}</p>
          </div>

          <div className="flex justify-center gap-2 sm:gap-3">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(event) => setOtpDigit(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Backspace' && !digit && index > 0) {
                    const previousInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement | null
                    previousInput?.focus()
                  }
                }}
                className="h-12 w-10 rounded-xl border border-slate-200 bg-slate-50 text-center text-lg font-semibold text-violet-950 shadow-sm outline-none transition focus:border-violet-400 focus:bg-white"
                aria-label={`OTP digit ${index + 1}`}
              />
            ))}
          </div>

          {message && <p role="status" aria-live="polite" className="text-sm text-violet-700 text-center">{message}</p>}

          <button type="submit" disabled={loading} aria-busy={loading} className="min-h-12 rounded-xl bg-violet-800 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-900 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>

          <div className="flex flex-col gap-2 pt-2 text-sm">
            <button type="button" onClick={resendCode} className="text-violet-700 font-medium">Didn&apos;t receive the code? Resend Code</button>
            <button type="button" onClick={() => { resetOtpState(); setMessage(''); setPassword(''); }} className="text-slate-600">Back to Login</button>
          </div>
        </form>
      ) : (
        <form onSubmit={mode === 'signin' ? handlePasswordSubmit : handleSignupSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && <label className="text-sm font-medium text-slate-700">Full name<input required value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>}
          <label className="text-sm font-medium text-slate-700">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
          <label className="text-sm font-medium text-slate-700">Password<div className="relative mt-1">
            <input required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-11" />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-violet-700">{showPassword ? 'Hide' : 'Show'}</button>
          </div></label>
          {message && <p role="status" aria-live="polite" className="text-sm text-violet-700">{message}</p>}
          <button type="submit" disabled={loading} aria-busy={loading} className="min-h-12 rounded-xl bg-violet-800 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-900 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Processing…' : mode === 'signin' ? 'Login' : 'Create account'}</button>
        </form>
      )}

      {!isOtpStage && (
        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); setPassword(''); setFullName(''); }} className="mt-5 w-full text-sm text-violet-700">
          {mode === 'signin' ? 'Need an account? Create one' : 'Already registered? Sign in'}
        </button>
      )}
    </section>
  </main>
}
