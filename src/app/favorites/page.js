'use client'

import { useEffect, useState } from 'react'
import Home from '../page'

export default function FavoritesPage() {
  const [initialType] = useState('favorites')

  useEffect(() => {
    localStorage.setItem('hn-feed-type', 'favorites')
    return () => localStorage.removeItem('hn-feed-type')
  }, [])

  return <Home initialType={initialType} />
}