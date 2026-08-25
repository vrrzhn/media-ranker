'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { complexSearch, MediaItem } from '@/app/lib/complexSearch'

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryParam = searchParams.get('q') || ''

  const [input, setInput] = useState(queryParam)
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!queryParam) return

    setInput(queryParam)
    const runSearch = async () => {
      setLoading(true)
      const data = await complexSearch(queryParam)
      setResults(data)
      setLoading(false)
    }

    runSearch()
  }, [queryParam])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    router.push(`/search?q=${encodeURIComponent(input.trim())}`)
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 max-w-6xl mx-auto">
      <form onSubmit={handleFormSubmit} className="mb-8 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search movies, TV shows, genres (e.g., 'crime')..."
          className="flex-1 p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-amber-300 text-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-amber-400 hover:bg-amber-300 font-bold px-8 py-4 rounded-xl transition text-black disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {queryParam && (
        <h2 className="text-xl font-bold mb-6 text-zinc-400">
          Search results for: <span className="text-white">"{queryParam}"</span>
        </h2>
      )}

      {loading && <div className="text-center text-zinc-400 mt-12">Fetching results...</div>}

      {!loading && queryParam && results.length === 0 && (
        <p className="text-zinc-500 text-center mt-12">No results found for "{queryParam}".</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {results.map((item) => {
          const isMovie = item.media_type === 'movie'
          const title = isMovie ? item.title : item.name
          const link = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`
          const year = (item.release_date || item.first_air_date || '').split('-')[0]

          return (
            <Link key={`${item.media_type}-${item.id}`} href={link} className="group">
              <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-xl mb-2">
                {item.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                    alt={title || ''}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">
                    No Poster
                  </div>
                )}
                <div className={`absolute top-2.5 left-2.5 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
                  isMovie ? 'bg-purple-600/90' : 'bg-sky-600/90'
                }`}>
                  {isMovie ? 'MOVIE' : 'TV'}
                </div>
                <div className="absolute top-2.5 right-2.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[11px] font-bold text-amber-300">
                  ⭐ {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                </div>
              </div>
              <h3 className="font-semibold text-sm truncate text-white group-hover:text-amber-300 transition-colors">
                {title}
              </h3>
              <p className="text-xs text-zinc-500">
                {year || (isMovie ? 'Movie' : 'TV Show')}
              </p>
            </Link>
          )
        })}
      </div>
    </main>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center text-zinc-400 mt-12">Loading...</div>}>
      <SearchContent />
    </Suspense>
  )
}