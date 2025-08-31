'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import LoginModal from '../../components/LoginModal' // Import LoginModal
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
    if (session && subscription?.status === 'active') {
      localStorage.setItem('hn-feed-type', 'dont-miss')
      return () => localStorage.removeItem('hn-feed-type')
    }
  }, [session, subscription])


  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    )
  }

  // If user is not logged in
  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 bg-orange-50 min-h-screen">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-orange-800">Don't Miss</h1>
          <p className="text-gray-600">Catch up on posts you might have missed!</p>
        </header>

        <main className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-4 text-orange-700">Login to Unlock "Don't Miss"</h2>
            <p className="text-gray-600 mb-4">
              This feature helps you discover posts you might be interested in, but missed.
              We use an AI model, your interested topics, and custom keywords to precisely filter content for you.
              Please log in to access this premium feature.
            </p>
            <button
              onClick={() => setIsLoginOpen(true)} // Open LoginModal
              className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
            >
              Login Now
            </button>
          </div>
        </main>

        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
        />
      </div>
    )
  }

  // If user is logged in but no active subscription
  if (session && subscription?.status !== 'active') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 bg-orange-50 min-h-screen">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-orange-800">Don't Miss</h1>
          <p className="text-gray-600">Catch up on posts you might have missed!</p>
        </header>

        <main className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-4 text-orange-700">Unlock "Don't Miss" with a Subscription</h2>
            <p className="text-gray-600 mb-4">
              "Don't Miss" is a premium feature that intelligently curates posts you're likely to enjoy,
              even if you missed them on the front page. We use an AI model, your interested topics, and custom keywords to precisely filter content for you.
              Subscribe now to never miss out! New users get a 14-day free trial.
            </p>
            <Link
              href="/account" // Link to the account page where subscription button is
              className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
            >
              Subscribe Now
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // If user is logged in and has an active subscription, render Home component
  return <Home initialType={initialType} />
}