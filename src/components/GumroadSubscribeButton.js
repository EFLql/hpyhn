import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase/client'

export default function GumroadSubscribeButton({ session, subscription }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      // Create a checkout session
      const response = await fetch('/api/gumroad/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          email: session.user.email
        })
      })
      
      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      setMessage('Failed to initiate subscription')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (subscription) {
    return (
      <div className="ml-4 px-3 py-1 bg-green-500 text-white text-sm rounded">
        Subscribed
      </div>
    )
  }

  return (
    <div className="ml-4">
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded"
      >
        {loading ? 'Loading...' : 'Subscribe'}
      </button>
      {message && <p className="text-red-500 text-xs mt-1">{message}</p>}
    </div>
  )
}