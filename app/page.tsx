'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { complexSearch, MediaItem } from '@/app/lib/complexSearch'

export default function HomePage() {
  const router = useRouter()
  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY

  // Categories & movie/tv lists
  const [popularMovies, setPopularMovies] = useState<any[]>([])
  const [popularTv, setPopularTv] = useState<any[]>([])
  const [nowPlayingMovies, setNowPlayingMovies] = useState<any[]>([])
  const [topRatedMovies, setTopRatedMovies] = useState<any[]>([])
  const [userTopTen, setUserTopTen] = useState<any[]>([])

  const [loading, setLoading] = useState(true)

  // Search bar & live dropdown state
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<MediaItem[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSearchingDropdown, setIsSearchingDropdown] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all categories on initial load
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true)
      try {
        const [popRes, tvRes, nowRes, topRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`),
          fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}`),
          fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}`),
          fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}`)
        ])

        const popData = await popRes.json()
        const tvData = await tvRes.json()
        const nowData = await nowRes.json()
        const topData = await topRes.json()

        setPopularMovies(popData.results || [])
        setPopularTv(tvData.results || [])
        setNowPlayingMovies(nowData.results || [])
        setTopRatedMovies(topData.results || [])
      } catch (err) {
        console.error('Error fetching home categories:', err)
      } finally {
        setLoading(false)
      }

      // Fetch User's Top 10 Rated Media
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: topTen } = await supabase
          .from('media')
          .select('*')
          .eq('user_id', user.id)
          .not('user_rating', 'is', null)
          .order('user_rating', { ascending: false })
          .limit(10)

        if (topTen) {
          setUserTopTen(topTen)
        }
      }
    }

    fetchAllData()
  }, [TMDB_API_KEY])

  // Complex Search live dropdown previews
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([])
      setIsDropdownOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingDropdown(true)
      try {
        const results = await complexSearch(searchQuery)
        setSuggestions(results.slice(0, 6))
        setIsDropdownOpen(true)
      } catch (err) {
        console.error('Dropdown search error:', err)
      } finally {
        setIsSearchingDropdown(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Redirect search submissions to unified search page
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsDropdownOpen(false)
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  // Universal Card component for standard poster items (Movies & TV)
  const RenderMediaCard = ({ movie }: { movie: any }) => {
    const isTv = movie.media_type === 'tv' || movie.type === 'tv' || (!movie.release_date && movie.first_air_date)
    const targetRoute = isTv ? 'tv' : 'movie'
    const title = movie.title || movie.name
    const date = movie.release_date || movie.first_air_date

    return (
      <Link
        href={`/${targetRoute}/${movie.tmdb_id || movie.id}`}
        className="flex-none w-36 sm:w-44 group transition-transform duration-300 hover:scale-105"
      >
        <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-xl mb-2">
          {movie.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
              No Poster
            </div>
          )}
          
          <div className={`absolute top-2.5 left-2.5 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
            isTv ? 'bg-sky-600/90' : 'bg-purple-600/90'
          }`}>
            {isTv ? 'TV' : 'MOVIE'}
          </div>

          <div className="absolute top-2.5 right-2.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[11px] font-bold text-amber-300">
            ⭐ {movie.user_rating ? Number(movie.user_rating).toFixed(1) : movie.vote_average ? Number(movie.vote_average).toFixed(1) : 'N/A'}
          </div>
        </div>
        <p className="font-semibold text-sm truncate text-white group-hover:text-amber-300 transition-colors">
          {title}
        </p>
        <p className="text-xs text-zinc-500">
          {date ? date.split('-')[0] : isTv ? 'TV Show' : 'Movie'}
        </p>
      </Link>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      {/* TOP NAVIGATION HEADER & PROMINENT SEARCH BAR */}
      <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-b border-zinc-900 px-6 py-5 flex flex-col items-center gap-5 shadow-2xl">
        {/* CENTER LOGO BRANDING */}
        <Link
          href="/"
          onClick={() => setSearchQuery('')}
          className="group flex items-center gap-3 transition transform hover:scale-105"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 via-emerald-400 via-sky-400 to-purple-500 p-[2px] shadow-lg shadow-purple-500/20">
            <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-300 fill-current" viewBox="0 0 24 24">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H9l2 4H8L6 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
              </svg>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            <span className="text-amber-300">MEDIA</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-amber-300 via-emerald-400 via-sky-400 to-purple-400 ml-1.5">
              RANKER
            </span>
          </h1>
        </Link>

        {/* PROMINENT SEARCH BAR */}
        <div className="w-full max-w-2xl relative" ref={dropdownRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search movies, TV shows, genres (e.g., 'crime')... (Press Enter)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setIsDropdownOpen(true)}
              className="w-full py-3.5 pl-12 pr-10 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm shadow-2xl focus:outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 transition duration-200"
            />
            <svg className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setIsDropdownOpen(false)
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </form>

          {/* LIVE DROPDOWN PREVIEWS */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl">
              {isSearchingDropdown ? (
                <div className="p-3 text-center text-xs text-zinc-400">Searching...</div>
              ) : suggestions.length > 0 ? (
                <div className="divide-y divide-zinc-800/60">
                  {suggestions.map((m) => {
                    const isTv = m.media_type === 'tv'
                    const title = isTv ? m.name : m.title
                    const date = m.release_date || m.first_air_date
                    const year = date ? date.split('-')[0] : 'N/A'

                    return (
                      <button
                        key={`${m.media_type}-${m.id}`}
                        onClick={() => {
                          setIsDropdownOpen(false)
                          router.push(`/${isTv ? 'tv' : 'movie'}/${m.id}`)
                        }}
                        className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800/60 transition text-left group"
                      >
                        {m.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                            alt={title || ''}
                            className="w-9 h-13 object-cover rounded shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-13 bg-zinc-800 rounded shrink-0 flex items-center justify-center text-[9px] text-zinc-500">
                            N/A
                          </div>
                        )}
                        <div className="overflow-hidden flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-xs text-white group-hover:text-amber-300 transition truncate">
                              {title}
                            </p>
                            <span className={`text-[9px] font-bold px-1 rounded text-white uppercase ${
                              isTv ? 'bg-sky-600/80' : 'bg-purple-600/80'
                            }`}>
                              {isTv ? 'TV' : 'MOVIE'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {year} • ⭐ {m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}
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
      </header>

      {/* CATEGORIZED HORIZONTAL ROWS */}
      <div className="max-w-7xl mx-auto px-6 mt-10 flex flex-col gap-12">
        
        {/* 1. YOUR TOP TEN ROW */}
        {userTopTen.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
              🏆 Your Top 10
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800 items-start">
              {userTopTen.map((media, index) => {
                const isFirst = index === 0
                const isTv = media.type === 'tv'
                return (
                  <div key={media.id} className="flex-none flex items-center gap-2 group">
                    <span className={`text-6xl sm:text-7xl font-black tracking-tighter select-none leading-none ${
                      isFirst
                        ? 'text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-rose-400 to-purple-500 drop-shadow-[0_4px_12px_rgba(251,191,36,0.3)]'
                        : 'text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-700'
                    }`}>
                      {index + 1}
                    </span>

                    <Link
                      href={`/${isTv ? 'tv' : 'movie'}/${media.tmdb_id}`}
                      className="w-36 sm:w-44 transition-transform duration-300 group-hover:scale-105"
                    >
                      <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-xl mb-2">
                        {media.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w342${media.poster_path}`}
                            alt={media.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                            No Poster
                          </div>
                        )}
                        <div className={`absolute top-2.5 left-2.5 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
                          isTv ? 'bg-sky-600/90' : 'bg-purple-600/90'
                        }`}>
                          {isTv ? 'TV' : 'MOVIE'}
                        </div>
                        <div className="absolute top-2.5 right-2.5 bg-gradient-to-r from-rose-950/90 via-emerald-950/90 to-purple-950/90 border border-amber-300/80 px-2 py-0.5 rounded-md text-[11px] font-black text-amber-300 shadow-lg">
                          ⭐ {media.user_rating.toFixed(1)}
                        </div>
                      </div>
                      <p className="font-semibold text-sm truncate text-white group-hover:text-amber-300 transition-colors">
                        {media.title}
                      </p>
                      <p className="text-xs text-zinc-500">Your Score</p>
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 2. TRENDING MOVIES */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
            🔥 Trending Movies
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
            {popularMovies.map((movie) => (
              <RenderMediaCard key={movie.id} movie={movie} />
            ))}
          </div>
        </div>

        {/* 3. POPULAR TV SHOWS */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
            📺 Popular TV Shows
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
            {popularTv.map((show) => (
              <RenderMediaCard key={show.id} movie={{ ...show, media_type: 'tv' }} />
            ))}
          </div>
        </div>

        {/* 4. NOW PLAYING MOVIES */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
            🎬 Now Playing Movies
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
            {nowPlayingMovies.map((movie) => (
              <RenderMediaCard key={movie.id} movie={movie} />
            ))}
          </div>
        </div>

        {/* 5. TOP RATED MOVIES */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
            ⭐ Top Rated Movies
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
            {topRatedMovies.map((movie) => (
              <RenderMediaCard key={movie.id} movie={movie} />
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}