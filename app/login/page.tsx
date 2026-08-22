'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setErrorMsg(error.message)
      else alert('Account created! Check your email for confirmation.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErrorMsg(error.message)
      else router.push('/')
    }
  }

  return (
    <main className="max-w-md mx-auto mt-16 p-6 border border-zinc-800 rounded-xl bg-zinc-900 text-white">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {isSignUp ? 'Create Account' : 'Welcome Back'}
      </h1>

      {errorMsg && <p className="text-red-500 text-sm mb-4">{errorMsg}</p>}

      <form onSubmit={handleAuth} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="p-3 rounded bg-zinc-800 text-white border border-zinc-700"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="p-3 rounded bg-zinc-800 text-white border border-zinc-700"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 p-3 rounded font-bold transition"
        >
          {isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        className="mt-4 text-xs text-gray-400 hover:underline w-full text-center"
      >
        {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
      </button>
    </main>
  )
}