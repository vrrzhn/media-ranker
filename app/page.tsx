'use client'

import { useEffect, useState, useRef, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { complexSearch, MediaItem } from '@/app/lib/complexSearch'

// --- TYPES ---
interface TMDBMedia {
  id: number
  tmdb_id?: number
  show_id?: number | string
  parent_tmdb_id?: number | string
  tv_id?: number | string
  show_tmdb_id?: number | string
  season_number?: number
  episode_number?: number
  season?: number
  episode?: number
  title?: string
  name?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string | number
  first_air_date?: string | number
  air_date?: string | number
  year?: string | number
  created_at?: string | number
  date?: string | number
  vote_average?: number
  user_rating?: number
  media_type?: 'movie' | 'tv' | 'episode'
  type?: 'movie' | 'tv' | 'episode'
}

interface UserTopTenItem {
  id: string | number
  tmdb_id: number
  show_id?: number | string
  parent_tmdb_id?: number | string
  tv_id?: number | string
  show_tmdb_id?: number | string
  season_number?: number
  episode_number?: number
  season?: number
  episode?: number
  title: string
  type: 'movie' | 'tv' | 'episode'
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string | number
  first_air_date?: string | number
  air_date?: string | number
  year?: string | number
  created_at?: string | number
  date?: string | number
  user_rating: number
}

interface MediaCardProps {
  movie: TMDBMedia
}

// --- HELPER FUNCTION TO EXTRACT RELEASE YEAR ---
function getReleaseYear(item: TMDBMedia | UserTopTenItem | Record<string, any>): string | null {
  if (!item) return null
  const dateVal = item.release_date || item.air_date || item.first_air_date || item.year || item.date
  if (!dateVal) return null
  
  const str = String(dateVal)
  const match = str.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : str.split('-')[0] || null
}

// --- STANDALONE MEDIA CARD COMPONENT ---
function MediaCard({ movie }: MediaCardProps) {
  const isTv = movie.media_type === 'tv' || movie.type === 'tv'
  const isEpisode = movie.media_type === 'episode' || movie.type === 'episode'
  
  let targetRoute = 'movie'
  if (isTv) targetRoute = 'tv'
  if (isEpisode) targetRoute = 'episode'

  const title = movie.title || movie.name || 'Untitled'
  const releaseYear = getReleaseYear(movie)
  
  const userRatingFormatted = movie.user_rating !== undefined && movie.user_rating !== null
    ? Number(movie.user_rating).toFixed(1)
    : null

  const voteAvgFormatted = typeof movie.vote_average === 'number'
    ? movie.vote_average.toFixed(1)
    : 'N/A'

  const rating = userRatingFormatted || voteAvgFormatted

  const posterUrl = movie.poster_path
    ? movie.poster_path.startsWith('http')
      ? movie.poster_path
      : `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null

  return (
    <Link
      href={`/${targetRoute}/${movie.tmdb_id || movie.id}`}
      className="flex-none w-36 sm:w-44 group transition-transform duration-300 hover:scale-105 focus:outline-none focus:scale-105"
    >
      <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-xl mb-2">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
            No Poster
          </div>
        )}

        <div className={`absolute top-2.5 left-2.5 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
          isEpisode ? 'bg-emerald-600/90' : isTv ? 'bg-sky-600/90' : 'bg-purple-600/90'
        }`}>
          {isEpisode ? 'EPISODE' : isTv ? 'TV' : 'MOVIE'}
        </div>

        <div className="absolute top-2.5 right-2.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[11px] font-bold text-amber-300">
          ⭐ {rating}
        </div>
      </div>
      <p className="font-semibold text-sm truncate text-white group-hover:text-amber-300 transition-colors">
        {title}
      </p>
      <p className="text-xs text-zinc-500">
        {releaseYear || 'N/A'}
      </p>
    </Link>
  )
}

// --- MAIN HOMEPAGE COMPONENT ---
export default function HomePage() {
  const router = useRouter()
  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY

  // Category switcher state
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'tv' | 'episodes'>('all')
  const [includeEpisodesInAll, setIncludeEpisodesInAll] = useState(false)

  // Top 10 active hover/focus state
  const [hoveredTopTenIndex, setHoveredTopTenIndex] = useState<number>(0)

  // Categories & movie/tv lists
  const [popularMovies, setPopularMovies] = useState<TMDBMedia[]>([])
  const [popularTv, setPopularTv] = useState<TMDBMedia[]>([])
  const [nowPlayingMovies, setNowPlayingMovies] = useState<TMDBMedia[]>([])
  const [topRatedMovies, setTopRatedMovies] = useState<TMDBMedia[]>([])
  const [topRatedTv, setTopRatedTv] = useState<TMDBMedia[]>([])
  const [userTopTen, setUserTopTen] = useState<UserTopTenItem[]>([])

  const [loading, setLoading] = useState(true)

  // Search bar & live dropdown state
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<MediaItem[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSearchingDropdown, setIsSearchingDropdown] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all home data with graceful fallbacks
  useEffect(() => {
    let isMounted = true

    const fetchAllData = async () => {
      setLoading(true)
      try {
        if (!TMDB_API_KEY) {
          console.warn('NEXT_PUBLIC_TMDB_API_KEY is missing from environment variables.')
        }

        const safeFetch = async (url: string) => {
          try {
            const res = await fetch(url)
            if (!res.ok) return []
            const data = await res.json()
            return data.results || []
          } catch (e) {
            console.error(`Failed fetching from ${url}:`, e)
            return []
          }
        }

        const [popData, tvData, nowData, topData, topTvData] = await Promise.all([
          safeFetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`),
          safeFetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}`),
          safeFetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}`),
          safeFetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}`),
          safeFetch(`https://api.themoviedb.org/3/tv/top_rated?api_key=${TMDB_API_KEY}`)
        ])

        if (!isMounted) return

        setPopularMovies(popData)
        setPopularTv(tvData)
        setNowPlayingMovies(nowData)
        setTopRatedMovies(topData)
        setTopRatedTv(topTvData)

        // Fetch User's Top Rated Media
        const { data: { user } } = await supabase.auth.getUser()

        if (user && isMounted) {
          const { data: topTen } = await supabase
            .from('media')
            .select('*')
            .eq('user_id', user.id)
            .not('user_rating', 'is', null)
            .order('user_rating', { ascending: false })
            .limit(50)

          if (topTen && topTen.length > 0) {
            const enrichedTopTen: UserTopTenItem[] = await Promise.all(
              topTen.map(async (item) => {
                let rawDate = item.release_date || item.air_date || item.first_air_date || item.year || item.date

                if (item.type === 'episode') {
                  let episodeAirDate = rawDate

                  const showId = item.show_id
                  const seasonNum = item.season_number
                  const epNum = item.episode_number

                  if (!episodeAirDate && TMDB_API_KEY && showId && seasonNum !== undefined && epNum !== undefined) {
                    try {
                      const res = await fetch(
                        `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNum}/episode/${epNum}?api_key=${TMDB_API_KEY}`
                      )
                      if (res.ok) {
                        const epData = await res.json()
                        episodeAirDate = epData.air_date || episodeAirDate
                      }
                    } catch (e) {
                      console.error('Failed fetching episode air_date from TMDB:', e)
                    }
                  }

                  // Fallback: If still missing, query the parent show for its release date
                  if (!episodeAirDate && TMDB_API_KEY && showId) {
                    try {
                      const res = await fetch(
                        `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}`
                      )
                      if (res.ok) {
                        const tvData = await res.json()
                        episodeAirDate = tvData.first_air_date || episodeAirDate
                      }
                    } catch (e) {
                      console.error('Failed fetching show air_date for episode:', e)
                    }
                  }

                  return {
                    ...item,
                    type: 'episode',
                    backdrop_path: item.poster_path || item.backdrop_path,
                    release_date: episodeAirDate,
                    air_date: episodeAirDate,
                    first_air_date: episodeAirDate,
                    year: episodeAirDate
                  }
                }

                try {
                  const mediaType = item.type === 'tv' ? 'tv' : 'movie'
                  const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${item.tmdb_id}?api_key=${TMDB_API_KEY}`)
                  if (!res.ok) return { ...item, release_date: rawDate }
                  const tmdbData = await res.json()
                  return {
                    ...item,
                    backdrop_path: tmdbData.backdrop_path || item.poster_path,
                    release_date: tmdbData.release_date || tmdbData.first_air_date || rawDate,
                    first_air_date: tmdbData.first_air_date || rawDate
                  }
                } catch {
                  return { ...item, release_date: rawDate }
                }
              })
            )

            if (isMounted) setUserTopTen(enrichedTopTen)
          }
        }
      } catch (err) {
        console.error('Error fetching home categories:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchAllData()

    return () => {
      isMounted = false
    }
  }, [TMDB_API_KEY])

  // Complex Search live dropdown previews
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([])
      setIsDropdownOpen(false)
      return
    }

    const controller = new AbortController()

    const timer = setTimeout(async () => {
      setIsSearchingDropdown(true)
      try {
        const results = await complexSearch(searchQuery)
        if (!controller.signal.aborted) {
          setSuggestions(results.slice(0, 6))
          setIsDropdownOpen(true)
        }
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Dropdown search error:', err)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingDropdown(false)
        }
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
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

  // Redirect search submissions
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsDropdownOpen(false)
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  // Filter user top 10 list based on media type & settings
  const filteredUserTopTen = userTopTen.filter((item) => {
    if (activeTab === 'movies') return item.type === 'movie'
    if (activeTab === 'tv') return item.type === 'tv'
    if (activeTab === 'episodes') return item.type === 'episode'
    if (activeTab === 'all') {
      if (!includeEpisodesInAll && item.type === 'episode') return false
      return true
    }
    return true
  })

  // Limit carousel to exact Top 10
  const topTenList = filteredUserTopTen.slice(0, 10)

  // Safely grab the currently focused item for the hero backdrop
  const activeTopTenItem = topTenList[hoveredTopTenIndex] || topTenList[0]
  const activeBackdrop = activeTopTenItem?.backdrop_path
    ? activeTopTenItem.backdrop_path.startsWith('http')
      ? activeTopTenItem.backdrop_path
      : `https://image.tmdb.org/t/p/w1280${activeTopTenItem.backdrop_path}`
    : null

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      {/* TOP NAVIGATION HEADER & SEARCH BAR */}
      <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-transparent px-6 py-5 flex flex-col items-center gap-5 shadow-2xl">
        <Link
          href="/"
          onClick={() => setSearchQuery('')}
          className="group flex items-center gap-3 transition transform hover:scale-105 focus:outline-none"
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

        {/* SEARCH BAR */}
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
                aria-label="Clear search input"
                onClick={() => {
                  setSearchQuery('')
                  setIsDropdownOpen(false)
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white p-1"
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
                    const year = getReleaseYear(m) || 'N/A'

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
                            loading="lazy"
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
                            {year} • ⭐ {typeof m.vote_average === 'number' ? m.vote_average.toFixed(1) : 'N/A'}
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

        {/* CATEGORY SWITCHER */}
        <div className="flex items-center bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800/80 shadow-lg">
          <button
            onClick={() => {
              setActiveTab('all')
              setHoveredTopTenIndex(0)
            }}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition duration-200 ${
              activeTab === 'all'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setActiveTab('movies')
              setHoveredTopTenIndex(0)
            }}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition duration-200 ${
              activeTab === 'movies'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Movies
          </button>
          <button
            onClick={() => {
              setActiveTab('tv')
              setHoveredTopTenIndex(0)
            }}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition duration-200 ${
              activeTab === 'tv'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            TV Shows
          </button>
          <button
            onClick={() => {
              setActiveTab('episodes')
              setHoveredTopTenIndex(0)
            }}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition duration-200 ${
              activeTab === 'episodes'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Episodes
          </button>
        </div>
      </header>

      {/* LOADING STATE UI */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="w-10 h-10 border-4 border-amber-300 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-zinc-400">Loading catalog...</p>
        </div>
      ) : (
        <>
          {/* TOP 10 HERO BANNER */}
          {userTopTen.length > 0 && (
            <div className="relative w-full min-h-[520px] py-10 overflow-hidden flex flex-col justify-between">
              {activeBackdrop && (
                <div className="absolute inset-0 z-0 pointer-events-none">
                  <img
                    src={activeBackdrop}
                    alt={activeTopTenItem?.title || 'Backdrop'}
                    className="w-full h-full object-cover opacity-80 scale-105 transition-all duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black via-black/40 to-black" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
                </div>
              )}

              <div className="max-w-7xl mx-auto w-full px-6 relative z-10 flex flex-col justify-between gap-8 h-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 min-h-[160px]">
                  <div className="flex flex-col">
                    <span className="text-xs font-black tracking-widest text-amber-400 uppercase">
                      PERSONAL COLLECTION
                    </span>
                    <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight drop-shadow-xl uppercase">
                      YOUR TOP 10 {activeTab !== 'all' ? activeTab : ''}
                    </h2>
                  </div>

                  {activeTopTenItem && (
                    <div className="flex flex-col items-start sm:items-end text-left sm:text-right gap-2 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-400 text-black px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider shadow-md">
                          #{ (hoveredTopTenIndex < topTenList.length ? hoveredTopTenIndex : 0) + 1 } IN RANKING
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
                          activeTopTenItem.type === 'episode'
                            ? 'bg-emerald-600/90'
                            : activeTopTenItem.type === 'tv'
                            ? 'bg-sky-600/90'
                            : 'bg-purple-600/90'
                        }`}>
                          {activeTopTenItem.type === 'episode' ? 'EPISODE' : activeTopTenItem.type === 'tv' ? 'TV SHOW' : 'MOVIE'}
                        </span>
                      </div>

                      <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md line-clamp-1">
                        {activeTopTenItem.title}
                      </h3>

                      <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-zinc-300 mt-1">
                        <span className="text-amber-300 font-bold bg-black/60 px-3 py-1 rounded-xl border border-amber-300/40 backdrop-blur-md">
                          ⭐ Your Rating: {Number(activeTopTenItem.user_rating).toFixed(1)} / 10
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* BAR ABOVE SCROLL WHEEL WITH TOGGLE */}
                <div className="flex items-center justify-between gap-4 mt-2">
                  <span className="text-xs text-zinc-400 font-semibold tracking-wider uppercase">
                    {topTenList.length} {topTenList.length === 1 ? 'Title' : 'Titles'}
                  </span>

                  {activeTab === 'all' && (
                    <label className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 border border-zinc-700/80 cursor-pointer text-xs font-semibold text-zinc-300 hover:text-white transition select-none backdrop-blur-md shadow-xl">
                      <input
                        type="checkbox"
                        checked={includeEpisodesInAll}
                        onChange={(e) => {
                          setIncludeEpisodesInAll(e.target.checked)
                          setHoveredTopTenIndex(0)
                        }}
                        className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-black accent-emerald-500 cursor-pointer"
                      />
                      <span>Include Episodes</span>
                    </label>
                  )}
                </div>

                {/* INTERACTIVE NUMBERED CAROUSEL */}
                {topTenList.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto pt-3 pb-4 scrollbar-thin scrollbar-thumb-zinc-800 items-start">
                    {topTenList.map((media, index) => {
                      const isFirst = index === 0
                      const isHovered = index === hoveredTopTenIndex
                      const isTv = media.type === 'tv'
                      const isEpisode = media.type === 'episode'
                      const targetRoute = isEpisode ? 'episode' : isTv ? 'tv' : 'movie'
                      
                      const releaseYear = getReleaseYear(media)

                      const posterUrl = media.poster_path
                        ? media.poster_path.startsWith('http')
                          ? media.poster_path
                          : `https://image.tmdb.org/t/p/w342${media.poster_path}`
                        : null

                      return (
                        <Link
                          key={media.id}
                          href={`/${targetRoute}/${media.tmdb_id || media.id}`}
                          onMouseEnter={() => setHoveredTopTenIndex(index)}
                          onFocus={() => setHoveredTopTenIndex(index)}
                          className="flex-none flex items-center gap-2 group/card cursor-pointer focus:outline-none"
                        >
                          <span className={`text-6xl sm:text-7xl font-black tracking-tighter select-none leading-none transition-transform duration-300 group-hover/card:scale-110 ${
                            isFirst
                              ? 'text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-rose-400 to-purple-500 drop-shadow-[0_4px_12px_rgba(251,191,36,0.4)]'
                              : 'text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-700'
                          }`}>
                            {index + 1}
                          </span>

                          <div className="w-36 sm:w-44 flex flex-col">
                            <div className={`relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-xl mb-2 transition-all duration-300 ${
                              isHovered ? 'ring-2 ring-amber-300 shadow-xl shadow-amber-400/20 scale-105 opacity-100' : 'opacity-85 hover:opacity-100'
                            }`}>
                              {posterUrl ? (
                                <img
                                  src={posterUrl}
                                  alt={media.title}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                                  No Poster
                                </div>
                              )}
                              <div className={`absolute top-2.5 left-2.5 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
                                isEpisode ? 'bg-emerald-600/90' : isTv ? 'bg-sky-600/90' : 'bg-purple-600/90'
                              }`}>
                                {isEpisode ? 'EPISODE' : isTv ? 'TV' : 'MOVIE'}
                              </div>
                              <div className="absolute top-2.5 right-2.5 bg-black/90 border border-amber-300/80 px-2 py-0.5 rounded-md text-[11px] font-black text-amber-300 shadow-lg backdrop-blur-md">
                                ⭐ {Number(media.user_rating).toFixed(1)}
                              </div>
                            </div>

                            <p className="font-semibold text-sm truncate text-white group-hover/card:text-amber-300 transition-colors">
                              {media.title}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {releaseYear || 'N/A'}
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-zinc-400 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 backdrop-blur-md">
                    No {activeTab !== 'all' ? activeTab : 'movies or TV shows'} in your top rankings yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CATEGORIZED HORIZONTAL ROWS */}
          <div className="max-w-7xl mx-auto px-6 mt-6 flex flex-col gap-12">
            {(activeTab === 'all' || activeTab === 'movies') && popularMovies.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  Trending Movies
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {popularMovies.map((movie) => (
                    <MediaCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'tv') && popularTv.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  Popular TV Shows
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {popularTv.map((show) => (
                    <MediaCard key={show.id} movie={{ ...show, media_type: 'tv' }} />
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'movies') && nowPlayingMovies.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  Now Playing Movies
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {nowPlayingMovies.map((movie) => (
                    <MediaCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'all' || activeTab === 'movies') && topRatedMovies.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  Top Rated Movies
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {topRatedMovies.map((movie) => (
                    <MediaCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tv' && topRatedTv.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  Top Rated TV Shows
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {topRatedTv.map((show) => (
                    <MediaCard key={show.id} movie={{ ...show, media_type: 'tv' }} />
                  ))}
                </div>
              </div>
            )}

            {/* FALLBACK MESSAGE WHEN TAB HAS NO ITEMS */}
            {activeTab === 'episodes' && userTopTen.length === 0 && (
              <div className="py-20 text-center text-zinc-500">
                No episodes found in your ratings or recommendations.
              </div>
            )}
          </div>
        </>
      )}
    </main>
  )
}