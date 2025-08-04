'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    try {
      // First, sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      
      if (error) throw error
      
      // Then, insert the username into the users table
      if (data.user) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            { id: data.user.id, username }
          ])
          
        if (insertError) throw insertError
      }
      
      setMessage('Signup successful! Please check your email for confirmation.')
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      router.push('/') // 改为跳转到主页而不是返回上一页
    }
  }

  // Allow Escape key to close the modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        router.push('/') // 改为跳转到主页而不是返回上一页
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [router])

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackgroundClick}
    >
      <div className="max-w-4xl w-full h-full flex items-center justify-center p-4">
        <div 
          className="bg-orange-50 rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
        >
          <header className="bg-orange-500 py-2 px-4 flex justify-between items-center rounded-t-lg">
            <div className="flex items-center">
              <div className="font-bold text-white mr-4">HPYHN</div>
            </div>
            <button 
              onClick={() => router.push('/')} // 改为跳转到主页而不是返回上一页
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              &times;
            </button>
          </header>
          
          <main className="bg-white py-8 px-4 rounded-b-lg">
            <h1 className="text-2xl font-bold mb-6 text-center">Sign Up</h1>
            
            {message && (
              <div className={`border px-4 py-3 rounded mb-4 ${
                message.includes('successful') 
                  ? 'bg-green-100 border-green-400 text-green-700' 
                  : 'bg-red-100 border-red-400 text-red-700'
              }`}>
                {message}
              </div>
            )}
            
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              >
                {loading ? 'Signing up...' : 'Sign Up'}
              </button>
            </form>
            
            <div className="mt-4 text-center">
              <Link href="/login" className="text-orange-500 hover:underline">
                Already have an account? Login
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}