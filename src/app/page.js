'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase/client'
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

  useEffect(() => {
    fetchPosts(initialType || (pathname === '/newest' ? 'newest' : 'front_page'))
    checkSession()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initialType, pathname])

  useEffect(() => {
    if (pathname === '/newest') {
      fetchPosts('newest')
    } else if (pathname === '/') {
      fetchPosts('front_page')
    }
  }, [pathname])

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserInterests();
    }
  }, [session]);

  async function checkSession() {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
  }

  async function fetchPosts(type = 'front_page') {
    setLoading(true)
    try {
      let query = supabase
        .from('hn_posts')
        .select(`
        id,
        hn_id,
        title,
        url,
        points,
        created_at,
        descendants,
        user_id,
        content_summary
      `)
      
      if (type === 'newest') {
        query = query.order('created_at', { ascending: false })
      }

      const { data: hnPosts = [] } = await query
  
      const formattedHnPosts = (hnPosts || []).map(post => ({
        ...post,
        source: 'hn',
        comments_count: post.descendants,
        user: { username: post.user_id || 'anonymous' },
        comments: post.comments || []
      }))

      setPosts(formattedHnPosts)
    } catch (error) {
      console.error('Error fetching posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchUserInterests() {
    const { data } = await supabase
      .from('user_post_interests')
      .select('post_id, interest_type')
      .eq('user_id', session.user.id);

    const interests = {};
    data?.forEach(item => {
      interests[item.post_id] = item.interest_type;
    });
    setUserInterests(interests);
  }

  const handleUpvote = async (postId) => {
    try {
      const { data: post } = await supabase
        .from('hn_posts')
        .select('points')
        .eq('id', postId)
        .single()
      
      await supabase
        .from('posts')
        .update({ points: (post.points || 0) + 1 })
        .eq('id', postId)
      
      setPosts(posts.map(p => 
        p.id === postId ? { ...p, points: (p.points || 0) + 1 } : p
      ))
    } catch (error) {
      console.error('Error upvoting:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      setIsUserMenuOpen(false)
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
    
    // 如果是对象格式（包含 articleType, contentSummary, keywords）
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
    const interval = setInterval(() => {
      fetchPosts('newest')
    }, 20 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  const handleInterest = async (postId, interest) => {
    if (!session) {
      setIsLoginOpen(true);
      return;
    }
  
    try {
      if (interest === null) {
        await supabase
          .from('user_post_interests')
          .delete()
          .eq('user_id', session.user.id)
          .eq('post_id', postId);
        
        setUserInterests(prev => {
          const newInterests = {...prev};
          delete newInterests[postId];
          return newInterests;
        });
      } else {
        await supabase
          .from('user_post_interests')
          .upsert(
            {
              user_id: session.user.id,
              post_id: postId,
              interest_type: interest
            },
            { onConflict: ['user_id', 'post_id'] }
          );
        
        setUserInterests(prev => ({
          ...prev,
          [postId]: interest
        }));
      }
    } catch (error) {
      console.error('Error updating interest:', error);
    }
  };

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
      {session && (
        <div className="fixed bottom-4 right-4 flex flex-col items-end space-y-2">
          {syncMessage && (
            <div className={`px-4 py-2 rounded-md ${
              syncMessage.includes('成功') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {syncMessage}
            </div>
          )}
          <button
            onClick={handleManualSync}
            disabled={syncLoading}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md shadow-md transition-colors disabled:opacity-50 flex items-center"
          >
            {syncLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                同步中...
              </>
            ) : '手动同步HN数据'}
          </button>
        </div>
      )}

      <header className="bg-orange-500 py-2 px-4 flex justify-between items-center">
  <div className="flex items-center">
    <Link href="/" className="font-bold text-white mr-4 hover:underline flex items-center">
      HPYHN
    </Link>
    <nav className="flex space-x-4 text-sm">
      <Link 
        href="/newest" 
        className="text-white hover:underline"
        onClick={() => fetchPosts('newest')}
      >
        new
      </Link>
      <Link href="/ask" className="text-white hover:underline">ask</Link>
      <Link href="/show" className="text-white hover:underline">show</Link>
      <Link href="/jobs" className="text-white hover:underline">jobs</Link>
    </nav>
  </div>
  {!session && (
    <div className="flex space-x-2">
      <button 
        onClick={() => setIsLoginOpen(true)}
        className="text-white hover:underline text-sm bg-orange-600 px-3 py-1 rounded"
      >
        login
      </button>
    </div>
  )}
  {session && (
    <div className="relative">
      <button 
        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        className="text-white hover:text-gray-200 text-sm flex items-center"
      >
        {session.user.email}
        <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      
      {isUserMenuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )}
</header>
      
      <main className="bg-white">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无文章数据
          </div>
        ) : (
          <ol className="list-none">
            {posts.map((post, index) => (
              <li key={post.id} className="py-2 px-1 hover:bg-gray-50">
                <div className="flex items-baseline">
                  <span className="text-gray-500 mr-1">{index + 1}.</span>
                  {post.source === 'hn' ? (
                    <span className="text-xs bg-orange-100 text-orange-800 px-1 rounded mr-1">HN</span>
                  ) : (
                    <button 
                      onClick={() => handleUpvote(post.hn_id)}
                      className="text-gray-500 hover:text-orange-500 mr-1"
                      aria-label="Upvote"
                    >
                      ▲
                    </button>
                  )}
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
                      {/* 文章类型标签显示在标题后面 */}
                      {post.content_summary && (() => {
                        const summaryData = parseSummaryContent(post.content_summary);
                        if (summaryData && summaryData.articleType && summaryData.articleType !== '无法获取文章类型') {
                          return (
                            <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded ml-1">
                              {summaryData.articleType}
                            </span>
                          );
                        }
                      })()}
                      {post.url && (
                        <span className="text-gray-500 text-xs ml-1">
                          ({new URL(post.url).hostname.replace('www.', '')})
                        </span>
                      )}
                    </div>
                    {/*修改关键字显示部分，限制最多显示12个关键词 */}
                    {post.content_summary && (() => {
                      const summaryData = parseSummaryContent(post.content_summary);
                      if (summaryData && summaryData.keywords && summaryData.keywords !== '无法获取关键词') {
                        // 分割关键词并限制最多显示12个
                        const keywords = summaryData.keywords.split(',').slice(0, 12).join(', ');
                        return (
                          <div className="text-xs text-gray-600 mt-1">
                            关键词: {keywords}
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
                          {post.source === 'hn' && post.comments_count > 0 && (
                            <span className="ml-1">({expandedComments[post.hn_id] ? 'collapse' : 'show top3 comments'})</span>
                          )}
                        </button>
                        {/* 摘要展开/收缩按钮 */}
                        {post.content_summary && (
                          <button 
                            onClick={() => toggleSummary(post.hn_id)}
                            className="hover:underline ml-2"
                          >
                            ({expandedSummaries[post.hn_id] ? 'hide summary' : 'show summary'})
                          </button>
                        )}
                      </div>
                      {session && (
                        <div className="ml-auto">
                          <FacebookReaction 
                            postId={post.hn_id}
                            currentReaction={userInterests[post.hn_id]}
                            onSelect={(postId, reaction) => handleInterest(postId, reaction)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 摘要和关键词显示/隐藏逻辑 */}
                {post.source === 'hn' && expandedSummaries[post.hn_id] && post.content_summary && (
                  <div className="mt-2 ml-6 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-xs font-medium text-blue-800 mb-1">文章摘要:</div>
                    <div className="text-xs text-gray-700">
                      {(() => {
                        const summaryData = parseSummaryContent(post.content_summary);
                        if (!summaryData) return '暂无摘要内容';
                        
                        // 只显示摘要内容，不显示关键词
                        if (summaryData.contentSummary && summaryData.contentSummary !== '无法生成内容摘要') {
                          return <div>{summaryData.contentSummary}</div>;
                        }
                        
                        return '暂无摘要内容';
                      })()}
                    </div>
                  </div>
                )}

                {/* 评论显示/隐藏逻辑 */}
                {post.source === 'hn' && expandedComments[post.hn_id] && (
                  <div className="mt-2 ml-6 space-y-2 border-l-2 pl-2 border-orange-200">
                    {/* 显示实时获取的评论或预加载的评论 */}
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
                    
                    {/* 如果还没有获取实时评论且预加载评论为空，显示加载状态 */}
                    {expandedComments[post.hn_id] && 
                     !liveComments[post.hn_id] && 
                     (!post.comments || post.comments.length === 0) && (
                      <div className="text-xs text-gray-500">
                        正在加载评论...
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
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