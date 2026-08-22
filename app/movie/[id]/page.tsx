'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/app/lib/supabase'

export default function MovieDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [movie, setMovie] = useState<any>(null)
  const [rating, setRating] = useState<number>(8.0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMovieDetails = async () => {
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
      const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`)
      const data = await res.json()
      setMovie(data)
      setLoading(false)
    }
    fetchMovieDetails()
  }, [id])

  const saveRating = async () => {
    const { error } = await supabase.from('media').insert([
      {
        tmdb_id: movie.id,
        title: movie.title,
        type: 'movie',
        poster_path: movie.poster_path,
        user_rating: rating,
      },
    ])

    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      alert(`Saved "${movie.title}" with a rating of ${rating}!`)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading movie details...</div>
  if (!movie) return <div className="p-8 text-center">Movie not found.</div>

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {movie.poster_path && (
          <img
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            className="w-64 rounded-lg shadow-lg"
          />
        )}
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2">{movie.title}</h1>
          <p className="text-gray-400 mb-4">
            {movie.release_date?.split('-')[0]} • {movie.runtime} mins
          </p>
          <p className="text-lg leading-relaxed mb-6">{movie.overview}</p>

          <div className="p-4 bg-zinc-900 rounded-lg flex items-center gap-4">
            <span className="font-semibold">Your Rating:</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(parseFloat(e.target.value))}
              className="border p-2 w-20 rounded text-black font-bold"
            />
            <button
              onClick={saveRating}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold"
            >
              Save Rating
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}