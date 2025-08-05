'use client'

import { useEffect, useState } from 'react'
import Home from '../page'

export default function ShowPage() {
  const [initialType] = useState('show') // 初始类型设为show

  useEffect(() => {
    localStorage.setItem('hn-feed-type', 'show')
    return () => localStorage.removeItem('hn-feed-type')
  }, [])

  return <Home initialType={initialType} />
}