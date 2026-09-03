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

export default function MovieDetailPage() {
  const params = useParams()
  const router = useRouter()
  const movieId = params.id

  const [movie, setMovie] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Rating states
  const [userRating, setUserRating] = useState<number | null>(null)
  const [ratingString, setRatingString] = useState<string>('0.0')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Notes states
  const [userNotes, setUserNotes] = useState<string>('')
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false)
  const [savingNotes, setSavingNotes] = useState<boolean>(false)
  const [notesMsg, setNotesMsg] = useState<string | null>(null)

  // Watchlist states
  const [inWatchlist, setInWatchlist] = useState<boolean>(false)
  const [watchlistSaving, setWatchlistSaving] = useState<boolean>(false)

  const [user, setUser] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [showWatchlistConfirmModal, setShowWatchlistConfirmModal] = useState<boolean>(false)

  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY

  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,watch/providers,recommendations,release_dates`
        )
        const data = await res.json()
        setMovie(data)
      } catch (err) {
        console.error('Error fetching movie details:', err)
      } finally {
        setLoading(false)
      }

      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Fetch User Rating & Notes safely using select('*')
        const { data: existingRating, error } = await supabase
          .from('media')
          .select('*')
          .eq('tmdb_id', Number(movieId))
          .eq('user_id', user.id)
          .eq('type', 'movie')
          .maybeSingle()

        if (error) {
          console.error('Error fetching rating:', error)
        }

        if (existingRating) {
          if (existingRating.user_rating !== null && existingRating.user_rating !== undefined) {
            const formatted = Number(existingRating.user_rating).toFixed(1)
            setUserRating(Number(formatted))
            setRatingString(formatted)
          }

          if (existingRating.notes) {
            setUserNotes(existingRating.notes)
          }
        }

        // Fetch Watchlist Status
        const { data: existingWatchlist } = await supabase
          .from('watchlist')
          .select('id')
          .eq('tmdb_id', Number(movieId))
          .eq('user_id', user.id)
          .maybeSingle()

        if (existingWatchlist) {
          setInWatchlist(true)
        }
      }
    }

    if (movieId) {
      fetchMovieData()
    }
  }, [movieId, TMDB_API_KEY])

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
      alert('Please log in to rate movies.')
      return
    }
    setRatingString(userRating !== null ? userRating.toFixed(1) : '0.0')
    setIsModalOpen(true)
  }

  const handleSaveRating = async () => {
    if (!user) return
    setSaving(true)

    const finalScore = parseFloat(ratingString)

    const payload: any = {
      user_id: user.id,
      tmdb_id: Number(movie.id),
      title: movie.title,
      type: 'movie',
      poster_path: movie.poster_path,
      user_rating: finalScore,
    }

    if (userNotes) {
      payload.notes = userNotes
    }

    let { error } = await supabase.from('media').upsert(payload, { onConflict: 'user_id,tmdb_id' })

    // Fallback retry if notes column is missing in Supabase schema
    if (error && error.message?.includes('notes')) {
      delete payload.notes
      const retry = await supabase.from('media').upsert(payload, { onConflict: 'user_id,tmdb_id' })
      error = retry.error
    }

    setSaving(false)
    if (!error) {
      setUserRating(finalScore)
      setIsModalOpen(false)
    } else {
      console.error('Save error:', error)
      alert(`Failed to save rating: ${error.message}`)
    }
  }

  const handleSaveNotes = async () => {
    if (!user) {
      alert('Please log in to save notes.')
      return
    }
    setSavingNotes(true)
    setNotesMsg(null)

    const payload: any = {
      user_id: user.id,
      tmdb_id: Number(movie.id),
      title: movie.title,
      type: 'movie',
      poster_path: movie.poster_path,
      user_rating: userRating,
      notes: userNotes,
    }

    const { error } = await supabase.from('media').upsert(payload, { onConflict: 'user_id,tmdb_id' })

    setSavingNotes(false)
    if (!error) {
      setNotesMsg('Notes saved!')
      setTimeout(() => setNotesMsg(null), 3000)
    } else {
      console.error('Save notes error:', error)
      if (error.message?.includes('notes')) {
        alert('Could not save notes. Please ensure your Supabase "media" table has a "notes" column (text).')
      } else {
        alert(`Failed to save notes: ${error.message}`)
      }
    }
  }

  const handleRemoveRating = async () => {
    if (!user) return
    setSaving(true)

    if (userNotes && userNotes.trim()) {
      const payload: any = {
        user_id: user.id,
        tmdb_id: Number(movie.id),
        title: movie.title,
        type: 'movie',
        poster_path: movie.poster_path,
        user_rating: null,
        notes: userNotes,
      }
      const { error } = await supabase.from('media').upsert(payload, { onConflict: 'user_id,tmdb_id' })
      setSaving(false)
      if (!error) setUserRating(null)
    } else {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('tmdb_id', Number(movieId))
        .eq('user_id', user.id)
        .eq('type', 'movie')

      setSaving(false)
      if (!error) {
        setUserRating(null)
      } else {
        console.error('Remove error:', error)
        alert('Failed to remove rating.')
      }
    }
  }

  const executeWatchlistToggle = async () => {
    setWatchlistSaving(true)

    if (inWatchlist) {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('tmdb_id', Number(movieId))
        .eq('user_id', user.id)

      if (!error) {
        setInWatchlist(false)
      } else {
        console.error('Watchlist remove error:', error.message || error)
        alert(`Failed to remove: ${error.message}`)
      }
    } else {
      const { error } = await supabase.from('watchlist').insert({
        user_id: user.id,
        tmdb_id: Number(movie.id),
        title: movie.title,
        type: 'movie',
        poster_path: movie.poster_path || null,
      })

      if (!error) {
        setInWatchlist(true)
      } else {
        console.error('Watchlist save error:', error.message || error)
        alert(`Failed to add: ${error.message}`)
      }
    }

    setWatchlistSaving(false)
  }

  const handleToggleWatchlist = () => {
    if (!user) {
      alert('Please log in to manage your watchlist.')
      return
    }

    if (!inWatchlist && userRating !== null) {
      setShowWatchlistConfirmModal(true)
      return
    }

    executeWatchlistToggle()
  }

  if (loading) {
    return <div className="text-center mt-20 text-gray-400">Loading movie details...</div>
  }

  if (!movie || movie.success === false) {
    return <div className="text-center mt-20 text-red-500">Movie not found.</div>
  }

  // Certification / Content Rating (Movie release_dates structure)
  const usRelease = movie.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US')
  const certification = usRelease?.release_dates?.find((d: any) => d.certification)?.certification

  // Directors
  const directors = movie.credits?.crew
    ?.filter((c: any) => c.job === 'Director')
    .map((d: any) => d.name)
    .join(', ')

  // Videos
  const trailer = movie.videos?.results?.find(
    (vid: any) => vid.site === 'YouTube' && (vid.type === 'Trailer' || vid.type === 'Teaser')
  )
  const secondaryVideos = movie.videos?.results?.filter(
    (vid: any) => vid.site === 'YouTube' && vid.key !== trailer?.key
  ).slice(0, 4) || []

  const topCast = movie.credits?.cast?.slice(0, 6) || []

  // Watch providers
  const providers = movie['watch/providers']?.results?.US || movie['watch/providers']?.results?.CA || Object.values(movie['watch/providers']?.results || {})[0] as any
  const flatrateProviders = providers?.flatrate || []
  const rentBuyProviders = [...(providers?.rent || []), ...(providers?.buy || [])].filter(
    (value, index, self) => index === self.findIndex((t) => t.provider_id === value.provider_id)
  )

  const recommendations = movie.recommendations?.results || []

  const userBoxStyle = getRatingStyle(userRating)
  const tmdbBadgeStyle = getRatingStyle(movie.vote_average ? Number(movie.vote_average.toFixed(1)) : null)
  
  const currentModalRating = parseFloat(ratingString) || 0
  const modalStyle = getRatingStyle(currentModalRating, true)

  // Runtime helper (e.g. 132 mins -> 2h 12m)
  const formatRuntime = (mins: number) => {
    if (!mins) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  return (
    <main className="min-h-screen bg-black text-white pb-16 relative">

      {/* RATING MODAL OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
          <div className={`p-6 rounded-2xl w-full max-w-sm flex flex-col gap-4 shadow-2xl transition-all duration-300 border ${modalStyle}`}>
            <h3 className="text-xl font-bold text-center text-white">Rate "{movie.title}"</h3>
            
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

      {/* WATCHLIST ALREADY RATED WARNING MODAL */}
      {showWatchlistConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
          <div className="p-6 rounded-2xl w-full max-w-sm flex flex-col gap-4 shadow-2xl bg-zinc-900 border border-zinc-700">
            <h3 className="text-xl font-bold text-center text-white">Already Rated</h3>
            
            <p className="text-sm text-zinc-300 text-center leading-relaxed">
              You gave this movie a <span className="font-bold text-yellow-400">⭐ {userRating?.toFixed(1)}/10</span>. Are you sure you want to add it to your watchlist?
            </p>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowWatchlistConfirmModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 font-bold py-3 rounded-lg transition text-sm text-white border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowWatchlistConfirmModal(false)
                  executeWatchlistToggle()
                }}
                className="flex-1 bg-sky-600 hover:bg-sky-700 font-bold py-3 rounded-lg transition text-sm text-white shadow-lg"
              >
                Add Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Backdrop Banner */}
      <div className="relative w-full h-[400px] md:h-[500px]">
        {movie.backdrop_path ? (
          <img
            src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        <div className="absolute bottom-6 left-6 right-6 max-w-6xl mx-auto flex flex-col md:flex-row items-end gap-6">
          <div className="text-3xl md:text-5xl font-black flex flex-wrap items-center gap-3">
            <span>{movie.title}</span>
            {movie.release_date && (
              <span className="text-zinc-400 font-normal text-2xl">
                ({movie.release_date.split('-')[0]})
              </span>
            )}
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
        
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          <img
            src={
              movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Poster'
            }
            alt={movie.title}
            className="w-full rounded-xl border border-zinc-800 shadow-2xl"
          />

          <button
            onClick={handleToggleWatchlist}
            disabled={watchlistSaving}
            className={`w-full py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg border ${
              inWatchlist
                ? 'bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-400 border-emerald-600/80'
                : 'bg-zinc-800/90 hover:bg-zinc-700/90 text-white border-zinc-700'
            }`}
          >
            {watchlistSaving ? (
              <span>Updating...</span>
            ) : inWatchlist ? (
              <>
                <span>✓</span> In Watchlist
              </>
            ) : (
              <>
                <span>+</span> Add to Watchlist
              </>
            )}
          </button>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              🎬 Where to Watch
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

        {/* Right Column */}
        <div className="md:col-span-2 flex flex-col gap-8">
          
          {/* RATING BAR */}
          <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${userBoxStyle}`}>
            <div className="p-6 flex items-center justify-between">
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
                  {userRating !== null ? 'Edit Rating' : 'Rate Movie'}
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

            {/* ONLY DISPLAY NOTES DRAWER AND ARROW IF MOVIE HAS BEEN RATED */}
            {userRating !== null && (
              <>
                {/* EXPANDABLE NOTES DRAWER */}
                {isNotesOpen && (
                  <div className="px-6 pb-6 pt-2 border-t border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider opacity-80">
                        Your Notes / Thoughts
                      </label>
                      {notesMsg && (
                        <span className="text-xs font-semibold text-emerald-400 animate-pulse">
                          {notesMsg}
                        </span>
                      )}
                    </div>

                    <textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="Write your review or thoughts here..."
                      rows={4}
                      className="w-full p-3 rounded-lg bg-black/60 text-white border border-white/15 text-sm focus:outline-none focus:border-white resize-y"
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-md disabled:opacity-50"
                      >
                        {savingNotes ? 'Saving...' : 'Save Notes'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ARROW TOGGLE BUTTON AT BOTTOM */}
                <button
                  onClick={() => setIsNotesOpen(!isNotesOpen)}
                  className="w-full py-2 bg-black/30 hover:bg-black/50 border-t border-white/10 flex items-center justify-center gap-2 text-xs font-semibold opacity-80 hover:opacity-100 transition"
                >
                  <span>{userNotes.trim() ? 'View / Edit Notes' : 'Add Notes'}</span>
                  <span className={`transform transition-transform duration-200 ${isNotesOpen ? 'rotate-180' : 'rotate-0'}`}>
                    ▼
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`font-bold px-3 py-1 rounded-full border ${tmdbBadgeStyle}`}>
              TMDB: {movie.vote_average?.toFixed(1)} / 10
            </span>
            {movie.runtime > 0 && (
              <span className="text-gray-400">
                {formatRuntime(movie.runtime)}
              </span>
            )}
            <div className="flex gap-2">
              {movie.genres?.map((genre: any) => (
                <span key={genre.id} className="bg-zinc-800 px-3 py-1 rounded-full text-xs text-white">
                  {genre.name}
                </span>
              ))}
            </div>
          </div>

          {/* Tagline & Overview */}
          {movie.tagline && <p className="italic text-gray-400 text-lg">"{movie.tagline}"</p>}
          <div>
            <h2 className="text-xl font-bold mb-2 text-white">Overview</h2>
            <p className="text-gray-300 leading-relaxed">{movie.overview}</p>
          </div>

          {directors && (
            <div>
              <span className="text-sm text-gray-400">Directed by: </span>
              <span className="font-semibold text-white">{directors}</span>
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

      {/* Recommendations */}
      <div className="max-w-6xl mx-auto px-6 mt-16 flex flex-col gap-12">
        {recommendations.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-white">
              If You Liked "{movie.title}"
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
              {recommendations.map((item: any) => (
                <Link
                  key={item.id}
                  href={`/movie/${item.id}`}
                  className="flex-none w-36 sm:w-44 group"
                >
                  <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 mb-2">
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                        alt={item.title || item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 p-2 text-center">
                        No Image
                      </div>
                    )}
                  </div>
                  <p className="font-semibold text-sm truncate text-white group-hover:text-sky-400 transition-colors">
                    {item.title || item.name}
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