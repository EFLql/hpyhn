'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GumroadSubscribeButton from '../../components/GumroadSubscribeButton'
import Link from 'next/link'

export default function AccountPage() {
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      // 这里可能需要通过后端接口获取session信息
      // 但为了简化，我们保持原来的逻辑
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      
      if (!data.session) {
        router.push('/')
        return
      }
      setSession(data.session)
      fetchSubscription()
    }

    checkSession()
  }, [router])

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscription')
      const data = await response.json()
      
      if (response.ok) {
        setSubscription(data)
      } else {
        console.error('Failed to fetch subscription:', data.error)
        setSubscription(null)
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 bg-orange-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-orange-800">Account Settings</h1>
        <p className="text-gray-600">Manage your subscription and account details</p>
      </header>

      <main className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1 p-2 bg-gray-50 rounded-md">
                {session?.user?.email}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">User ID</label>
              <div className="mt-1 p-2 bg-gray-50 rounded-md">
                {session?.user?.id}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8">
          <h2 className="text-xl font-semibold mb-4">Subscription</h2>
          
          {subscription ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-green-800">Active Subscription</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Your subscription is active and will renew on{' '}
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                  <div className="mt-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </div>
                </div>
                <div>
                  <GumroadSubscribeButton 
                    session={session} 
                    subscription={subscription} 
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-medium text-orange-800">No Active Subscription</h3>
              <p className="text-sm text-orange-700 mt-1">
                Subscribe to unlock premium features and support our service.
              </p>
              <div className="mt-4">
                <GumroadSubscribeButton 
                  session={session} 
                  subscription={subscription} 
                />
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-2">Subscription Benefits</h3>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>AI-powered interest model predicts your interest level for each post</li>
              <li>Automatically filters posts you might be interested in based on your preferences</li>
              <li>Early access to new features</li>
            </ul>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              After successful subscription, please refresh the page to check your subscription status. 
              There might be a delay due to network conditions, please don't worry.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                const response = await fetch('/api/auth/logout', {
                  method: 'POST',
                })
                if (response.ok) {
                  router.push('/')
                }
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              Sign Out
            </button>
            <Link 
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}