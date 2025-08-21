'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import * as timeago from 'timeago.js'
import LoginModal from '../components/LoginModal'
import RegisterModal from '../components/RegisterModal'
import DOMPurify from 'dompurify';
import { useRouter, usePathname } from 'next/navigation'
import FacebookReaction from '../components/FacebookReaction';

export default function Home({ initialType }) {
  const router = useRouter()
  const pathname = usePathname()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [expandedComments, setExpandedComments] = useState({}) // 记录哪些文章的评论是展开的
  const [expandedSummaries, setExpandedSummaries] = useState({}) // 记录哪些文章的摘要展开
  const [userInterests, setUserInterests] = useState({});
  // 在组件内部添加新的状态来存储实时获取的评论
  const [liveComments, setLiveComments] = useState({}); // 存储实时获取的评论
  // 添加分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 30; // 每页显示30条数据
  const [expandedTexts, setExpandedTexts] = useState({}); // 记录哪些文章的正文是展开的
  const [subscription, setSubscription] = useState(null)
  const [interestScores, setInterestScores] = useState({});
  const [originalPosts, setOriginalPosts] = useState([]); // 新增：保存原始帖子顺序
  const [isSortedByInterest, setIsSortedByInterest] = useState(false); // 新增：跟踪排序状态

  useEffect(() => {
  const fetchSubscription = async () => {
    if (!session?.user?.id) return
    
    try {
      const response = await fetch('/api/subscription')
      const data = await response.json()
      
      if (response.ok) {
        setSubscription(data)
      } else {
        console.error('Failed to fetch subscription:', data.error)
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
    }
  }
  
  fetchSubscription()
}, [session])

  // 在组件顶部添加这个函数
  function getPostType(initialType, pathname) {
    let type = initialType || (pathname === '/news' ? 'news' : 'front-page')

    // Handle tab navigation
    if (pathname === '/newest') {
      type = 'news'
    } else if (pathname === '/ask') {
      type = 'ask'
    } else if (pathname === '/show') {
      type = 'show'
    } else if (pathname === '/') {
      type = 'front-page'
    }
    
    return type;
  }
   const postType = useMemo(() => {
    return getPostType(initialType, pathname);
  }, [initialType, pathname]);

  const lastPostTypeRef = useRef();

  useEffect(() => {
    if (lastPostTypeRef.current === postType) {
      // postType没有变化，不需要fetch
      return;
    }
    lastPostTypeRef.current = postType;

    let cancelled = false;
    let mainInterval;
    let isFetching = false;

    console.log('Main useEffect triggered', { postType, initialType, pathname });

    const fetchData = async () => {
      if (isFetching) {
        console.log('Already fetching, skipping');
        return;
      }
      isFetching = true;
      if (cancelled) {
        console.log('Cancelled before fetch');
        isFetching = false;
        return;
      }
      try {
        console.log('Fetching posts for type:', postType);
        await fetchPosts(postType);
        if (cancelled) {
          console.log('Cancelled after fetchPosts');
          isFetching = false;
          return;
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error in main useEffect:', error);
        }
      } finally {
        isFetching = false;
      }
    };

    console.log('Fetching session');
    checkSession();
    if (!cancelled) {
      mainInterval = setInterval(() => {
        if (!cancelled) {
          console.log('Polling session');
          checkSession();
        }
      }, 60000) // 每分钟检查一次会话状态
    }

    fetchData();
    
    return () => {
      console.log('Main useEffect cleanup', { postType, initialType, pathname });
      cancelled = true;
      if (mainInterval) {
        clearInterval(mainInterval);
      }
    }
  }, [postType]) // 只依赖postType，确保只在postType改变时触发

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserInterests();
    }
  }, [session])

  // 定时轮询获取分数
  useEffect(() => {
    let interval;
    const fetchInterestScores = async () => {
      try {
        // 检查用户是否有订阅
        if (!subscription || subscription.status != "active") {
          return;
        }

        // 假设接口返回 { [postId]: score }
        const params = new URLSearchParams({
          user_id: session?.user?.id || '',
          postType: postType || 'front-page'
        });
        if (params.get('user_id') == '')
          return;
        const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hyphn-kv.1633121980.workers.dev';
        const response = await fetch(`${cloudflareWorkerUrl}/api/user-interest-score?${params}`);
        const data = await response.json();
        if (response.ok) {
          setInterestScores(data);
        }
      } catch (error) {
        console.error('Error fetching interest scores:', error);
      }
    };

    // 只在用户有订阅时启动轮询
    if (subscription && subscription.status == "active") {
      fetchInterestScores();
      interval = setInterval(fetchInterestScores, 60000); // 每分钟轮询
    }

    return () => clearInterval(interval);
  }, [session?.user?.id, subscription]); // 添加 subscription 作为依赖

  async function checkSession() {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      
      if (response.ok) {
        setSession(data.session)
      } else {
        setSession(null)
      }
    } catch (error) {
      console.error('Error checking session:', error)
      setSession(null)
    }
  }

  // -------------------------------------------------
  // Modified helper: sort posts by interest scores with toggle functionality
  // -------------------------------------------------
  const sortPostsByInterest = () => {
    if (subscription && subscription.status === "active") {
      if (isSortedByInterest) {
        // 恢复原始顺序
        setPosts(originalPosts);
        setIsSortedByInterest(false);
      } else {
        // 按兴趣排序
        const sorted = [...posts].sort((a, b) => {
          const scoreA = interestScores[a.id] || 0;
          const scoreB = interestScores[b.id] || 0;
          if (scoreA === scoreB) {
            return (b.points || 0) - (a.points || 0);
          }
          return scoreB - scoreA;
        });
        setPosts(sorted);
        setIsSortedByInterest(true);
      }
    } else {
      console.warn('Sorting by interest requires an active subscription.');
    }
  };

  async function fetchPosts(type = 'front_page') {
    setLoading(true)
    try {
      // 首先尝试调用Cloudflare Worker接口
      const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hyphn-kv.1633121980.workers.dev';
      const response = await fetch(`${cloudflareWorkerUrl}/api/posts?type=${type}`)
      const data = await response.json()
      //console.Console.log('Fetched posts:', data)
      if (response.ok) {
        // 保存原始数据并重置排序状态
        setOriginalPosts(data);
        setPosts(data);
        setIsSortedByInterest(false);
      } else {
        // 如果Cloudflare Worker接口返回错误，尝试回退到后端接口
        console.warn('Cloudflare Worker API failed, falling back to backend API')
        const fallbackResponse = await fetch(`/api/posts?type=${type}`)
        const fallbackData = await fallbackResponse.json()

        if (fallbackResponse.ok) {
          // 保存原始数据并重置排序状态
          setOriginalPosts(fallbackData);
          setPosts(fallbackData);
          setIsSortedByInterest(false);
        } else {
          console.error('Failed to fetch posts from backend:', fallbackData.error)
          setPosts([])
        }
      }
    } catch (error) {
      // 如果Cloudflare Worker接口网络错误，尝试回退到后端接口
      console.warn('Cloudflare Worker API failed, falling back to backend API:', error)
      try {
        const fallbackResponse = await fetch(`/api/posts?type=${type}`)
        const fallbackData = await fallbackResponse.json()

        if (fallbackResponse.ok) {
          // 保存原始数据并重置排序状态
          setOriginalPosts(fallbackData);
          setPosts(fallbackData);
          setIsSortedByInterest(false);
        } else {
          console.error('Failed to fetch posts from backend:', fallbackData.error)
          setPosts([])
        }
      } catch (fallbackError) {
        console.error('Error fetching posts from both APIs:', fallbackError)
        setPosts([])
      }
    } finally {
      setLoading(false)
    }
}

    async function fetchUserInterests() {
    try {
      // 首先尝试调用Cloudflare Worker接口
      const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hyphn-kv.1633121980.workers.dev';
      console.log('Fetching user interests from Cloudflare Worker:', cloudflareWorkerUrl);
      const cloudflareResponse = await fetch(`${cloudflareWorkerUrl}/api/user-interests?user_id=${session?.user?.id}`);
      
      const cloudflareData = await cloudflareResponse.json();
      
      if (cloudflareResponse.ok) {
        setUserInterests(cloudflareData);
      } else {
        // 如果Cloudflare Worker接口返回错误，尝试回退到后端接口
        console.warn('Cloudflare Worker API failed, falling back to backend API');
        const fallbackResponse = await fetch('/api/user-interests');
        const fallbackData = await fallbackResponse.json();
  
        if (fallbackResponse.ok) {
          setUserInterests(fallbackData);
        } else {
          console.error('Failed to fetch user interests from backend:', fallbackData.error);
        }
      }
    } catch (error) {
      // 如果Cloudflare Worker接口网络错误，尝试回退到后端接口
      console.warn('Cloudflare Worker API failed, falling back to backend API:', error);
      try {
        const fallbackResponse = await fetch('/api/user-interests');
        const fallbackData = await fallbackResponse.json();
  
        if (fallbackResponse.ok) {
          setUserInterests(fallbackData);
        } else {
          console.error('Failed to fetch user interests from backend:', fallbackData.error);
        }
      } catch (fallbackError) {
        console.error('Error fetching user interests from both APIs:', fallbackError);
      }
    }
  }

  const handleInterest = async (postId, interest) => {
    if (!session) {
      setIsLoginOpen(true);
      return;
    }
  
    try {
      // 首先尝试调用Cloudflare Worker接口
      const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hyphn-kv.1633121980.workers.dev';
      console.log('Fetching user interests from Cloudflare Worker:', cloudflareWorkerUrl);
      const cloudflareResponse = await fetch(`${cloudflareWorkerUrl}/api/user-interests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, interest, user_id: session.user.id })
      });
      
      const cloudflareData = await cloudflareResponse.json();
      
      if (cloudflareResponse.ok) {
        if (interest === null) {
          setUserInterests(prev => {
            const newInterests = {...prev};
            delete newInterests[postId];
            return newInterests;
          });
        } else {
          setUserInterests(prev => ({
            ...prev,
            [postId]: interest
          }));
        }
      } else {
        // 如果Cloudflare Worker接口返回错误，尝试回退到后端接口
        console.warn('Cloudflare Worker API failed, falling back to backend API');
        const fallbackResponse = await fetch('/api/user-interests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ postId, interest })
        });
        
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackResponse.ok) {
          if (interest === null) {
            setUserInterests(prev => {
              const newInterests = {...prev};
              delete newInterests[postId];
              return newInterests;
            });
          } else {
            setUserInterests(prev => ({
              ...prev,
              [postId]: interest
            }));
          }
        } else {
          console.error('Failed to update interest from backend:', fallbackData.error);
        }
      }
    } catch (error) {
      // 如果Cloudflare Worker接口网络错误，尝试回退到后端接口
      console.warn('Cloudflare Worker API failed, falling back to backend API:', error);
      try {
        const fallbackResponse = await fetch('/api/user-interests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ postId, interest })
        });
        
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackResponse.ok) {
          if (interest === null) {
            setUserInterests(prev => {
              const newInterests = {...prev};
              delete newInterests[postId];
              return newInterests;
            });
          } else {
            setUserInterests(prev => ({
              ...prev,
              [postId]: interest
            }));
          }
        } else {
          console.error('Failed to update interest from backend:', fallbackData.error);
        }
      } catch (fallbackError) {
        console.error('Error updating interest from both APIs:', fallbackError);
      }
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })
      
      if (response.ok) {
        setSession(null)
        setIsUserMenuOpen(false)
        router.push('/')
      } else {
        console.error('Failed to logout')
      }
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const handleManualSync = async () => {
    setSyncLoading(true)
    setSyncMessage(null)
    
    try {
      const response = await fetch('/api/sync-hn-posts')
      const result = await response.json()
      
      if (result.success) {
        setSyncMessage('同步成功！')
        await fetchPosts()
      } else {
        setSyncMessage(`同步失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      setSyncMessage(`请求失败: ${error.message}`)
    } finally {
      setSyncLoading(false)
      setTimeout(() => setSyncMessage(null), 3000)
    }
  }

  const toggleText = (postId) => {
    setExpandedTexts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }))
  }

  const toggleComments = async (postId) => {
    const newState = !expandedComments[postId];
    
    setExpandedComments(prev => ({
      ...prev,
      [postId]: newState
    }))
    
    // 如果是展开评论且还没有获取过实时评论，则获取实时评论
    if (newState && !liveComments[postId]) {
      await fetchLiveComments(postId);
    }
  }

  // 新增切换摘要展开/收缩的函数
  const toggleSummary = (postId) => {
    setExpandedSummaries(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }))
  }

  const formatCommentText = (text) => {
    if (!text) return ''
    
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ['a', 'p', 'em', 'strong', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'class']
    })
    .replace(/<a\s+href="([^"]+)"[^>]*>/g, 
      '<a href="$1" class="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">')
    .replace(/<p>/g, '<p class="mt-2">');
  }

  // 解析摘要内容的函数
  const parseSummaryContent = (summary) => {
    if (!summary) return null;
    
    // 如果是对象格式（包含 type, contentSummary, keywords）
    if (typeof summary === 'object') {
      return summary;
    }
    
    // 如果是字符串格式，尝试解析
    if (typeof summary === 'string') {
      try {
        // 尝试解析为 JSON
        const parsed = JSON.parse(summary);
        return parsed;
      } catch (e) {
        // 如果不是 JSON，当作纯文本处理
        return {
          contentSummary: summary
        };
      }
    }
    
    return null;
  }

    useEffect(() => {
    // 只有在首页时才定时刷新
    if (pathname === '/') {
      console.log('Setting up scheduled fetch for front-page');
      const interval = setInterval(() => {
        console.log('Scheduled fetchPosts for front-page');
        fetchPosts('front-page')
      }, 20 * 60 * 1000)
      
      return () => {
        console.log('Clearing scheduled fetch for front-page');
        clearInterval(interval)
      }
    }
  }, [pathname]) // 只依赖pathname

  // 新增实时获取评论的函数 - 优化版本
  const fetchLiveComments = async (postId) => {
    try {
      console.log(`Fetching live comments for post ${postId}...`);
      
      // 首先从 Firebase API 获取帖子详情，获取排序后的评论ID
      const firebaseResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${postId}.json?print=pretty`, {
        // 添加缓存控制
        cache: 'force-cache',
        next: { revalidate: 300 }, // 5分钟缓存
        headers: {
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=60'
        }
      });
      
      if (!firebaseResponse.ok) {
        throw new Error(`获取帖子详情失败: ${firebaseResponse.status}`);
      }
      
      const postData = await firebaseResponse.json();
      const topCommentIds = postData?.kids?.slice(0, 3) || []; // 获取前3个评论ID
      
      if (topCommentIds.length === 0) {
        console.log(`文章 ${postId} 没有评论`);
        setLiveComments(prev => ({
          ...prev,
          [postId]: []
        }));
        return [];
      }
      
      // 对每条评论单独调用 hn.algolia.com 接口获取详情
      const commentPromises = topCommentIds.map(async (commentId) => {
        try {
          const commentResponse = await fetch(`https://hn.algolia.com/api/v1/items/${commentId}`, {
            // 添加缓存控制
            cache: 'force-cache',
            next: { revalidate: 300 }, // 5分钟缓存
            headers: {
              'Connection': 'keep-alive',
              'Keep-Alive': 'timeout=60'
            }
          });
          
          if (!commentResponse.ok) {
            console.error(`获取评论 ${commentId} 失败: ${commentResponse.status}`);
            return null;
          }
          
          const commentData = await commentResponse.json();
          return commentData;
        } catch (error) {
          console.error(`获取评论 ${commentId} 失败:`, error);
          return null;
        }
      });
      
      // 等待所有评论获取完成
      const comments = await Promise.all(commentPromises);
      
      // 过滤掉获取失败的评论并格式化
      const formattedComments = comments
        .filter(comment => comment && comment.text) // 过滤掉空评论
        .map(comment => ({
          id: comment.id,
          text: comment.text || '',
          created_at: new Date(comment.created_at_i * 1000).toISOString(),
          user_id: comment.author || 'anonymous'
        }));
      
      // 更新状态
      setLiveComments(prev => ({
        ...prev,
        [postId]: formattedComments
      }));
      
      return formattedComments;
    } catch (error) {
      console.error(`获取文章 ${postId} 的实时评论失败:`, error);
      // 即使出错也要更新状态，避免无限加载
      setLiveComments(prev => ({
        ...prev,
        [postId]: []
      }));
      return [];
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-2 bg-orange-50 relative min-h-screen">

      {/* ====================  Header ==================== */}
      <header className="bg-orange-500 py-2 px-4 flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-bold text-white mr-4 hover:underline flex items-center">
            HPYHN
          </Link>

          {/* Navigation */}
          <nav className="flex space-x-4 text-sm">
            <Link href="/newest" className="text-white hover:underline"
              onClick={() => setCurrentPage(1)}>
              new
            </Link>
            <Link href="/ask" className="text-white hover:underline"
              onClick={() => setCurrentPage(1)}>
              ask
            </Link>
            <Link href="/show" className="text-white hover:underline"
              onClick={() => setCurrentPage(1)}>
              show
            </Link>
          </nav>
        </div>
        {/* User / login area */}
        {!session ? (
          <div className="flex space-x-2 mt-2 md:mt-0">
            <button
              onClick={() => setIsLoginOpen(true)}
              className="text-white hover:underline text-sm bg-orange-600 px-3 py-1 rounded"
            >
              login
            </button>
          </div>
        ) : (
          <div className="relative flex items-center mt-2 md:mt-0">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="text-white hover:text-gray-200 text-sm flex items-center ml-2 relative z-30"
            >
              {session.user.email}
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
            
            {isUserMenuOpen && (
              <>
                {/* 点击空白处关闭菜单的遮罩层 */}
                <div 
                  className="fixed inset-0 z-20 bg-black bg-opacity-10"
                  onClick={() => setIsUserMenuOpen(false)}
                />
                {/* 菜单内容 */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-30">
                  <Link 
                    href="/account" 
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Account Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* ====================  Main content ==================== */}
      <main className="bg-white">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No posts available
          </div>
        ) : (
          <>
            <ol className="list-none">
              {/* Calculate data to display for current page */}
              {posts
                .slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage)
                .map((post, index) => (
                  <li key={post.id} className="py-2 px-1 hover:bg-gray-50">
                    <div className="flex items-baseline">
                        <span className="text-gray-500 mr-1">{(currentPage - 1) * postsPerPage + index + 1}.</span>
                        <div className="flex flex-col h-full mr-1">
                          <span className="text-xs  w-8 h-5 bg-orange-100 text-orange-800 px-1 rounded mt-1 flex items-center justify-center">HN</span>
                          <div className="flex-1" />
                          <div className="flex items-center">
                            <span className="mt-auto mb-auto w-8 h-8 flex items-center justify-center text-sm bg-purple-50 text-purple-700 rounded-full font-bold">
                              {interestScores[post.id] ?? 0}%
                            
                            {/* Only show sort icon next to first post's interest score */}
                            {index === 0 && subscription?.status === 'active' && (
                              <div className="relative group ml-1">
                                <button
                                  onClick={sortPostsByInterest}
                                  className="text-gray-500 hover:text-orange-500 focus:outline-none"
                                  aria-label="Sort by Interest"
                                >
                                  <svg className="w-7 h-7" fill="none" stroke="red" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10l4-4 4 4M8 14l4 4 4-4"></path>
                                  </svg>
                                </button>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  Sort by your interests
                                </div>
                              </div>
                            )}
                            </span>
                          </div>
                          <div className="flex-1" />
                        </div>
                        <div className="flex-1">
                        <div className="flex flex-wrap items-baseline">
                          <a 
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-black hover:underline mr-1"
                          >
                            {post.title}
                          </a>

                          {/* Article type tag displayed after title */}
                          {post.content_summary && (() => {
                            const summaryData = parseSummaryContent(post.content_summary);
                            if (summaryData && summaryData.type && summaryData.type !== 'Unable to get article type') {
                              return (
                                <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded ml-1">
                                  {summaryData.type}
                                </span>
                              );
                            }
                          })()}
                          {post.url && (
                            <span className="text-gray-500 text-xs ml-1">
                              ({new URL(post.url).hostname.replace('www.', '')})
                            </span>
                          )}
                          {/* Hacker News original post link positioned at top-right of title */}
                          {post.hn_id && (
                            <a 
                              href={`https://news.ycombinator.com/item?id=${post.hn_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline ml-2 text-orange-600 font-medium text-xs"
                            >
                              view on HN
                            </a>
                          )}
                        </div>
                        
                        {/* Modify keyword display section, limit to maximum 12 keywords */}
                        {post.content_summary && (() => {
                          const summaryData = parseSummaryContent(post.content_summary);
                          if (summaryData && summaryData.keywords && summaryData.keywords !== 'Unable to get keywords') {
                            // 分割关键词并渲染为 badge
                            const keywordsArr = summaryData.keywords.split(',').slice(0, 12);
                            return (
                              <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1">
                                {keywordsArr.map((kw, idx) => (
                                  <span key={idx} className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded">{kw.trim()}</span>
                                ))}
                              </div>
                            );
                          }
                        })()}
                        <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
                          <div>
                            {post.points || 0} points by {post.user?.username || 'anonymous'} {timeago.format(new Date(post.created_at))} | 
                            <button 
                              onClick={() => toggleComments(post.hn_id)}
                              className="hover:underline ml-1"
                            >
                              {post.comments_count || 0} comments
                              {post.comments_count > 0 && (
                                <span className="ml-1">({expandedComments[post.hn_id] ? 'collapse' : 'show top3 comments'})</span>
                              )}
                            </button>
                            {post.text && (
                              <button
                                onClick={() => toggleText(post.hn_id)}
                                className={`hover:underline ml-2 ${post.text ? 'text-green-600 font-medium' : 'text-gray-500'}`}
                              >
                                {expandedTexts[post.hn_id] ? 'hide post text' : 'show post text'}
                              </button>
                            )}
                            {/* Summary expand/collapse button */}
                            {post.content_summary && (
                              <button 
                                onClick={() => toggleSummary(post.hn_id)}
                                className={`hover:underline ml-2 ${post.content_summary ? 'text-blue-600 font-medium' : 'text-gray-500'}`}
                              >
                                {expandedSummaries[post.hn_id] ? 'hide summary' : 'show summary'}
                              </button>
                            )}
                          </div>
                          {(
                            <div className="ml-auto">
                              <FacebookReaction 
                                postId={post.id}
                                currentReaction={session ? userInterests[post.id] : null}
                                onSelect={(postId, reaction) => {
                                  if (!session) {
                                    setIsLoginOpen(true);
                                  } else {
                                    handleInterest(postId, reaction);
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Summary and keywords show/hide logic */}
                    {expandedSummaries[post.hn_id] && post.content_summary && (
                      <div className="mt-2 ml-6 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="text-xs font-medium text-blue-800 mb-1">Article Summary:</div>
                        <div className="text-xs text-gray-700">
                          {(() => {
                            const summaryData = parseSummaryContent(post.content_summary);
                            if (!summaryData) return 'No summary content available';
                            
                            // Only display summary content, not keywords
                            if (summaryData.content && summaryData.content !== 'Unable to generate content summary') {
                              return <div>{summaryData.content}</div>;
                            }
                            
                            return 'No summary content available';
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Comments show/hide logic */}
                    {expandedComments[post.hn_id] && (
                      <div className="mt-2 ml-6 space-y-2 border-l-2 pl-2 border-orange-200">
                        <div className="text-xs font-medium text-orange-800 mb-1">Top 3 Comments:</div>
                        {/* Display live comments or preloaded comments */}
                        {(liveComments[post.hn_id] || post.comments || []).map(comment => (
                          <div key={comment.id} className="text-xs text-gray-600">
                            <div className="font-medium text-gray-800">
                              {comment.user_id || 'anonymous'} · 
                              {timeago.format(new Date(comment.created_at))}
                            </div>
                            <div 
                              className="mt-1 whitespace-pre-wrap break-words prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: formatCommentText(comment.text) }}
                            />
                          </div>
                        ))}
                        
                        {/* If live comments haven't been fetched yet and preloaded comments are empty, show loading state */}
                        {expandedComments[post.hn_id] && 
                         !liveComments[post.hn_id] && 
                         (!post.comments || post.comments.length === 0) && (
                          <div className="text-xs text-gray-500">
                            Loading comments...
                          </div>
                        )}
                      </div>
                    )}

                    {/* Post text show/hide logic */}
                    {expandedTexts[post.hn_id] && post.text && (
                      <div className="mt-2 ml-6 p-3 bg-green-50 rounded border border-green-200">
                        <div className="text-xs font-medium text-green-800 mb-1">Post Text:</div>
                        <div 
                          className="text-xs text-gray-700 whitespace-pre-wrap break-words prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: formatCommentText(post.text) }}
                        />
                      </div>
                    )}
                  </li>
              ))}
            </ol>
            
            {/* ====================  Pagination (bottom) ==================== */}
            <div className="flex justify-center items-center py-4 space-x-2">
              {/* Pagination controls only – the manual sort button has been removed from here */}
              <button
                onClick={() => {
                  setCurrentPage(prev => Math.max(prev - 1, 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded ${
                  currentPage === 1
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Page {currentPage} of {Math.ceil(posts.length / postsPerPage)}
              </span>
              
              <button
                onClick={() => {
                  setCurrentPage(prev => Math.min(prev + 1, Math.ceil(posts.length / postsPerPage)));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === Math.ceil(posts.length / postsPerPage)}
                className={`px-3 py-1 rounded ${
                  currentPage === Math.ceil(posts.length / postsPerPage)
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
      
      <footer className="text-center py-4 text-xs text-gray-500">
        <Link href="/submit" className="hover:underline">submit</Link> | 
        <Link href="/guidelines" className="hover:underline ml-1">guidelines</Link> | 
        <Link href="/faq" className="hover:underline ml-1">FAQ</Link> | 
        <Link href="/api" className="hover:underline ml-1">API</Link>
      </footer>

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)}
        onRegisterClick={() => {
          setIsLoginOpen(false)
          setIsRegisterOpen(true)
        }}
      />

      <RegisterModal 
        isOpen={isRegisterOpen} 
        onClose={() => setIsRegisterOpen(false)}
        onLoginClick={() => {
          setIsRegisterOpen(false)
          setIsLoginOpen(true)
        }}
      />
    </div>
  )
}