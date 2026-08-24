'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (isSignUp) {
      if (username.length < 2 || username.length > 16) {
        setErrorMsg('Username must be between 2 and 16 characters.')
        return
      }

      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.')
        return
      }

      // Pass username in user options metadata
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      })

      if (authError) {
        setErrorMsg(authError.message)
        return
      }

      alert('Account created! Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMsg(error.message)
      } else {
        router.push('/')
      }
    }
  }

  return (
    <main className="max-w-md mx-auto mt-12 p-6 border border-zinc-800 rounded-xl bg-zinc-900 text-white">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {isSignUp ? 'Create Account' : 'Welcome Back'}
      </h1>

      {errorMsg && <p className="text-red-500 text-sm mb-4 text-center">{errorMsg}</p>}

      <form onSubmit={handleAuth} className="flex flex-col gap-4">
        {isSignUp && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Username (2-16 chars)</label>
            <input
              type="text"
              placeholder="Username"
              value={username}
              minLength={2}
              maxLength={16}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full p-3 rounded bg-zinc-800 text-white border border-zinc-700"
            />
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Email</label>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 rounded bg-zinc-800 text-white border border-zinc-700"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Password</label>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 rounded bg-zinc-800 text-white border border-zinc-700"
          />
        </div>

        {isSignUp && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full p-3 rounded bg-zinc-800 text-white border border-zinc-700"
            />
          </div>
        )}

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 p-3 rounded font-bold transition mt-2"
        >
          {isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      <button
        onClick={() => {
          setIsSignUp(!isSignUp)
          setErrorMsg('')
        }}
        className="mt-4 text-xs text-gray-400 hover:underline w-full text-center"
      >
        {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
      </button>
    </main>
  )
}