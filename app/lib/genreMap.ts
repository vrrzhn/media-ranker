// app/lib/genreMap.ts

export const GENRE_MAP: Record<string, { movie?: number; tv?: number }> = {
  action: { movie: 28, tv: 10759 },
  adventure: { movie: 12, tv: 10759 },
  animation: { movie: 16, tv: 16 },
  comedy: { movie: 35, tv: 35 },
  crime: { movie: 80, tv: 80 },
  documentary: { movie: 99, tv: 99 },
  drama: { movie: 18, tv: 18 },
  family: { movie: 10751, tv: 10751 },
  fantasy: { movie: 14, tv: 10765 },
  history: { movie: 36 },
  horror: { movie: 27 },
  mystery: { movie: 9648, tv: 9648 },
  romance: { movie: 10749 },
  'sci-fi': { movie: 878, tv: 10765 },
  scifi: { movie: 878, tv: 10765 },
  thriller: { movie: 53 },
  war: { movie: 10752, tv: 10768 },
  western: { movie: 37, tv: 37 },
}