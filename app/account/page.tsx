'use client'

import { useEffect, useState, FormEvent, ChangeEvent, DragEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/app/lib/supabase'

// --- TYPES ---
interface UserProfile {
  id: string
  username: string
  avatar_url: string
  updated_at?: string
}

interface MediaItem {
  id: string
  user_id: string
  tmdb_id: number
  title: string
  type: 'movie' | 'tv'
  poster_path?: string | null
  release_date?: string | null
  first_air_date?: string | null
  user_rating?: number | null
  created_at: string
}

const DEFAULT_BASE_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%2327272a'><rect width='100' height='100' fill='%2318181b'/><circle cx='50' cy='40' r='20' fill='%233f3f46'/><path d='M20,90 C20,68 33,60 50,60 C67,60 80,68 80,90 Z' fill='%233f3f46'/><circle cx='50' cy='40' r='8' fill='%23fbbf24'/></svg>"

type FilterOption = 'all' | 'movies' | 'tv'
type SortOption = 'rating-desc' | 'rating-asc' | 'date-desc' | 'date-asc'
type DropMode = 'swap' | 'before' | 'after'

export default function AccountPage() {
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  // Profile State
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_BASE_AVATAR)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Watchlist & Ratings Data
  const [watchlist, setWatchlist] = useState<MediaItem[]>([])
  const [ratedMedia, setRatedMedia] = useState<MediaItem[]>([])
  
  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<'watchlist' | 'ratings' | 'settings'>('watchlist')
  const [watchlistFilter, setWatchlistFilter] = useState<FilterOption>('all')
  const [ratingsFilter, setRatingsFilter] = useState<FilterOption>('all')
  const [ratingsSort, setRatingsSort] = useState<SortOption>('rating-desc')
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ index: number; mode: DropMode } | null>(null)

  // Fetch User Data
  useEffect(() => {
    let isMounted = true

    const fetchUserData = async () => {
      setLoading(true)
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()

        if (!currentUser) {
          router.push('/login')
          return
        }

        if (!isMounted) return
        setUser(currentUser)

        const [profileRes, watchlistRes, ratingsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
          supabase.from('watchlist').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
          supabase.from('media').select('*').eq('user_id', currentUser.id).not('user_rating', 'is', null)
        ])

        if (!isMounted) return

        if (profileRes.data) {
          setUsername(profileRes.data.username || currentUser.email?.split('@')[0] || '')
          setAvatarUrl(profileRes.data.avatar_url || DEFAULT_BASE_AVATAR)
        } else {
          setUsername(currentUser.email?.split('@')[0] || 'Cinephile')
          setAvatarUrl(DEFAULT_BASE_AVATAR)
        }

        setWatchlist(watchlistRes.data || [])
        setRatedMedia(ratingsRes.data || [])
      } catch (err) {
        console.error('Error fetching account data:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchUserData()

    return () => {
      isMounted = false
    }
  }, [router])

  // Helper function to find rating for any media item
  const getMediaRating = (item: MediaItem): number | null => {
    if (item.user_rating !== undefined && item.user_rating !== null) {
      return item.user_rating
    }
    const match = ratedMedia.find(
      (r) => r.tmdb_id === item.tmdb_id && (r.type === item.type || (!r.type && !item.type))
    )
    return match?.user_rating ?? null
  }

  // Handle Drag & Drop Logic
  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (draggedIndex === null || draggedIndex === index) return

    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const width = rect.width
    const ratio = relX / width

    let mode: DropMode = 'swap'
    if (ratio < 0.25) {
      mode = 'before'
    } else if (ratio > 0.75) {
      mode = 'after'
    }

    setDropTarget((prev) => {
      if (prev?.index === index && prev?.mode === mode) return prev
      return { index, mode }
    })
  }

  const handleDragLeave = (e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDropTarget(null)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    if (draggedIndex === null || dropTarget === null) return

    const sourceItem = filteredWatchlist[draggedIndex]
    const targetItem = filteredWatchlist[dropTarget.index]

    if (!sourceItem || !targetItem) return

    const updatedWatchlist = [...watchlist]
    const realSourceIdx = updatedWatchlist.findIndex((item) => item.id === sourceItem.id)
    const realTargetIdx = updatedWatchlist.findIndex((item) => item.id === targetItem.id)

    if (realSourceIdx === -1 || realTargetIdx === -1) return

    if (dropTarget.mode === 'swap') {
      const temp = updatedWatchlist[realSourceIdx]
      updatedWatchlist[realSourceIdx] = updatedWatchlist[realTargetIdx]
      updatedWatchlist[realTargetIdx] = temp
    } else {
      const [movedItem] = updatedWatchlist.splice(realSourceIdx, 1)
      let insertIndex = updatedWatchlist.findIndex((item) => item.id === targetItem.id)
      if (dropTarget.mode === 'after') {
        insertIndex += 1
      }
      updatedWatchlist.splice(insertIndex, 0, movedItem)
    }

    setWatchlist(updatedWatchlist)
    setDraggedIndex(null)
    setDropTarget(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDropTarget(null)
  }

  // Handle File Selection for Avatar
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setProfileMsg({ type: 'error', text: 'Please upload a valid image file (JPG, PNG, WEBP).' })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg({ type: 'error', text: 'Image size must be under 5MB.' })
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setProfileMsg(null)
  }

  // Save Profile
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSavingProfile(true)
    setProfileMsg(null)
    let finalAvatarUrl = avatarUrl

    try {
      if (selectedFile) {
        setUploadingImage(true)
        const fileExt = selectedFile.name.split('.').pop()
        const filePath = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, selectedFile, { upsert: true })

        if (uploadError) {
          throw new Error(`Avatar upload failed: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        finalAvatarUrl = urlData.publicUrl
      }

      const payload: UserProfile = {
        id: user.id,
        username: username.trim(),
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString()
      }

      const { error: dbError } = await supabase.from('profiles').upsert(payload)
      if (dbError) throw dbError

      setAvatarUrl(finalAvatarUrl)
      setSelectedFile(null)
      setPreviewUrl(null)
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' })
      setTimeout(() => setProfileMsg(null), 3000)
    } catch (err: any) {
      console.error(err)
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' })
    } finally {
      setSavingProfile(false)
      setUploadingImage(false)
    }
  }

  // Remove Watchlist Item
  const handleRemoveFromWatchlist = async (id: string) => {
    setRemovingId(id)
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    setRemovingId(null)

    if (!error) {
      setWatchlist((prev) => prev.filter((item) => item.id !== id))
    }
  }

  // Reset Avatar
  const handleResetAvatar = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setAvatarUrl(DEFAULT_BASE_AVATAR)
  }

  // Sign Out
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Filtered Watchlist
  const filteredWatchlist = watchlist.filter((item) => {
    if (watchlistFilter === 'movies') return item.type === 'movie' || item.type !== 'tv'
    if (watchlistFilter === 'tv') return item.type === 'tv'
    return true
  })

  // Filtered & Sorted Ratings
  const filteredAndSortedRatings = ratedMedia
    .filter((item) => {
      if (ratingsFilter === 'movies') return item.type === 'movie' || item.type !== 'tv'
      if (ratingsFilter === 'tv') return item.type === 'tv'
      return true
    })
    .sort((a, b) => {
      if (ratingsSort === 'rating-desc') return (Number(b.user_rating) || 0) - (Number(a.user_rating) || 0)
      if (ratingsSort === 'rating-asc') return (Number(a.user_rating) || 0) - (Number(b.user_rating) || 0)
      if (ratingsSort === 'date-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (ratingsSort === 'date-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return 0
    })

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-zinc-500">Loading Account Details...</p>
      </div>
    )
  }

  const currentDisplayAvatar = previewUrl || avatarUrl

  return (
    <main className="min-h-screen bg-black text-white pb-24 select-none">
      {/* HERO BANNER */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-5">
          <img
            src={currentDisplayAvatar}
            alt={username}
            className="w-20 h-20 rounded-2xl bg-zinc-900 object-cover ring-2 ring-amber-300/80 shadow-2xl shadow-amber-400/20"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {username}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">{user?.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 uppercase tracking-wider">
                {watchlist.length} Saved
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-400/10 border border-purple-400/30 text-purple-300 uppercase tracking-wider">
                {ratedMedia.length} Rated
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGATION CONTROLS */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800">
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'watchlist'
                  ? 'bg-amber-400 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Watch List ({watchlist.length})
            </button>
            <button
              onClick={() => setActiveTab('ratings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'ratings'
                  ? 'bg-amber-400 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Your Ratings ({ratedMedia.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'settings'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Edit Profile
            </button>
          </div>

          <button
            onClick={handleSignOut}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 text-xs font-bold transition"
          >
            Sign Out
          </button>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="max-w-6xl mx-auto px-6 mt-8">

        {/* TAB 1: WATCHLIST */}
        {activeTab === 'watchlist' && (
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Your Saved Watch List</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Drag poster directly to <span className="text-amber-300 font-semibold">swap</span>, or hold near edges to <span className="text-sky-300 font-semibold">insert</span> between items.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => setWatchlistFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    watchlistFilter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setWatchlistFilter('movies')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    watchlistFilter === 'movies' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Movies Only
                </button>
                <button
                  onClick={() => setWatchlistFilter('tv')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    watchlistFilter === 'tv' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Shows Only
                </button>
              </div>
            </div>

            {filteredWatchlist.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                <span className="text-4xl mb-3">🎬</span>
                <p className="text-sm text-zinc-300 font-semibold">No titles found in watch list</p>
                <Link
                  href="/"
                  className="mt-4 px-5 py-2.5 rounded-xl bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition"
                >
                  Browse Media
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {filteredWatchlist.map((item, index) => {
                  const isTv = item.type === 'tv'
                  const dateStr = item.release_date || item.first_air_date || ''
                  const releaseYear = dateStr ? dateStr.substring(0, 4) : ''
                  const isRemoving = removingId === item.id
                  const rating = getMediaRating(item)

                  const isDragging = draggedIndex === index
                  const isTarget = dropTarget?.index === index
                  const dropMode = isTarget ? dropTarget.mode : null

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      className={`group flex flex-col cursor-grab active:cursor-grabbing relative transition-all duration-200 ${
                        isDragging ? 'opacity-30 scale-95' : 'opacity-100'
                      }`}
                    >
                      {/* NUMBER RANK BADGE - ABOVE POSTER CARD */}
                      <div className="flex items-center justify-between px-0.5 mb-1.5">
                        <span className="bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Drop insertion indicators */}
                      {isTarget && dropMode === 'before' && (
                        <div className="pointer-events-none absolute -left-2 top-6 bottom-0 w-1.5 bg-sky-400 rounded-full z-30 shadow-[0_0_12px_rgba(56,189,248,0.8)] animate-pulse" />
                      )}
                      {isTarget && dropMode === 'after' && (
                        <div className="pointer-events-none absolute -right-2 top-6 bottom-0 w-1.5 bg-sky-400 rounded-full z-30 shadow-[0_0_12px_rgba(56,189,248,0.8)] animate-pulse" />
                      )}

                      {/* POSTER CONTAINER */}
                      <div
                        className={`relative aspect-[2/3] w-full rounded-2xl overflow-hidden border bg-zinc-900 shadow-xl mb-2 transition-all duration-200 ${
                          isTarget && dropMode === 'swap'
                            ? 'border-amber-400 ring-4 ring-amber-400/30 scale-105 z-20'
                            : 'border-zinc-800/80 group-hover:border-zinc-600 group-hover:scale-102'
                        }`}
                      >
                        {/* TOP LEFT: TYPE BADGE */}
                        <div className={`pointer-events-none absolute top-2.5 left-2.5 z-20 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider ${
                          isTv ? 'bg-sky-600/90' : 'bg-purple-600/90'
                        }`}>
                          {isTv ? 'TV' : 'MOVIE'}
                        </div>

                        {/* TOP RIGHT: RATING BADGE */}
                        {rating !== null && rating !== undefined && (
                          <div className="pointer-events-none absolute top-2.5 right-2.5 z-20 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[11px] font-bold text-amber-300 shadow-md">
                            ⭐ {Number(rating).toFixed(1)}
                          </div>
                        )}

                        {/* SWAP OVERLAY INDICATOR */}
                        {isTarget && dropMode === 'swap' && (
                          <div className="pointer-events-none absolute inset-0 bg-amber-500/20 backdrop-blur-xs z-10 flex items-center justify-center">
                            <span className="bg-amber-400 text-black font-black text-xs px-3 py-1.5 rounded-xl shadow-2xl tracking-wider uppercase">
                              Swap
                            </span>
                          </div>
                        )}

                        {item.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                            alt={item.title}
                            loading="lazy"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 pointer-events-none">
                            No Poster
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/${isTv ? 'tv' : 'movie'}/${item.tmdb_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-sm truncate text-white hover:text-amber-300 transition"
                      >
                        {item.title}
                      </Link>
                      
                      {/* YEAR ONLY (NO TYPE FALLBACK) */}
                      {releaseYear ? (
                        <p className="text-xs text-zinc-500">{releaseYear}</p>
                      ) : (
                        <p className="text-xs text-zinc-600">—</p>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFromWatchlist(item.id)
                        }}
                        disabled={isRemoving}
                        className="mt-2 w-full py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-600/20 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/40 text-[11px] font-bold text-zinc-400 transition"
                      >
                        {isRemoving ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: YOUR RATINGS */}
        {activeTab === 'ratings' && (
          <div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-white">Titles You've Rated</h2>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-zinc-400">Sort by:</label>
                  <select
                    value={ratingsSort}
                    onChange={(e) => setRatingsSort(e.target.value as SortOption)}
                    className="py-1.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-white focus:outline-none focus:border-amber-300 transition"
                  >
                    <option value="rating-desc">Highest to Lowest Rated</option>
                    <option value="rating-asc">Lowest to Highest Rated</option>
                    <option value="date-desc">Newest to Oldest Rated</option>
                    <option value="date-asc">Oldest to Newest Rated</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => setRatingsFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      ratingsFilter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setRatingsFilter('movies')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      ratingsFilter === 'movies' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Movies Only
                  </button>
                  <button
                    onClick={() => setRatingsFilter('tv')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      ratingsFilter === 'tv' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Shows Only
                  </button>
                </div>
              </div>
            </div>

            {filteredAndSortedRatings.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                <span className="text-4xl mb-3">⭐</span>
                <p className="text-sm text-zinc-300 font-semibold">No rated titles found</p>
                <Link
                  href="/"
                  className="mt-4 px-5 py-2.5 rounded-xl bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition"
                >
                  Rate Media
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {filteredAndSortedRatings.map((item) => {
                  const isTv = item.type === 'tv'
                  const dateStr = item.release_date || item.first_air_date || ''
                  const releaseYear = dateStr ? dateStr.substring(0, 4) : ''
                  const rating = item.user_rating ? Number(item.user_rating).toFixed(1) : 'N/A'

                  return (
                    <div key={item.id} className="group flex flex-col">
                      <Link
                        href={`/${isTv ? 'tv' : 'movie'}/${item.tmdb_id}`}
                        className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-900 shadow-xl mb-2 group-hover:scale-105 transition duration-300"
                      >
                        {item.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                            alt={item.title}
                            loading="lazy"
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

                        <div className="absolute top-2.5 right-2.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[11px] font-bold text-amber-300 shadow-md">
                          ⭐ {rating}
                        </div>
                      </Link>

                      <p className="font-semibold text-sm truncate text-white group-hover:text-amber-300 transition">
                        {item.title}
                      </p>
                      
                      {/* YEAR ONLY (NO TYPE FALLBACK) */}
                      {releaseYear ? (
                        <p className="text-xs text-zinc-500">{releaseYear}</p>
                      ) : (
                        <p className="text-xs text-zinc-600">—</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFILE SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-xl bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Profile Settings</h2>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter custom username"
                  className="w-full py-3 px-4 rounded-xl bg-black/60 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-300 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Profile Picture
                </label>

                <div className="flex items-center gap-5 p-4 rounded-2xl bg-black/40 border border-zinc-800">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-700 shrink-0">
                    <img
                      src={currentDisplayAvatar}
                      alt="Profile Avatar Preview"
                      className="w-full h-full object-cover"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs cursor-pointer transition shadow-md">
                      <span>Upload Custom Photo</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp, image/gif"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleResetAvatar}
                      className="text-left text-[11px] font-semibold text-zinc-400 hover:text-rose-400 transition"
                    >
                      Reset to default avatar
                    </button>
                    <p className="text-[10px] text-zinc-500">Supports PNG, JPG, or WEBP (Max 5MB)</p>
                  </div>
                </div>
              </div>

              {profileMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  }`}
                >
                  {profileMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-sm hover:from-amber-300 hover:to-amber-400 transition"
              >
                {savingProfile ? 'Saving Changes...' : 'Save Profile'}
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  )
}