'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Check initial user status
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    // Listen for auth state changes (login, logout, signup)
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  return (
    <nav className="w-full bg-zinc-900 border-b border-zinc-800 py-4 px-8 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold text-white hover:text-blue-400 transition">
        MediaRanker
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-sm text-gray-400 hidden sm:inline">{user.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded font-semibold transition"
            >
              Log Out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded font-semibold transition"
          >
            Log In / Sign Up
          </Link>
        )}
      </div>
    </nav>
  )
}