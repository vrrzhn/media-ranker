'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const [username, setUsername] = useState<string | null>(null)
  const router = useRouter()

  const fetchProfile = async (user: any) => {
    // 1. Check metadata set during signup
    if (user?.user_metadata?.username) {
      setUsername(user.user_metadata.username)
    }

    // 2. Fetch from DB profile table
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    if (data?.username) {
      setUsername(data.username)
    }
  }

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        fetchProfile(user)
      } else {
        setUsername(null)
      }
    }
    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        fetchProfile(session.user)
      } else {
        setUsername(null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUsername(null)
    router.push('/login')
  }

  return (
    <nav className="w-full bg-zinc-900 border-b border-zinc-800 py-4 px-8 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold text-white hover:text-blue-400 transition">
        MediaRanker
      </Link>

      <div className="flex items-center gap-4">
        {username ? (
          <>
            <span className="text-sm font-medium text-gray-200">{username}</span>
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