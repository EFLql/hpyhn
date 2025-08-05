'use client'

import { useEffect, useState } from 'react'
import Home from '../page'

export default function AskPage() {
  const [initialType] = useState('ask') // 初始类型设为ask

  useEffect(() => {
    localStorage.setItem('hn-feed-type', 'ask')
    return () => localStorage.removeItem('hn-feed-type')
  }, [])

  return <Home initialType={initialType} />
}