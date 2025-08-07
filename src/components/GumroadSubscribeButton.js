import { useState, useEffect } from 'react'

export default function GumroadSubscribeButton({ session, subscription, compact }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSubscribe = () => {
    setLoading(true)
    try {
      window.open(`https://gumroad.com/l/${process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_ID}`, '_blank') // 替换为你的产品链接
    } catch (error) {
      setMessage('无法打开订阅页面')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

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

  return compact ? (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded"
    >
      {loading ? '...' : 'Subscribe'}
    </button>
  ) : (
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