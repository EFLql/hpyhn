'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginModal({ isOpen, onClose, onRegisterClick }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    try {
      // 调用后端 API 路由而不是直接使用 Supabase 客户端
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      setMessage('Login successful!')

      setTimeout(() => {
        onClose()
        router.push('/') // 明确导航回主页
        router.refresh() // 刷新页面以更新登录状态
      }, 1000)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider) => {
    setLoading(true)
    setMessage('')

    try {
      // 对于 OAuth 登录，我们仍然需要使用 Supabase 客户端
      // 但重定向到我们自己的回调页面
      const response = await fetch('/api/auth/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          provider,
          redirectTo: `${window.location.origin}/api/auth/callback` // Changed this line
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'OAuth login failed')
      }

      // 重定向到 Supabase OAuth 页面
      window.location.href = data.url
    } catch (error) {
      setMessage(error.message)
      setLoading(false)
    }
  }

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
  <div 
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    onClick={handleBackgroundClick}
  >
    <div 
      className="bg-orange-50 rounded-lg shadow-xl w-full max-w-md mx-4"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="bg-orange-500 py-2 px-4 flex justify-between items-center rounded-t-lg">
          <div className="flex items-center">
            <div className="font-bold text-white mr-4">HPYHN</div>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold"
          >
            &times;
          </button>
        </header>
        
      <main className="bg-white py-6 px-4 sm:py-8 sm:px-6 rounded-b-lg">
          <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
          
          {message && (
            <div className={`border px-4 py-3 rounded mb-4 ${
              message.includes('successful') 
                ? 'bg-green-100 border-green-400 text-green-700' 
                : 'bg-red-100 border-red-400 text-red-700'
            }`}>
              {message}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
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
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => handleOAuthLogin('github')}
                disabled={loading}
                className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                </svg>
                GitHub
              </button>
              
              <button
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
                className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
                </svg>
                Google
              </button>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <button 
              onClick={onRegisterClick}
              className="text-orange-500 hover:underline"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}