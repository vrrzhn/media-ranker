'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'

// Helper function to color-code rating boxes & modal card
const getRatingStyle = (rating: number | null, isModal = false) => {
  if (rating === null || (isModal && rating === 0)) {
    return 'bg-zinc-900 border-zinc-700 text-gray-300'
  }
  if (rating === 10.0) {
    return 'bg-gradient-to-r from-rose-950/60 via-emerald-950/60 via-sky-950/60 to-purple-950/60 border-2 border-amber-300/80 text-amber-300'
  }
  if (rating >= 9.7) return 'bg-sky-950/80 border-sky-400 text-sky-400'
  if (rating >= 9.0) return 'bg-emerald-950/90 border-emerald-600 text-emerald-400'
  if (rating >= 8.0) return 'bg-lime-950/70 border-lime-400 text-lime-400'
  if (rating >= 7.0) return 'bg-yellow-950/70 border-yellow-500 text-yellow-400'
  if (rating >= 6.0) return 'bg-orange-950/70 border-orange-500 text-orange-400'
  if (rating >= 4.0) return 'bg-red-950/70 border-red-500 text-red-400'
  return 'bg-zinc-950 border-purple-950 text-purple-400/80'
}

export default function TvDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tvId = params.id

  const [show, setShow] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Rating states
  const [userRating, setUserRating] = useState<number | null>(null)
  const [ratingString, setRatingString] = useState<string>('0.0')
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const [user, setUser] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY

  useEffect(() => {
    const fetchTvData = async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,watch/providers,recommendations,content_ratings`
        )
        const data = await res.json()
        setShow(data)
      } catch (err) {
        console.error('Error fetching TV details:', err)
      } finally {
        setLoading(false)
      }

      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: existingRating } = await supabase
          .from('media')
          .select('user_rating')
          .eq('tmdb_id', Number(tvId))
          .eq('user_id', user.id)
          .single()

        if (existingRating && existingRating.user_rating !== null) {
          const formatted = Number(existingRating.user_rating).toFixed(1)
          setUserRating(Number(formatted))
          setRatingString(formatted)
        }
      }
    }

    if (tvId) {
      fetchTvData()
    }
  }, [tvId, TMDB_API_KEY])

  const handleRatingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      setRatingString((prev) => {
        const currentInt = Math.round(parseFloat(prev) * 10)
        const nextInt = Math.floor(currentInt / 10)
        return (nextInt / 10).toFixed(1)
      })
      return
    }

    if (e.key === 'Delete') {
      e.preventDefault()
      setRatingString('0.0')
      return
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      const digit = parseInt(e.key, 10)

      setRatingString((prev) => {
        const currentInt = Math.round(parseFloat(prev) * 10)
        let nextInt = currentInt * 10 + digit

        if (nextInt > 100) {
          nextInt = nextInt % 100
        }

        return (nextInt / 10).toFixed(1)
      })
    } else {
      e.preventDefault() 
    }
  }

  const handleOpenModal = () => {
    if (!user) {
      alert('Please log in to rate TV shows.')
      return
    }
    setRatingString(userRating !== null ? userRating.toFixed(1) : '0.0')
    setIsModalOpen(true)
  }

  const handleSaveRating = async () => {
    if (!user) return
    setSaving(true)

    const finalScore = parseFloat(ratingString)

    const { error } = await supabase.from('media').upsert(
      {
        user_id: user.id,
        tmdb_id: show.id,
        title: show.name,
        type: 'tv',
        poster_path: show.poster_path,
        user_rating: finalScore,
      },
      { onConflict: 'user_id,tmdb_id' }
    )

    setSaving(false)
    if (!error) {
      setUserRating(finalScore)
      setIsModalOpen(false)
    } else {
      console.error('Save error:', error)
      alert('Failed to save rating.')
    }
  }

  const handleRemoveRating = async () => {
    if (!user) return
    setSaving(true)

    const { error } = await supabase
      .from('media')
      .delete()
      .eq('tmdb_id', Number(tvId))
      .eq('user_id', user.id)

    setSaving(false)
    if (!error) {
      setUserRating(null)
    } else {
      console.error('Remove error:', error)
      alert('Failed to remove rating.')
    }
  }

  if (loading) {
    return <div className="text-center mt-20 text-gray-400">Loading TV show details...</div>
  }

  if (!show || show.success === false) {
    return <div className="text-center mt-20 text-red-500">TV show not found.</div>
  }

  // Certification / Age Restriction (TV Content Rating)
  const usRating = show.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US') || show.content_ratings?.results?.[0]
  const certification = usRating?.rating

  // Videos (Main trailer + secondary clips)
  const trailer = show.videos?.results?.find(
    (vid: any) => vid.site === 'YouTube' && (vid.type === 'Trailer' || vid.type === 'Teaser')
  )
  const secondaryVideos = show.videos?.results?.filter(
    (vid: any) => vid.site === 'YouTube' && vid.key !== trailer?.key
  ).slice(0, 4) || []

  const creators = show.created_by?.map((c: any) => c.name).join(', ')
  const topCast = show.credits?.cast?.slice(0, 6) || []

  // Watch providers
  const providers = show['watch/providers']?.results?.US || show['watch/providers']?.results?.CA || Object.values(show['watch/providers']?.results || {})[0] as any
  const flatrateProviders = providers?.flatrate || []
  const rentBuyProviders = [...(providers?.rent || []), ...(providers?.buy || [])].filter(
    (value, index, self) => index === self.findIndex((t) => t.provider_id === value.provider_id)
  )

  const recommendations = show.recommendations?.results || []

  const userBoxStyle = getRatingStyle(userRating)
  const tmdbBadgeStyle = getRatingStyle(show.vote_average ? Number(show.vote_average.toFixed(1)) : null)
  
  const currentModalRating = parseFloat(ratingString) || 0
  const modalStyle = getRatingStyle(currentModalRating, true)

  return (
    <main className="min-h-screen bg-black text-white pb-16 relative">

      {/* RATING MODAL OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
          <div className={`p-6 rounded-2xl w-full max-w-sm flex flex-col gap-4 shadow-2xl transition-all duration-300 border ${modalStyle}`}>
            <h3 className="text-xl font-bold text-center text-white">Rate "{show.name}"</h3>
            
            <div className="flex items-center justify-center gap-3 my-4">
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={ratingString}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val)) {
                    setRatingString(Math.min(10, Math.max(0, val)).toFixed(1))
                  }
                }}
                onKeyDown={handleRatingKeyDown}
                className="w-28 p-3 rounded-lg bg-black/60 text-white border border-white/20 text-center font-black text-3xl focus:outline-none focus:border-white"
              />
              <span className="text-gray-300 font-bold text-xl">/ 10</span>
            </div>

            <p className="text-xs text-gray-300/80 text-center">
              Type numbers directly. Press Backspace to undo digits. Use arrows to adjust by 0.1.
            </p>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-black/40 hover:bg-black/60 font-bold py-3 rounded-lg transition text-sm text-white border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRating}
                disabled={saving}
                className="flex-1 bg-sky-600 hover:bg-sky-700 font-bold py-3 rounded-lg transition disabled:opacity-50 text-sm text-white shadow-lg"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Backdrop Banner */}
      <div className="relative w-full h-[400px] md:h-[500px]">
        {show.backdrop_path ? (
          <img
            src={`https://image.tmdb.org/t/p/original${show.backdrop_path}`}
            alt={show.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        <div className="absolute bottom-6 left-6 right-6 max-w-6xl mx-auto flex flex-col md:flex-row items-end gap-6">
          <div className="text-3xl md:text-5xl font-black flex flex-wrap items-center gap-3">
            <span>{show.name}</span>
            {show.first_air_date && (
              <span className="text-zinc-400 font-normal text-2xl">
                ({show.first_air_date.split('-')[0]})
              </span>
            )}
            {/* Age Rating Badge */}
            {certification && (
              <span className="text-xs md:text-sm font-bold tracking-wide px-2.5 py-1 rounded border border-zinc-500 bg-zinc-900/80 text-zinc-300">
                {certification}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Poster + Where To Watch */}
        <div className="flex flex-col gap-6">
          <img
            src={
              show.poster_path
                ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Poster'
            }
            alt={show.name}
            className="w-full rounded-xl border border-zinc-800 shadow-2xl"
          />

          {/* WHERE TO WATCH CARD */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              📺 Where to Watch
            </h3>

            {flatrateProviders.length > 0 && (
              <div>
                <p className="text-xs text-zinc-400 font-medium mb-2 uppercase tracking-wider">Stream</p>
                <div className="flex flex-wrap gap-2">
                  {flatrateProviders.map((provider: any) => (
                    <div key={provider.provider_id} title={provider.provider_name}>
                      <img
                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                        alt={provider.provider_name}
                        className="w-9 h-9 rounded-lg border border-zinc-700/80 object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rentBuyProviders.length > 0 && (
              <div>
                <p className="text-xs text-zinc-400 font-medium mb-2 uppercase tracking-wider">Rent / Buy</p>
                <div className="flex flex-wrap gap-2">
                  {rentBuyProviders.map((provider: any) => (
                    <div key={provider.provider_id} title={provider.provider_name}>
                      <img
                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                        alt={provider.provider_name}
                        className="w-9 h-9 rounded-lg border border-zinc-700/80 object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {flatrateProviders.length === 0 && rentBuyProviders.length === 0 && (
              <p className="text-xs text-zinc-500 italic">No streaming availability listed for your region.</p>
            )}

            <p className="text-[10px] text-zinc-600 text-right mt-1">Data via JustWatch</p>
          </div>
        </div>

        {/* Right Column: TV Info & Details */}
        <div className="md:col-span-2 flex flex-col gap-8">
          
          {/* USER RATING BAR */}
          <div className={`p-6 rounded-xl border flex items-center justify-between transition-colors duration-300 ${userBoxStyle}`}>
            <div>
              <h3 className="font-semibold mb-1 text-current opacity-80">
                Your Rating
              </h3>
              {userRating !== null ? (
                <div className="text-3xl font-black">
                  ⭐ {userRating.toFixed(1)} <span className="text-lg opacity-60 font-normal">/ 10</span>
                </div>
              ) : (
                <div className="italic opacity-60">Not rated yet</div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleOpenModal}
                className="bg-zinc-800/80 hover:bg-zinc-700/80 text-white font-bold px-6 py-3 rounded-lg transition border border-white/10"
              >
                {userRating !== null ? 'Edit Rating' : 'Rate Show'}
              </button>

              {userRating !== null && (
                <button
                  onClick={handleRemoveRating}
                  disabled={saving}
                  className="text-xs text-yellow-400 hover:text-yellow-300 hover:underline font-medium transition"
                >
                  Remove Rating
                </button>
              )}
            </div>
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`font-bold px-3 py-1 rounded-full border ${tmdbBadgeStyle}`}>
              TMDB: {show.vote_average?.toFixed(1)} / 10
            </span>
            {show.number_of_seasons && (
              <span className="text-gray-400">
                {show.number_of_seasons} Season{show.number_of_seasons > 1 ? 's' : ''} ({show.number_of_episodes} Episodes)
              </span>
            )}
            <div className="flex gap-2">
              {show.genres?.map((genre: any) => (
                <span key={genre.id} className="bg-zinc-800 px-3 py-1 rounded-full text-xs text-white">
                  {genre.name}
                </span>
              ))}
            </div>
          </div>

          {/* Tagline & Overview */}
          {show.tagline && <p className="italic text-gray-400 text-lg">"{show.tagline}"</p>}
          <div>
            <h2 className="text-xl font-bold mb-2 text-white">Overview</h2>
            <p className="text-gray-300 leading-relaxed">{show.overview}</p>
          </div>

          {creators && (
            <div>
              <span className="text-sm text-gray-400">Created by: </span>
              <span className="font-semibold text-white">{creators}</span>
            </div>
          )}

          {/* Top Cast */}
          {topCast.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-white">Top Cast</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {topCast.map((person: any) => (
                  <div key={person.id} className="bg-zinc-900/60 p-3 rounded-lg flex items-center gap-3 border border-zinc-800/80">
                    {person.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-white">
                        ?
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="font-semibold text-sm truncate text-white">{person.name}</p>
                      <p className="text-xs text-gray-400 truncate">{person.character}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official Trailer & Secondary Videos Section */}
          <div>
            {trailer && (
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-4 text-white">Official Trailer</h2>
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-800">
                  <iframe
                    src={`https://www.youtube.com/embed/${trailer.key}`}
                    title="Official Trailer"
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Clips & Featurettes */}
            {secondaryVideos.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3 text-zinc-300">Clips & Featurettes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {secondaryVideos.map((vid: any) => (
                    <div key={vid.id} className="flex flex-col gap-2">
                      <div className="aspect-video w-full rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
                        <iframe
                          src={`https://www.youtube.com/embed/${vid.key}`}
                          title={vid.name}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                      <p className="text-xs font-medium text-zinc-400 truncate">{vid.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* NETFLIX-STYLE HORIZONTAL POSTER ROWS */}
      <div className="max-w-6xl mx-auto px-6 mt-16 flex flex-col gap-12">
        
        {/* TV-Tied Recommendations Row */}
        {recommendations.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-white">
              If You Liked "{show.name}"
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
              {recommendations.map((item: any) => (
                <Link
                  key={item.id}
                  href={`/tv/${item.id}`}
                  className="flex-none w-36 sm:w-44 group"
                >
                  <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 mb-2">
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                        alt={item.name || item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 p-2 text-center">
                        No Image
                      </div>
                    )}
                  </div>
                  <p className="font-semibold text-sm truncate text-white group-hover:text-sky-400 transition-colors">
                    {item.name || item.title}
                  </p>
                  <p className="text-xs text-zinc-400">
                    ⭐ {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}