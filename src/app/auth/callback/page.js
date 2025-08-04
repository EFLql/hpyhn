'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../utils/supabase/client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthStateChange = async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // 用户已登录，重定向到主页
        router.push('/')
        router.refresh()
      }
    }

    // 监听认证状态变化
    const { data: authListener } = supabase.auth.onAuthStateChange(handleAuthStateChange)

    // 检查当前会话
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/')
        router.refresh()
      }
    }

    checkSession()

    // 清理监听器
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-orange-500 font-medium">Processing authentication...</p>
      </div>
    </div>
  )
}