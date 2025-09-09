import { useState, useEffect } from 'react'

export default function GumroadSubscribeButton({ session, subscription, compact = false, productId }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [clientId, setClientId] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    // Helper function to get a cookie by name
    const getCookie = (name) => {
      if (typeof document === 'undefined') return null; // Ensure document is available
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    };

    // Get Client ID from _ga cookie
    const gaCookie = getCookie('_ga');
    if (gaCookie) {
      const gaParts = gaCookie.split('.');
      // _ga cookie format: GAx.y.client_id_part1.client_id_part2
      if (gaParts.length > 3) {
        setClientId(`${gaParts[2]}.${gaParts[3]}`);
      }
    }

    // Get Session ID from _ga_<measurement_id> cookie
    // Iterate through cookies to find any cookie starting with _ga_
    if (typeof document !== 'undefined') {
      const allCookies = document.cookie.split(';');
      let foundSessionId = null;
      for (let i = 0; i < allCookies.length; i++) {
        let cookie = allCookies[i].trim();
        if (cookie.startsWith('_ga_27NFWGZ38B')) {
          const ga4SessionCookieValue = cookie.split('=')[1];
          if (ga4SessionCookieValue) {
            const ga4SessionParts = ga4SessionCookieValue.split('.');
            // _ga_<measurement_id> cookie format: GSx.y.sSESSION_ID$OTHER_STUFF.timestamp
            if (ga4SessionParts.length > 2) {
              // Extract the session ID part (e.g., "s1757421343$o13$g1$t1757425846$j60$l1$h1871338589")
              let rawSessionIdWithSuffix = ga4SessionParts[2];
              
              // Remove the 's' prefix if present
              if (rawSessionIdWithSuffix.startsWith('s')) {
                rawSessionIdWithSuffix = rawSessionIdWithSuffix.substring(1);
              }
              
              // Take only the part before the first '$'
              const dollarIndex = rawSessionIdWithSuffix.indexOf('$');
              if (dollarIndex !== -1) {
                foundSessionId = rawSessionIdWithSuffix.substring(0, dollarIndex);
              } else {
                foundSessionId = rawSessionIdWithSuffix;
              }
              break; // Found the session ID, no need to check other _ga_ cookies
            }
          }
        }
      }
      if (foundSessionId) {
        setSessionId(foundSessionId);
      }
    }
  }, []); // Empty dependency array means this effect runs once on mount

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
      
      // GTM Event: Track user reaction
      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push({
          'event': 'subscription',
          'productId': productId,
        });
      }
      
      // 将用户ID、client_id和session_id作为自定义参数传递给Gumroad
      let gumroadUrl = `https://gumroad.com/l/${productId}?user_id=${userId}`
      if (clientId) {
        gumroadUrl += `&client_id=${clientId}`;
      }
      if (sessionId) {
        gumroadUrl += `&session_id=${sessionId}`;
      }
      console.log(`gumroadUrl=${gumroadUrl}`)

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