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

  // Season & Episode states
  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [seasonData, setSeasonData] = useState<any>(null)
  const [loadingEpisodes, setLoadingEpisodes] = useState<boolean>(false)

  // Main Show Rating states
  const [userRating, setUserRating] = useState<number | null>(null)
  const [ratingString, setRatingString] = useState<string>('0.0')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Episode Ratings states
  const [episodeRatings, setEpisodeRatings] = useState<Record<number, number>>({})
  const [ratedShowEpisodes, setRatedShowEpisodes] = useState<any[]>([])
  const [isEpisodesSectionOpen, setIsEpisodesSectionOpen] = useState<boolean>(false)
  const [episodeSort, setEpisodeSort] = useState<
    'rating_desc' | 'rating_asc' | 'release_asc' | 'release_desc' | 'rated_recent' | 'rated_oldest'
  >('release_asc')
  const [ratingEp, setRatingEp] = useState<any | null>(null)
  const [epRatingString, setEpRatingString] = useState<string>('0.0')
  const [isEpModalOpen, setIsEpModalOpen] = useState(false)
  const [savingEpRating, setSavingEpRating] = useState(false)

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

  // Initial Fetch: TV Details & User Data
  useEffect(() => {
    const fetchTvData = async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,watch/providers,recommendations,content_ratings`
        )
        const data = await res.json()
        setShow(data)

        if (data.seasons && data.seasons.length > 0) {
          const sorted = [...data.seasons].sort((a: any, b: any) => {
            if (a.season_number === 0) return 1
            if (b.season_number === 0) return -1
            return a.season_number - b.season_number
          })
          const firstValidSeason = sorted.find((s: any) => s.season_number > 0) || sorted[0]
          setSelectedSeason(firstValidSeason.season_number)
        }
      } catch (err) {
        console.error('Error fetching TV details:', err)
      } finally {
        setLoading(false)
      }

      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Fetch show rating
        const { data: existingRating, error } = await supabase
          .from('media')
          .select('*')
          .eq('tmdb_id', Number(tvId))
          .eq('user_id', user.id)
          .eq('type', 'tv')
          .maybeSingle()

        if (error) console.error('Error fetching rating:', error)

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

        // Fetch episode ratings
        const { data: epRatingsData } = await supabase
          .from('media')
          .select('tmdb_id, user_rating')
          .eq('user_id', user.id)
          .eq('type', 'episode')

        if (epRatingsData) {
          const epMap: Record<number, number> = {}
          epRatingsData.forEach((item: any) => {
            if (item.user_rating !== null && item.user_rating !== undefined) {
              epMap[item.tmdb_id] = Number(item.user_rating)
            }
          })
          setEpisodeRatings(epMap)
        }

        // Fetch full rows for episodes rated on THIS show specifically
        const { data: showEpRatings } = await supabase
          .from('media')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'episode')
          .eq('show_id', Number(tvId))
          .not('user_rating', 'is', null)
          .order('season_number', { ascending: true })
          .order('episode_number', { ascending: true })

        if (showEpRatings) {
          setRatedShowEpisodes(showEpRatings)
        }

        // Fetch watchlist
        const { data: existingWatchlist } = await supabase
          .from('watchlist')
          .select('id')
          .eq('tmdb_id', Number(tvId))
          .eq('user_id', user.id)
          .maybeSingle()

        if (existingWatchlist) {
          setInWatchlist(true)
        }
      }
    }

    if (tvId) {
      fetchTvData()
    }
  }, [tvId, TMDB_API_KEY])

  // Fetch Season Data whenever selectedSeason changes
  useEffect(() => {
    if (!tvId || selectedSeason === null) return

    const fetchSeasonEpisodes = async () => {
      setLoadingEpisodes(true)
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${tvId}/season/${selectedSeason}?api_key=${TMDB_API_KEY}`
        )
        const data = await res.json()
        setSeasonData(data)
      } catch (err) {
        console.error('Error fetching season details:', err)
      } finally {
        setLoadingEpisodes(false)
      }
    }

    fetchSeasonEpisodes()
  }, [tvId, selectedSeason, TMDB_API_KEY])

  // Keyboard handlers for Main Show Rating Input
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

  // Keyboard handlers for Episode Rating Input
  const handleEpRatingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      setEpRatingString((prev) => {
        const currentInt = Math.round(parseFloat(prev) * 10)
        const nextInt = Math.floor(currentInt / 10)
        return (nextInt / 10).toFixed(1)
      })
      return
    }

    if (e.key === 'Delete') {
      e.preventDefault()
      setEpRatingString('0.0')
      return
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      const digit = parseInt(e.key, 10)

      setEpRatingString((prev) => {
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

  const handleOpenEpModal = (ep: any) => {
    if (!user) {
      alert('Please log in to rate episodes.')
      return
    }
    setRatingEp(ep)
    const existingEpScore = episodeRatings[ep.id]
    setEpRatingString(existingEpScore !== undefined ? existingEpScore.toFixed(1) : '0.0')
    setIsEpModalOpen(true)
  }

  const handleSaveRating = async () => {
    if (!user) return
    setSaving(true)

    const finalScore = parseFloat(ratingString)

    const payload: any = {
      user_id: user.id,
      tmdb_id: Number(show.id),
      title: show.name,
      type: 'tv',
      poster_path: show.poster_path,
      user_rating: finalScore,
    }

    if (userNotes) {
      payload.notes = userNotes
    }

    let { error } = await supabase.from('media').upsert(payload, { onConflict: 'user_id,tmdb_id' })

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

  // --- FIXED: now saves show_id, season_number, episode_number so the
  // homepage can correctly resolve the episode's air date/year ---
  const handleSaveEpRating = async () => {
    if (!user || !ratingEp) return
    setSavingEpRating(true)

    const finalScore = parseFloat(epRatingString)

    const payload: any = {
      user_id: user.id,
      tmdb_id: Number(ratingEp.id),
      title: `${show.name} - S${selectedSeason}E${ratingEp.episode_number}: ${ratingEp.name}`,
      type: 'episode',
      poster_path: ratingEp.still_path || show.poster_path,
      user_rating: finalScore,
      show_id: Number(show.id),
      season_number: selectedSeason,
      episode_number: ratingEp.episode_number,
    }

    const { error } = await supabase.from('media').upsert(payload, { onConflict: 'user_id,tmdb_id' })

    setSavingEpRating(false)
    if (!error) {
      setEpisodeRatings((prev) => ({
        ...prev,
        [ratingEp.id]: finalScore,
      }))

      setRatedShowEpisodes((prev) => {
        const withoutThis = prev.filter((e) => e.tmdb_id !== payload.tmdb_id)
        const updated = [...withoutThis, payload]
        return updated.sort((a, b) => {
          if (a.season_number !== b.season_number) return a.season_number - b.season_number
          return a.episode_number - b.episode_number
        })
      })

      setIsEpModalOpen(false)
      setRatingEp(null)
    } else {
      console.error('Episode rating save error:', error)
      alert(`Failed to save episode rating: ${error.message}`)
    }
  }

  const handleRemoveEpRating = async () => {
    if (!user || !ratingEp) return
    setSavingEpRating(true)

    const { error } = await supabase
      .from('media')
      .delete()
      .eq('tmdb_id', Number(ratingEp.id))
      .eq('user_id', user.id)
      .eq('type', 'episode')

    setSavingEpRating(false)
    if (!error) {
      setEpisodeRatings((prev) => {
        const next = { ...prev }
        delete next[ratingEp.id]
        return next
      })
      setRatedShowEpisodes((prev) => prev.filter((e) => e.tmdb_id !== Number(ratingEp.id)))
      setIsEpModalOpen(false)
      setRatingEp(null)
    } else {
      console.error('Remove episode rating error:', error)
      alert('Failed to remove episode rating.')
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
      tmdb_id: Number(show.id),
      title: show.name,
      type: 'tv',
      poster_path: show.poster_path,
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
        tmdb_id: Number(show.id),
        title: show.name,
        type: 'tv',
        poster_path: show.poster_path,
        user_rating: null,
        notes: userNotes,
      }
      const { error } = await supabase.from('media').upsert(payload, { onConflict: 'user_id,tmdb_id' })
      setSaving(false)
      if (!error) {
        setUserRating(null)
        setIsModalOpen(false)
      }
    } else {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('tmdb_id', Number(tvId))
        .eq('user_id', user.id)
        .eq('type', 'tv')

      setSaving(false)
      if (!error) {
        setUserRating(null)
        setIsModalOpen(false)
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
        .eq('tmdb_id', Number(tvId))
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
        tmdb_id: Number(show.id),
        title: show.name,
        type: 'tv',
        poster_path: show.poster_path || null,
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
    return <div className="text-center mt-20 text-gray-400">Loading TV show details...</div>
  }

  if (!show || show.success === false) {
    return <div className="text-center mt-20 text-red-500">TV show not found.</div>
  }

  const usRating = show.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US') || show.content_ratings?.results?.[0]
  const certification = usRating?.rating

  const trailer = show.videos?.results?.find(
    (vid: any) => vid.site === 'YouTube' && (vid.type === 'Trailer' || vid.type === 'Teaser')
  )
  const secondaryVideos = show.videos?.results?.filter(
    (vid: any) => vid.site === 'YouTube' && vid.key !== trailer?.key
  ).slice(0, 4) || []

  const creators = show.created_by?.map((c: any) => c.name).join(', ')
  const topCast = show.credits?.cast?.slice(0, 6) || []

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

  const currentEpModalRating = parseFloat(epRatingString) || 0
  const epModalStyle = getRatingStyle(currentEpModalRating, true)

  // Sort Seasons: Specials (season_number === 0) ALWAYS placed at the very end
  const seasonsList = show.seasons || []
  const sortedSeasons = [...seasonsList].sort((a: any, b: any) => {
    if (a.season_number === 0) return 1
    if (b.season_number === 0) return -1
    return a.season_number - b.season_number
  })

  // Sort your rated episodes for this show based on the selected sort option
  const sortedRatedEpisodes = [...ratedShowEpisodes].sort((a: any, b: any) => {
    switch (episodeSort) {
      case 'rating_desc':
        return Number(b.user_rating) - Number(a.user_rating)
      case 'rating_asc':
        return Number(a.user_rating) - Number(b.user_rating)
      case 'release_desc':
        return (b.season_number - a.season_number) || (b.episode_number - a.episode_number)
      case 'rated_recent':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'rated_oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'release_asc':
      default:
        return (a.season_number - b.season_number) || (a.episode_number - b.episode_number)
    }
  })

  const episodeSortOptions: { value: typeof episodeSort; label: string }[] = [
    { value: 'release_asc', label: 'Release Order (Oldest First)' },
    { value: 'release_desc', label: 'Release Order (Newest First)' },
    { value: 'rating_desc', label: 'Your Rating (Highest First)' },
    { value: 'rating_asc', label: 'Your Rating (Lowest First)' },
    { value: 'rated_recent', label: 'Date Rated (Most Recent)' },
    { value: 'rated_oldest', label: 'Date Rated (Oldest First)' },
  ]

  return (
    <main className="min-h-screen bg-black text-white pb-16 relative">

      {/* SHOW RATING MODAL OVERLAY */}
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

            {userRating !== null && (
              <div className="text-center">
                <button
                  onClick={handleRemoveRating}
                  disabled={saving}
                  className="text-xs text-yellow-400 hover:text-yellow-300 hover:underline font-medium transition"
                >
                  Remove Rating
                </button>
              </div>
            )}

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

      {/* EPISODE RATING MODAL OVERLAY */}
      {isEpModalOpen && ratingEp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
          <div className={`p-6 rounded-2xl w-full max-w-sm flex flex-col gap-4 shadow-2xl transition-all duration-300 border ${epModalStyle}`}>
            <h3 className="text-lg font-bold text-center text-white line-clamp-1">
              Rate E{ratingEp.episode_number}: {ratingEp.name}
            </h3>
            
            <div className="flex items-center justify-center gap-3 my-4">
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={epRatingString}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val)) {
                    setEpRatingString(Math.min(10, Math.max(0, val)).toFixed(1))
                  }
                }}
                onKeyDown={handleEpRatingKeyDown}
                className="w-28 p-3 rounded-lg bg-black/60 text-white border border-white/20 text-center font-black text-3xl focus:outline-none focus:border-white"
              />
              <span className="text-gray-300 font-bold text-xl">/ 10</span>
            </div>

            <p className="text-xs text-gray-300/80 text-center">
              Type numbers directly. Press Backspace to undo digits. Use arrows to adjust by 0.1.
            </p>

            {episodeRatings[ratingEp.id] !== undefined && (
              <div className="text-center">
                <button
                  onClick={handleRemoveEpRating}
                  disabled={savingEpRating}
                  className="text-xs text-yellow-400 hover:text-yellow-300 hover:underline font-medium transition"
                >
                  Remove Episode Rating
                </button>
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => {
                  setIsEpModalOpen(false)
                  setRatingEp(null)
                }}
                className="flex-1 bg-black/40 hover:bg-black/60 font-bold py-3 rounded-lg transition text-sm text-white border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEpRating}
                disabled={savingEpRating}
                className="flex-1 bg-sky-600 hover:bg-sky-700 font-bold py-3 rounded-lg transition disabled:opacity-50 text-sm text-white shadow-lg"
              >
                {savingEpRating ? 'Saving...' : 'Save'}
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
              You gave this show a <span className="font-bold text-yellow-400">⭐ {userRating?.toFixed(1)}/10</span>. Are you sure you want to add it to your watchlist?
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
              show.poster_path
                ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Poster'
            }
            alt={show.name}
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
              <div>
                <button
                  onClick={handleOpenModal}
                  className="bg-zinc-800/80 hover:bg-zinc-700/80 text-white font-bold px-6 py-3 rounded-lg transition border border-white/10"
                >
                  {userRating !== null ? 'Edit Rating' : 'Rate Show'}
                </button>
              </div>
            </div>

            {/* ONLY DISPLAY NOTES DRAWER AND ARROW IF SHOW HAS BEEN RATED */}
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
                      placeholder="Write your review, episode notes, or thoughts here..."
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

      {/* ========================================================= */}
      {/* EPISODES & SEASONS (COLLAPSIBLE) */}
      {/* ========================================================= */}
      {sortedSeasons.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 mt-16">
          {/* COLLAPSIBLE HEADER */}
          <button
            onClick={() => setIsEpisodesSectionOpen((prev) => !prev)}
            className="w-full flex items-center justify-between gap-4 mb-4 group focus:outline-none"
          >
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              🎬 Episodes & Seasons
            </h2>
            <span className={`text-2xl text-zinc-400 group-hover:text-white transition-transform duration-200 ${isEpisodesSectionOpen ? 'rotate-180' : 'rotate-0'}`}>
              ▼
            </span>
          </button>

          {isEpisodesSectionOpen && (
            <>
              {/* STABLE SEASON SELECTOR ROW WITH HORIZONTAL SCROLL WHEEL */}
              <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {sortedSeasons.map((season: any) => {
                  const isActive = selectedSeason === season.season_number
                  return (
                    <button
                      key={season.id}
                      onClick={() => setSelectedSeason(season.season_number)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 border ${
                        isActive
                          ? 'bg-sky-500 text-black border-sky-400 shadow-lg shadow-sky-500/20'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {season.name} ({season.episode_count} Ep)
                    </button>
                  )
                })}
              </div>

              {/* SEASON BIO / OVERVIEW */}
              {seasonData?.overview && seasonData.overview.trim().length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-300 text-sm leading-relaxed">
                  <span className="font-bold text-sky-400 block mb-1">
                    {seasonData.name} Overview:
                  </span>
                  {seasonData.overview}
                </div>
              )}

              {/* SCROLLABLE EPISODE VIEWPORT */}
              {loadingEpisodes ? (
                <div className="flex flex-col gap-3 animate-pulse">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-32 bg-zinc-900 rounded-xl border border-zinc-800" />
                  ))}
                </div>
              ) : seasonData?.episodes && seasonData.episodes.length > 0 ? (
                <div className="max-h-[680px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-zinc-950/40 rounded-xl border border-zinc-800/50 p-1">
                  <div className="flex flex-col gap-3">
                    {seasonData.episodes.map((ep: any) => {
                      const epUserRating = episodeRatings[ep.id] ?? null
                      const epCardStyle =
                        epUserRating !== null
                          ? getRatingStyle(epUserRating)
                          : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/80 hover:border-zinc-700'

                      const epTmdbBadgeStyle = getRatingStyle(
                        ep.vote_average ? Number(ep.vote_average.toFixed(1)) : null
                      )

                      return (
                        <div
                          key={ep.id}
                          className={`border rounded-xl p-4 transition-all duration-200 flex flex-col sm:flex-row gap-4 items-start sm:items-center group ${epCardStyle}`}
                        >
                          {/* Episode Still Image */}
                          <div className="relative w-full sm:w-52 h-32 flex-none rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                            {ep.still_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                alt={ep.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600 font-medium">
                                No Thumbnail
                              </div>
                            )}
                            <span className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-bold text-sky-400 border border-white/10">
                              E{ep.episode_number < 10 ? `0${ep.episode_number}` : ep.episode_number}
                            </span>
                          </div>

                          {/* Episode Details */}
                          <div className="flex flex-col justify-between flex-grow overflow-hidden w-full h-full min-h-[110px]">
                            
                            {/* Top Row: Title + Rate Button */}
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <h4 className="font-bold text-base text-white group-hover:text-sky-400 transition-colors line-clamp-1">
                                {ep.episode_number}. {ep.name}
                              </h4>

                              {/* TOP RIGHT RATE BUTTON */}
                              <button
                                onClick={() => handleOpenEpModal(ep)}
                                className="px-3 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-xs font-bold text-white border border-white/10 transition shrink-0 shadow-sm flex items-center gap-1"
                              >
                                {epUserRating !== null ? (
                                  <span className="text-amber-300 font-black">⭐ {epUserRating.toFixed(1)}</span>
                                ) : (
                                  <span>+ Rate</span>
                                )}
                              </button>
                            </div>

                            {/* Overview */}
                            <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 sm:line-clamp-3 leading-relaxed mb-3">
                              {ep.overview || 'No description available for this episode.'}
                            </p>

                            {/* Bottom Row: Air Date, Runtime + Bottom Right Color-Coded TMDB Rating */}
                            <div className="flex items-center justify-between gap-2 text-xs font-medium mt-auto pt-1">
                              <div className="flex items-center gap-4 text-zinc-400">
                                {ep.air_date && <span>📅 {ep.air_date}</span>}
                                {ep.runtime && <span>⏱️ {ep.runtime} min</span>}
                              </div>

                              {/* BOTTOM RIGHT COLOR-CODED TMDB RATING */}
                              {ep.vote_average > 0 ? (
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${epTmdbBadgeStyle}`}>
                                  TMDB: {ep.vote_average.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-[11px] text-zinc-500 font-medium shrink-0">
                                  TMDB: N/A
                                </span>
                              )}
                            </div>

                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 italic bg-zinc-900/30 rounded-xl border border-zinc-800">
                  No episode details found for this season.
                </div>
              )}

              {/* ========================================================= */}
              {/* YOUR RATED EPISODES FOR THIS SHOW */}
              {/* ========================================================= */}
              {ratedShowEpisodes.length > 0 && (
                <div className="mt-12">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                      ⭐ Your Rated Episodes
                    </h3>

                    <select
                      value={episodeSort}
                      onChange={(e) => setEpisodeSort(e.target.value as typeof episodeSort)}
                      className="bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {episodeSortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          Sort: {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
                    {sortedRatedEpisodes.map((ep: any) => {
                      const stillUrl = ep.poster_path
                        ? ep.poster_path.startsWith('http')
                          ? ep.poster_path
                          : `https://image.tmdb.org/t/p/w300${ep.poster_path}`
                        : null

                      return (
                        <button
                          key={ep.tmdb_id}
                          onClick={() => setSelectedSeason(ep.season_number)}
                          className="flex-none w-56 text-left group focus:outline-none"
                        >
                          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 mb-2">
                            {stillUrl ? (
                              <img
                                src={stillUrl}
                                alt={ep.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                                No Thumbnail
                              </div>
                            )}
                            <span className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-bold text-sky-400 border border-white/10">
                              S{ep.season_number}E{ep.episode_number < 10 ? `0${ep.episode_number}` : ep.episode_number}
                            </span>
                            <div className="absolute top-2 right-2 bg-black/90 border border-amber-300/80 px-2 py-0.5 rounded-md text-[11px] font-black text-amber-300 shadow-lg backdrop-blur-md">
                              ⭐ {Number(ep.user_rating).toFixed(1)}
                            </div>
                          </div>
                          <p className="font-semibold text-sm truncate text-white group-hover:text-sky-400 transition-colors">
                            {ep.title}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Recommendations */}
      <div className="max-w-6xl mx-auto px-6 mt-16 flex flex-col gap-12">
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