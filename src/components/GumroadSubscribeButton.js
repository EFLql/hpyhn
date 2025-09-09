import { useState } from 'react'

export default function GumroadSubscribeButton({ session, subscription, compact = false, productId }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSubscribe = () => {
    setLoading(true)
    try {
      // 构建包含用户ID的URL
      const userId = session?.user?.id
      if (!userId) {
        setMessage('Please login to subscribe')
        setLoading(false)
        return
      }
      // GA4 Event: Track user reaction
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'subscriptionClick', {
          user_id: userId,
          productId: productId
        });
      }
      
      // 将用户ID作为自定义参数传递给Gumroad，并使用传入的productId
      const gumroadUrl = `https://gumroad.com/l/${productId}?user_id=${userId}`
      window.open(gumroadUrl, '_blank')
    } catch (error) {
      setMessage('cannot open Gumroad')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 如果已经有订阅，显示订阅状态
  if (subscription) {
    return compact ? (
      <div className="px-2 py-1 bg-green-500 text-white text-xs rounded">
        Subscribed
      </div>
    ) : (
      <div className="ml-4 px-3 py-1 bg-green-500 text-white text-sm rounded">
        Subscribed
      </div>
    )
  }

  // 显示订阅按钮
  return compact ? (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded disabled:opacity-50"
    >
      {loading ? '...' : 'Subscribe'}
    </button>
  ) : (
    <div className="ml-4">
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Subscribe'}
      </button>
      {message && <p className="text-red-500 text-xs mt-1">{message}</p>}
    </div>
  )
}