'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY

  // Categories & movie lists
  const [popularMovies, setPopularMovies] = useState<any[]>([])
  const [nowPlayingMovies, setNowPlayingMovies] = useState<any[]>([])
  const [topRatedMovies, setTopRatedMovies] = useState<any[]>([])
  const [userTopTen, setUserTopTen] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [activeSearch, setActiveSearch] = useState('')

  // Search bar & live dropdown state
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSearchingDropdown, setIsSearchingDropdown] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all categories on initial load
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true)
      try {
        const [popRes, nowRes, topRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`),
          fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}`),
          fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}`)
        ])

        const popData = await popRes.json()
        const nowData = await nowRes.json()
        const topData = await topRes.json()

        setPopularMovies(popData.results || [])
        setNowPlayingMovies(nowData.results || [])
        setTopRatedMovies(topData.results || [])
      } catch (err) {
        console.error('Error fetching home categories:', err)
      } finally {
        setLoading(false)
      }

      // Fetch User's Top 10 Rated Movies
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: topTen } = await supabase
          .from('media')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'movie')
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

  // Predictive search dropdown logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([])
      setIsDropdownOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingDropdown(true)
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}`
        )
        const data = await res.json()
        setSuggestions((data.results || []).slice(0, 6))
        setIsDropdownOpen(true)
      } catch (err) {
        console.error('Dropdown search error:', err)
      } finally {
        setIsSearchingDropdown(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery, TMDB_API_KEY])

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

  // Execute Multi-Type Search on Submit (Enter Key)
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsDropdownOpen(false)
    const query = searchQuery.trim()
    if (!query) {
      setActiveSearch('')
      return
    }

    setLoading(true)
    setActiveSearch(query)

    try {
      const encodedQuery = encodeURIComponent(query)

      // 1. Fetch official genre list
      const genresRes = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}`)
      const { genres } = await genresRes.json()
      const matchedGenre = genres?.find((g: any) => g.name.toLowerCase() === query.toLowerCase())

      // 2. Query TMDB endpoints simultaneously
      const [movieRes, personRes, collectionRes, genreRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodedQuery}`),
        fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodedQuery}`),
        fetch(`https://api.themoviedb.org/3/search/collection?api_key=${TMDB_API_KEY}&query=${encodedQuery}`),
        matchedGenre
          ? fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${matchedGenre.id}`)
          : Promise.resolve(null)
      ])

      const [movieData, personData, collectionData, genreData] = await Promise.all([
        movieRes.json(),
        personRes.json(),
        collectionRes.json(),
        genreRes ? genreRes.json() : Promise.resolve({ results: [] })
      ])

      // 3. Extract movies from Actor/Director results
      const personMovies = personData.results?.flatMap((person: any) => person.known_for || []) || []

      // 4. Extract movies from Franchise/Collection results
      let collectionMovies: any[] = []
      if (collectionData.results?.length > 0) {
        const colDetailRes = await fetch(
          `https://api.themoviedb.org/3/collection/${collectionData.results[0].id}?api_key=${TMDB_API_KEY}`
        )
        const colDetail = await colDetailRes.json()
        collectionMovies = colDetail.parts || []
      }

      // 5. Combine and remove duplicates by movie ID
      const rawCombined = [
        ...(movieData.results || []),
        ...personMovies,
        ...collectionMovies,
        ...(genreData.results || [])
      ]

      const uniqueMovies = Array.from(
        new Map(
          rawCombined
            .filter((item: any) => item.media_type === 'movie' || item.title)
            .map((m: any) => [m.id, m])
        ).values()
      )

      setSearchResults(uniqueMovies)
    } catch (err) {
      console.error('Multi-search query error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Card component for standard poster items
  const RenderMovieCard = ({ movie }: { movie: any }) => (
    <Link
      href={`/movie/${movie.tmdb_id || movie.id}`}
      className="flex-none w-36 sm:w-44 group transition-transform duration-300 hover:scale-105"
    >
      <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-xl mb-2">
        {movie.poster_path ? (
          <img
            src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
            No Poster
          </div>
        )}
        <div className="absolute top-2.5 right-2.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[11px] font-bold text-amber-300">
          ⭐ {movie.user_rating ? movie.user_rating.toFixed(1) : movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}
        </div>
      </div>
      <p className="font-semibold text-sm truncate text-white group-hover:text-amber-300 transition-colors">
        {movie.title}
      </p>
      <p className="text-xs text-zinc-500">
        {movie.release_date ? movie.release_date.split('-')[0] : 'Movie'}
      </p>
    </Link>
  )

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      
      {/* TOP NAVIGATION HEADER & PROMINENT SEARCH BAR */}
      <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-b border-zinc-900 px-6 py-5 flex flex-col items-center gap-5 shadow-2xl">
        
        {/* CENTER LOGO BRANDING */}
        <Link
          href="/"
          onClick={() => { setSearchQuery(''); setActiveSearch(''); }}
          className="group flex items-center gap-3 transition transform hover:scale-105"
        >
          {/* Rainbow Logo Badge */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 via-emerald-400 via-sky-400 to-purple-500 p-[2px] shadow-lg shadow-purple-500/20">
            <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-300 fill-current" viewBox="0 0 24 24">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H9l2 4H8L6 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
              </svg>
            </div>
          </div>

          {/* Yellow + Rainbow Title */}
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
              placeholder="Search titles, actors, directors, genres, or collections... (Press Enter)"
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
                  setActiveSearch('')
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
                  {suggestions.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setIsDropdownOpen(false)
                        router.push(`/movie/${m.id}`)
                      }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800/60 transition text-left group"
                    >
                      {m.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                          alt={m.title}
                          className="w-9 h-13 object-cover rounded shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-13 bg-zinc-800 rounded shrink-0 flex items-center justify-center text-[9px] text-zinc-500">
                          N/A
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="font-semibold text-xs text-white group-hover:text-amber-300 transition truncate">
                          {m.title}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {m.release_date ? m.release_date.split('-')[0] : 'N/A'} • ⭐ {m.vote_average ? m.vote_average.toFixed(1) : 'N/A'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-zinc-500">No movies found.</div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* FULL SEARCH RESULTS GRID VIEW */}
      {activeSearch ? (
        <section className="max-w-7xl mx-auto px-6 mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              Search Results for "{activeSearch}"
            </h2>
            <button
              onClick={() => {
                setSearchQuery('')
                setActiveSearch('')
              }}
              className="text-xs font-semibold text-amber-300 hover:underline"
            >
              Back to Home
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20 text-zinc-500">Searching...</div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">No movies found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {searchResults.map((movie) => (
                <RenderMovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* CATEGORIZED HORIZONTAL ROWS */
        <div className="max-w-7xl mx-auto px-6 mt-10 flex flex-col gap-12">
          
          {/* 1. YOUR TOP TEN ROW (FIRST) */}
          {userTopTen.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
                🏆 Your Top 10
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800 items-start">
                {userTopTen.map((movie, index) => {
                  const isFirst = index === 0
                  return (
                    <div key={movie.id} className="flex-none flex items-center gap-2 group">
                      
                      {/* Big Rank Number (#1 gets Rainbow/Gold treatment, 2-10 get Metallic Gradient) */}
                      <span className={`text-6xl sm:text-7xl font-black tracking-tighter select-none leading-none ${
                        isFirst
                          ? 'text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-rose-400 to-purple-500 drop-shadow-[0_4px_12px_rgba(251,191,36,0.3)]'
                          : 'text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-700'
                      }`}>
                        {index + 1}
                      </span>

                      {/* Movie Card - Title & details clear and unblocked */}
                      <Link
                        href={`/movie/${movie.tmdb_id}`}
                        className="w-36 sm:w-44 transition-transform duration-300 group-hover:scale-105"
                      >
                        <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-xl mb-2">
                          {movie.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                              alt={movie.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                              No Poster
                            </div>
                          )}
                          <div className="absolute top-2.5 right-2.5 bg-gradient-to-r from-rose-950/90 via-emerald-950/90 to-purple-950/90 border border-amber-300/80 px-2 py-0.5 rounded-md text-[11px] font-black text-amber-300 shadow-lg">
                            ⭐ {movie.user_rating.toFixed(1)}
                          </div>
                        </div>
                        <p className="font-semibold text-sm truncate text-white group-hover:text-amber-300 transition-colors">
                          {movie.title}
                        </p>
                        <p className="text-xs text-zinc-500">Your Score</p>
                      </Link>

                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. TRENDING CURRENTLY */}
          <div>
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
              🔥 Trending Currently
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
              {popularMovies.map((movie) => (
                <RenderMovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </div>

          {/* 3. NOW PLAYING */}
          <div>
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
              🎬 Now Playing
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
              {nowPlayingMovies.map((movie) => (
                <RenderMovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </div>

          {/* 4. TOP RATED ALL-TIME */}
          <div>
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
              ⭐ Top Rated All-Time
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
              {topRatedMovies.map((movie) => (
                <RenderMovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </div>

        </div>
      )}
    </main>
  )
}