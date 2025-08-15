'use client'
import { useEffect, useState } from 'react'
import Home from '../page'

export default function NewestPage() {
  const [initialType] = useState('news') // 初始类型设为newest

  useEffect(() => {
    localStorage.setItem('hn-feed-type', 'news')
    return () => localStorage.removeItem('hn-feed-type')
  }, [])

  return <Home initialType={initialType} />
}