'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { complexSearch, MediaItem } from '@/app/lib/complexSearch'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()

  // Auth State
  const [username, setUsername] = useState<string | null>(null)

  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<MediaItem[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // 1. SUPABASE AUTH & PROFILE LOGIC
  const fetchProfile = async (user: any) => {
    if (user?.user_metadata?.username) {
      setUsername(user.user_metadata.username)
    }

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

  // 2. LIVE COMPLEX SEARCH DROPDOWN LOGIC
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([])
      setIsDropdownOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await complexSearch(searchQuery)
        setSuggestions(results.slice(0, 6))
        setIsDropdownOpen(true)
      } catch (err) {
        console.error('Navbar search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setIsDropdownOpen(false)
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const isHomePage = pathname === '/'

  return (
    <nav className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-b border-zinc-900 px-6 py-3.5 flex items-center justify-between gap-4 shadow-2xl">
      
      {/* BRAND LOGO */}
      <Link href="/" className="group flex items-center gap-2.5 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 via-emerald-400 via-sky-400 to-purple-500 p-[2px] shadow-lg shadow-purple-500/20 group-hover:scale-105 transition duration-300">
          <div className="w-full h-full bg-black rounded-[10px] flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-300 fill-current" viewBox="0 0 24 24">
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H9l2 4H8L6 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
            </svg>
          </div>
        </div>
        <span className="font-black text-xl tracking-tight hidden sm:inline-block">
          <span className="text-amber-300">MEDIA</span>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-amber-300 via-emerald-400 via-sky-400 to-purple-400 ml-1">
            RANKER
          </span>
        </span>
      </Link>

      {/* SEARCH BAR */}
      {!isHomePage && (
        <div className="w-full max-w-md relative" ref={dropdownRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search movies, TV shows, genres (e.g., 'crime')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setIsDropdownOpen(true)}
              className="w-full py-2 pl-9 pr-8 rounded-full bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-xs sm:text-sm focus:outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 transition"
            />
            <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setIsDropdownOpen(false)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </form>

          {/* PREDICTIVE MULTI-MEDIA SEARCH DROPDOWN */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl">
              {isSearching ? (
                <div className="p-3 text-center text-xs text-zinc-400">Searching...</div>
              ) : suggestions.length > 0 ? (
                <div className="divide-y divide-zinc-800/60">
                  {suggestions.map((item) => {
                    const isMovie = item.media_type === 'movie'
                    const title = isMovie ? item.title : item.name
                    const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`
                    const date = item.release_date || item.first_air_date
                    const year = date ? date.split('-')[0] : 'N/A'

                    return (
                      <button
                        key={`${item.media_type}-${item.id}`}
                        onClick={() => {
                          setIsDropdownOpen(false)
                          setSearchQuery('')
                          router.push(link)
                        }}
                        className="w-full p-2.5 flex items-center gap-3 hover:bg-zinc-800/60 transition text-left group"
                      >
                        {item.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                            alt={title || ''}
                            className="w-8 h-12 object-cover rounded shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-12 bg-zinc-800 rounded shrink-0 flex items-center justify-center text-[9px] text-zinc-500">
                            N/A
                          </div>
                        )}
                        <div className="overflow-hidden flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-xs text-white group-hover:text-amber-300 transition truncate">
                              {title}
                            </p>
                            <span className={`text-[9px] font-bold px-1 rounded text-white uppercase ${
                              isMovie ? 'bg-purple-600/80' : 'bg-sky-600/80'
                            }`}>
                              {isMovie ? 'MOVIE' : 'TV'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {year} • ⭐ {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-zinc-500">No results found.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AUTH CONTROLS */}
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        {username ? (
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-semibold text-zinc-200 bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-full">
              👤 {username}
            </span>
            <button
              onClick={handleLogout}
              className="bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 hover:border-rose-600 text-rose-300 hover:text-white text-xs sm:text-sm px-4 py-1.5 rounded-full font-semibold transition duration-200"
            >
              Log Out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="bg-gradient-to-r from-amber-400 via-rose-500 to-purple-500 p-[1px] rounded-full group hover:shadow-lg hover:shadow-rose-500/20 transition"
          >
            <span className="block bg-black group-hover:bg-zinc-900 text-white text-xs sm:text-sm px-4 py-1.5 rounded-full font-bold transition">
              Log In / Sign Up
            </span>
          </Link>
        )}
      </div>

    </nav>
  )
}