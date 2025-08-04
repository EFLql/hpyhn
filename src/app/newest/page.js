'use client'
import { useEffect, useState } from 'react'
import Home from '../page'

export default function NewestPage() {
  const [initialType] = useState('newest') // 初始类型设为newest

  useEffect(() => {
    localStorage.setItem('hn-feed-type', 'newest')
    return () => localStorage.removeItem('hn-feed-type')
  }, [])

  return <Home initialType={initialType} />
}