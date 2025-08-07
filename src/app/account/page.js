'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase/client'
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/')
        return
      }
      setSession(session)
      fetchSubscription(session.user.id)
    }

    checkSession()
  }, [router])

  const fetchSubscription = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setSubscription(data)
    } catch (error) {
      console.error('Error fetching subscription:', error)
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
              <li>Access to premium content</li>
              <li>Ad-free experience</li>
              <li>Early access to new features</li>
              <li>Priority customer support</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/')
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