'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
    }

    getUser()
  }, [router])

  if (!user) return <div>Loading...</div>

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">Welcome, {user.email}</h1>
      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-4 bg-red-500 text-white p-2 rounded hover:bg-red-600"
      >
        Sign Out
      </button>
    </div>
  )
}