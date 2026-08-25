// app/lib/complexSearch.ts

import { GENRE_MAP } from './genreMap'

export interface MediaItem {
  id: number
  media_type: 'movie' | 'tv'
  title?: string
  name?: string
  poster_path: string | null
  vote_average: number
  popularity: number
  release_date?: string
  first_air_date?: string
}

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY
const BASE_URL = 'https://api.themoviedb.org/3'

export async function complexSearch(query: string): Promise<MediaItem[]> {
  const cleanQuery = query.trim().toLowerCase()
  if (!cleanQuery) return []

  const requests: Promise<any>[] = []

  // 1. Direct Multi-Search (Titles, Cast, Overviews)
  requests.push(
    fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => data.results || [])
  )

  // 2. Genre-Based Search
  const matchedGenre = GENRE_MAP[cleanQuery]
  if (matchedGenre) {
    if (matchedGenre.movie) {
      requests.push(
        fetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${matchedGenre.movie}&sort_by=popularity.desc`)
          .then((res) => res.json())
          .then((data) => (data.results || []).map((i: any) => ({ ...i, media_type: 'movie' })))
      )
    }
    if (matchedGenre.tv) {
      requests.push(
        fetch(`${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${matchedGenre.tv}&sort_by=popularity.desc`)
          .then((res) => res.json())
          .then((data) => (data.results || []).map((i: any) => ({ ...i, media_type: 'tv' })))
      )
    }
  }

  // 3. Keyword-Based Search (For terms like "heist", "superhero", "mafia")
  requests.push(
    (async () => {
      const kwRes = await fetch(`${BASE_URL}/search/keyword?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`)
      const kwData = await kwRes.json()
      const topKeyword = kwData.results?.[0]?.id

      if (!topKeyword) return []

      const [movieKw, tvKw] = await Promise.all([
        fetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_keywords=${topKeyword}&sort_by=popularity.desc`).then((r) => r.json()),
        fetch(`${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_keywords=${topKeyword}&sort_by=popularity.desc`).then((r) => r.json()),
      ])

      const movies = (movieKw.results || []).map((i: any) => ({ ...i, media_type: 'movie' }))
      const tvs = (tvKw.results || []).map((i: any) => ({ ...i, media_type: 'tv' }))

      return [...movies, ...tvs]
    })()
  )

  const responses = await Promise.all(requests)
  const resultMap = new Map<string, MediaItem>()

  responses.flat().forEach((item) => {
    if (!item || item.media_type === 'person') return

    const key = `${item.media_type}-${item.id}`
    if (!resultMap.has(key)) {
      resultMap.set(key, item)
    }
  })

  return Array.from(resultMap.values()).sort((a, b) => b.popularity - a.popularity)
}