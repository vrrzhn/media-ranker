// app/components/SearchBar.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SearchBarProps {
  placeholder?: string
  className?: string
}

export default function SearchBar({ 
  placeholder = "Search movies, TV shows, genres (e.g., 'crime')...",
  className = "" 
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <form onSubmit={handleSubmit} className={`relative flex items-center ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 text-sm transition"
      />
      <button
        type="submit"
        className="absolute right-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded-lg transition"
      >
        Search
      </button>
    </form>
  )
}