'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])

  const searchMovies = async () => {
    if (!query) return
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}`
    )
    const data = await res.json()
    setResults(data.results || [])
  }

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Media Ranker</h1>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          placeholder="Search for a movie..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border p-2 rounded text-black flex-1"
        />
        <button
          onClick={searchMovies}
          className="bg-blue-600 text-white px-6 py-2 rounded font-semibold"
        >
          Search
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {results.map((item) => (
          <Link key={item.id} href={`/movie/${item.id}`} className="group">
            <div className="border rounded-lg overflow-hidden bg-zinc-900 group-hover:scale-105 transition-transform duration-200">
              {item.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                  alt={item.title}
                  className="w-full h-72 object-cover"
                />
              ) : (
                <div className="w-full h-72 bg-zinc-800 flex items-center justify-center text-xs text-gray-400">
                  No Poster
                </div>
              )}
              <div className="p-3">
                <h3 className="font-bold text-sm truncate">{item.title}</h3>
                <p className="text-xs text-gray-400">{item.release_date?.split('-')[0]}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}