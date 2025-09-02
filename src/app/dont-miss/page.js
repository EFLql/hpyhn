'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Home from '../page' // Import the Home component

export default function DontMissPage() {
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isLoginOpen, setIsLoginOpen] = useState(false) // New state for LoginModal
  const [initialType] = useState('dont-miss') // Set initialType for this page
  const router = useRouter()

  useEffect(() => {
    const checkSessionAndSubscription = async () => {
      try {
        const sessionResponse = await fetch('/api/auth/session')
        const sessionData = await sessionResponse.json()

        if (sessionResponse.ok && sessionData.session) {
          setSession(sessionData.session)
          const subscriptionResponse = await fetch('/api/subscription')
          const subscriptionData = await subscriptionResponse.json()
          if (subscriptionResponse.ok) {
            setSubscription(subscriptionData)
          } else {
            console.error('Failed to fetch subscription:', subscriptionData.error)
            setSubscription(null)
          }
        } else {
          setSession(null)
          setSubscription(null)
        }
      } catch (error) {
        console.error('Error checking session or subscription:', error)
        setSession(null)
        setSubscription(null)
      } finally {
        setLoading(false)
      }
    }

    checkSessionAndSubscription()
  }, [])

  // Effect to set and clear localStorage for 'dont-miss' feed type
  useEffect(() => {
    localStorage.setItem('hn-feed-type', 'dont-miss')
    return () => localStorage.removeItem('hn-feed-type')
  }, [])

  // Always render the Home component, passing all necessary states as props
  return (
    <Home
      initialType={initialType}
      session={session}
      subscription={subscription}
      loading={loading}
      isLoginOpen={isLoginOpen}
      setIsLoginOpen={setIsLoginOpen}
    />
  )
}