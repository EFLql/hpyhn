'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import * as timeago from 'timeago.js'
import LoginModal from '../components/LoginModal'
import RegisterModal from '../components/RegisterModal'
import DOMPurify from 'dompurify';
import { useRouter, usePathname } from 'next/navigation'
import FacebookReaction from '../components/FacebookReaction';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import remarkGfm from 'remark-gfm'; // Import remarkGfm

export default function Home({ initialType, session: dontMissSession, subscription: dontMissSubscription, loading: dontMissLoading, isLoginOpen: dontMissIsLoginOpen, setIsLoginOpen: setDontMissIsLoginOpen }) {
  const router = useRouter()
  const pathname = usePathname()
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true) // Renamed from setLoading to avoid conflict with dontMissLoading
  const [userSession, setUserSession] = useState(null) // Renamed from setSession to avoid conflict with dontMissSession
  const [homeIsLoginOpen, setHomeIsLoginOpen] = useState(false) // Renamed to avoid conflict with dontMissIsLoginOpen
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
  const [subscriptionStatus, setSubscriptionStatus] = useState(null) // Renamed from setSubscription to avoid conflict with dontMissSubscription
  const [interestScores, setInterestScores] = useState({});
  const [originalPosts, setOriginalPosts] = useState([]); // 新增：保存原始帖子顺序
  const [isSortedByInterest, setIsSortedByInterest] = useState(false); // 新增：跟踪排序状态
  const [dontMissCount, setDontMissCount] = useState(0); // New state for Don't Miss count
  const [readPosts, setReadPosts] = useState([]); // New state to track read posts for visual feedback
  const [selectedPosts, setSelectedPosts] = useState([]);

  // Create a ref to hold the latest interestScores
  const latestInterestScores = useRef(interestScores);

  // Determine which session and subscription to use based on initialType
  const currentSession = initialType === 'dont-miss' ? dontMissSession : userSession;
  const currentSubscription = initialType === 'dont-miss' ? dontMissSubscription : subscriptionStatus;
  const currentLoading = initialType === 'dont-miss' ? dontMissLoading : loadingPosts;
  const currentIsLoginOpen = initialType === 'dont-miss' ? dontMissIsLoginOpen : homeIsLoginOpen;
  const currentSetIsLoginOpen = initialType === 'dont-miss' ? setDontMissIsLoginOpen : setHomeIsLoginOpen;


  useEffect(() => {
  const fetchSubscription = async () => {
    if (!currentSession?.user?.id) {
      return;
    }
    
    try {
      const response = await fetch('/api/subscription')
      const data = await response.json()
      
      if (response.ok) {
        setSubscriptionStatus(data) // Use internal state for general subscription
      } else {
        console.error('Failed to fetch subscription:', data.error)
        setSubscriptionStatus(null)
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
      setSubscriptionStatus(null)
    }
  }
  
  fetchSubscription()
}, [currentSession]) // Depend on currentSession

  // Dedicated useEffect for GTM user_id and page_view management
  useEffect(() => {
    // Check if dataLayer is available before attempting to use it
    if (typeof window === 'undefined' || !window.dataLayer) {
      console.warn('GTM: dataLayer is not defined. Google Tag Manager tracking might not be active.');
      return;
    }

    // Handle initial page load
    if (currentSession?.user?.id) {
      const userIdToSet = currentSession.user.id;
      console.log(`GTM: User logged in. Setting user_id=${userIdToSet}`);
      
      window.dataLayer.push({
        'event': 'login_success',
        'user_id': userIdToSet
      });
      window.dataLayer.push({
        'event': 'page_view',
        'page_path': pathname,
        'page_location': window.location.href,
        'page_title': document.title,
        'user_id': userIdToSet
      });
    } else {
      console.log(`GTM: User logged out or no session. Clearing user_id`);
      
      window.dataLayer.push({
        'event': 'user_id_ready',
        'user_id': undefined // Clear user_id
      });
      window.dataLayer.push({
        'event': 'page_view',
        'page_path': pathname,
        'page_location': window.location.href,
        'page_title': document.title,
      });
    }

    // Handle client-side route changes
    const handleRouteChange = (url) => {
      window.dataLayer.push({
        'event': 'page_view',
        'page_path': url,
        'page_location': window.location.href,
        'page_title': document.title,
      });
    };

    //router.events.on('routeChangeComplete', handleRouteChange);

    // Cleanup function for useEffect
    return () => {
      //router.events.off('routeChangeComplete', handleRouteChange);
      console.log('GTM: Cleanup - routeChangeComplete event listener removed.');
    };

  }, [currentSession, pathname]); // Depend on currentSession, pathname, and router.events

  // 在组件顶部添加这个函数
  function getPostType(initialType, pathname) {
    if (initialType) return initialType;
    if (pathname === '/newest') return 'newest';
    if (pathname === '/ask') return 'ask';
    if (pathname === '/show') return 'show';
    if (pathname === '/dont-miss') return 'dont-miss';
    if (pathname === '/favorites') return 'favorites'; // Add this line
    return 'front-page';
}
   const postType = useMemo(() => {
    return getPostType(initialType, pathname);
  }, [initialType, pathname]);

  // New useEffect for polling dontMissCount
  useEffect(() => {
    let interval;
    const fetchDontMissCount = async () => {
      // Log values before the condition to accurately see the state
      console.log('fetchDontMissCount - Checking conditions:', {
        userId: currentSession?.user?.id,
        subscriptionStatus: currentSubscription?.status,
        currentSubscriptionObject: currentSubscription, // Log the full object
        postType: postType // Keep postType in log for context, but not in condition
      });

      // The condition should only check for login and active subscription, not postType
      if (!currentSession?.user?.id || !currentSubscription || currentSubscription.status !== 'active') {
        setDontMissCount(0); // Reset count if conditions are not met
        console.log(`dont-miss pull failed: User not logged in or subscription not active. userId: ${currentSession?.user?.id}, subscriptionStatus: ${currentSubscription?.status}`);
        return;
      }
      try {
        const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hpyhn.xyz/worker';
        const response = await fetch(`${cloudflareWorkerUrl}/api/dont-miss?queryCount=true&user_id=${currentSession.user.id}`);
        const data = await response.json();
        if (response.ok && typeof data.count === 'number') {
          setDontMissCount(data.count);
        } else {
          console.error('Failed to fetch dontMissCount:', data.error);
          setDontMissCount(0);
        }
      } catch (error) {
        console.error('Error fetching dontMissCount:', error);
        setDontMissCount(0);
      }
    };

    fetchDontMissCount(); // Fetch immediately on component mount/dependency change
    interval = setInterval(fetchDontMissCount, 60000); // Poll every minute

    // Dependencies should only be currentSession and currentSubscription, as postType is irrelevant for the header count
    return () => clearInterval(interval); // Cleanup interval on unmount
  }, [currentSession, currentSubscription]);
  
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
        let sessionCheck;
        sessionCheck = await checkSession();

        await fetchPosts(postType, sessionCheck);
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
  }, [postType, currentSession]) // Depend on postType and currentSession

  useEffect(() => {
    let interval;
    if (currentSession?.user?.id) {
      fetchUserInterests();
      interval = setInterval(fetchUserInterests, 60000); // 每分钟轮询
    }
    return () => clearInterval(interval);
  }, [currentSession])

  // Update the ref whenever interestScores state changes
  useEffect(() => {
    latestInterestScores.current = interestScores;
  }, [interestScores]);

  // 定时轮询获取分数
  useEffect(() => {
    let interval;
    const fetchInterestScores = async () => {
      try {
        //console.log(`interestScores: ${JSON.stringify(Object.keys(latestInterestScores.current))}`)
        // 检查当前分数列表是否为空，非空则跳过API调用
        if (Object.keys(latestInterestScores.current).length > 0) {
          return;
        }
        // 检查用户是否有订阅
        if (!currentSubscription || currentSubscription.status != "active") {
          return;
        }

        // 假设接口返回 { [postId]: score }
        const params = new URLSearchParams({
          user_id: currentSession?.user?.id || '',
          postType: postType || 'front-page'
        });
        if (params.get('user_id') == '' || params.get('postType') == 'favorites')
          return;
        const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hpyhn.xyz/worker';
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
    if (currentSubscription && currentSubscription.status == "active") {
      fetchInterestScores();
      interval = setInterval(fetchInterestScores, 60000); // 每分钟轮询
    }

    return () => clearInterval(interval);
  }, [currentSession?.user?.id, currentSubscription, postType]); // Depend on currentSession and currentSubscription

  async function checkSession() {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      
      if (response.ok) {
        setUserSession(data.session) // Use internal state for general session
        return data.session; // Return session data
      } else {
        setUserSession(null)
        return null;
      }
    } catch (error) {
      console.error('Error checking session:', error)
      setUserSession(null)
      return null;
    }
  }


  // -------------------------------------------------
  // Modified helper: sort posts by interest scores with toggle functionality
  // -------------------------------------------------
  const sortPostsByInterest = () => {
    if (currentSubscription && currentSubscription.status === "active") {
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

    async function fetchPosts(type = 'front-page', sessionCheck = null) {
      let user_id = sessionCheck?.user?.id || '';
      setLoadingPosts(true) // Use internal loading state
      try {
        if (type == 'favorites' && user_id == '') {
          // 用户未登录，无法获取收藏
          setPosts([]);
          setOriginalPosts([]);
          setIsSortedByInterest(false);
          if (type === 'dont-miss') {
            setDontMissCount(0); // Reset count for 'dont-miss'
          }
          // Ensure comments/summaries are not expanded if no posts
          setExpandedComments({});
          setExpandedSummaries({});
          return;
        }
        // 首先尝试调用Cloudflare Worker接口
        const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hpyhn.xyz/worker';
        const response = await fetch(`${cloudflareWorkerUrl}/api/posts?type=${type}&user_id=${user_id}`)
        const data = await response.json()
        //console.Console.log('Fetched posts:', data)
        if (response.ok) {
          // 保存原始数据并重置排序状态
          setOriginalPosts(data);
          setPosts(data);
          setIsSortedByInterest(false);
          if (type === 'dont-miss') {
            setDontMissCount(data.length); // Update count for 'dont-miss'
          }
          // 默认展开第一条帖子的评论摘要和内容摘要
          if (data.length > 0) {
            const firstPostHnId = data[0].hn_id;
            setExpandedComments(prev => ({ ...prev, [firstPostHnId]: true }));
            setExpandedSummaries(prev => ({ ...prev, [firstPostHnId]: true }));
          } else {
            // 如果没有帖子，确保评论和摘要状态被清空
            setExpandedComments({});
            setExpandedSummaries({});
          }
        }  else {
            console.error('Failed to fetch posts from backend:', fallbackData.error)
            setPosts([])
            if (type === 'dont-miss') {
              setDontMissCount(0); // Reset count for 'dont-miss'
            }
            // 如果发生错误，确保评论和摘要状态被清空
            setExpandedComments({});
            setExpandedSummaries({});
          }
      } catch (error) {
        // 如果Cloudflare Worker接口网络错误，尝试回退到后端接口
        console.warn('Cloudflare Worker API failed:', error)
        // 如果发生错误，确保评论和摘要状态被清空
        setExpandedComments({});
        setExpandedSummaries({});
      } finally {
        setLoadingPosts(false) // Use internal loading state
      }
    }

    async function fetchUserInterests() {
    try {
      // 首先尝试调用Cloudflare Worker接口
      const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hpyhn.xyz/worker';
      console.log('Fetching user interests from Cloudflare Worker:', cloudflareWorkerUrl);
      const cloudflareResponse = await fetch(`${cloudflareWorkerUrl}/api/user-interests?user_id=${currentSession?.user?.id}`);
      
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
    if (!currentSession) {
      currentSetIsLoginOpen(true); // Use the appropriate setIsLoginOpen
      return;
    }
    
    try {
      // 首先尝试调用Cloudflare Worker接口
      const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hpyhn.xyz/worker';
      console.log('Fetching user interests from Cloudflare Worker:', cloudflareWorkerUrl);
      const cloudflareResponse = await fetch(`${cloudflareWorkerUrl}/api/user-interests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, interest, user_id: currentSession.user.id })
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
        setUserSession(null) // Use internal state for general session
        setIsUserMenuOpen(false)
        router.push('/')
      } else {
        console.error('Failed to logout')
      }
    } catch (error) {
      console.error('Error logging out:', error)
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
      //await fetchLiveComments(postId);
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
      ALLOWED_ATTR: ['href', 'class', 'style'] // Allow 'style' attribute for inline styles
    })
    .replace(/<a\s+href="([^"]+)"[^>]*>/g, 
      '<a href="$1" class="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">')
    .replace(/<p>/g, '<p class="mt-2">')
    .replace(/<pre>/g, '<pre style="word-break: break-all; white-space: pre-wrap;">') // Add style for pre tags
    .replace(/<code>/g, '<code style="word-break: break-all;">'); // Add style for code tags
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

  // Helper function to parse summary_comments
  const parseSummaryComments = (summaryCommentsInput) => {
    let clusterSummaries = [];
    let overallPostSummary = null;

    if (!summaryCommentsInput) {
      return { cluster_summaries: clusterSummaries, overall_comments_summary_with_sentiment: overallPostSummary };
    }

    // Case 1: Input is already an object
    if (typeof summaryCommentsInput === 'object') {
      // New format: { cluster_summaries: [], overall_comments_summary_with_sentiment: "..." }
      if (summaryCommentsInput.cluster_summaries !== undefined) {
        overallPostSummary = typeof summaryCommentsInput.overall_comments_summary_with_sentiment === 'string' ? 
                             summaryCommentsInput.overall_comments_summary_with_sentiment
                               .replace(/^```markdown\s*\n?/, '') // Remove leading ```markdown and optional newline
                               .replace(/\n?```$/, '') // Remove optional newline and trailing ```
                               .replace(/\n\n/g, '\n') // Replace any sequence of newline, optional whitespace, and two or more newlines with two newlines
                               .trim() : // Trim any remaining leading/trailing whitespace
                             null;
        clusterSummaries = Array.isArray(summaryCommentsInput.cluster_summaries) ? summaryCommentsInput.cluster_summaries : [];
      }
      // Old format: directly an array
      else if (Array.isArray(summaryCommentsInput)) {
        clusterSummaries = summaryCommentsInput;
      }
    }
    // Case 2: Input is a string, try to parse it as JSON
    else if (typeof summaryCommentsInput === 'string') {
      try {
        const parsed = JSON.parse(summaryCommentsInput);
        // New format after parsing: { cluster_summaries: [], overall_comments_summary_with_sentiment: "..." }
        if (parsed.cluster_summaries !== undefined) {
          overallPostSummary = typeof parsed.overall_comments_summary_with_sentiment === 'string' ? 
                               parsed.overall_comments_summary_with_sentiment
                                 .replace(/^```markdown\s*\n?/, '') // Remove leading ```markdown and optional newline
                                 .replace(/\n?```$/, '') // Remove optional newline and trailing ```
                                 .replace(/\n\n/g, '\n') // Replace any sequence of newline, optional whitespace, and two or more newlines with two newlines
                                 .trim() : // Trim any remaining leading/trailing whitespace
                               null;
          clusterSummaries = Array.isArray(parsed.cluster_summaries) ? parsed.cluster_summaries : [];
        }
        // Old format after parsing: directly an array
        else if (Array.isArray(parsed)) {
          clusterSummaries = parsed;
        }
      } catch (e) {
        console.error("Error parsing summary_comments string:", e);
        // If parsing fails, treat as no valid comments
      }
    }
    //console.log(`overallPostSummary:${overallPostSummary}`)
    return { cluster_summaries: clusterSummaries, overall_comments_summary_with_sentiment: overallPostSummary };
  };

  // Determine which login modal state to use
  const modalIsOpen = postType === 'dont-miss' ? dontMissIsLoginOpen : homeIsLoginOpen;
  const onModalClose = () => {
    if (postType === 'dont-miss') {
      setDontMissIsLoginOpen(false);
    } else {
      setHomeIsLoginOpen(false);
    }
  };

  // Handler for individual post checkbox
  const handleSelectPost = (postId, isChecked) => {
    setSelectedPosts(prev => {
      if (isChecked) {
        return [...prev, postId];
      } else {
        return prev.filter(id => id !== postId);
      }
    });
  };
  
  // Handler for "Select All" checkbox
  const handleSelectAllPosts = (isChecked) => {
    const currentDisplayedPostIds = posts
      .slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage)
      .map(post => post.id);

    if (isChecked) {
      // Add all currently displayed posts to selectedPosts, avoiding duplicates
      setSelectedPosts(prev => [...new Set([...prev, ...currentDisplayedPostIds])]);
    } else {
      // Remove all currently displayed posts from selectedPosts
      setSelectedPosts(prev => prev.filter(id => !currentDisplayedPostIds.includes(id)));
    }
  };

  // Determine if "Select All" checkbox should be checked
  const areAllCurrentPagePostsSelected = useMemo(() => {
    const currentDisplayedPostIds = posts
      .slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage)
      .map(post => post.id);
    return currentDisplayedPostIds.length > 0 && currentDisplayedPostIds.every(id => selectedPosts.includes(id));
  }, [posts, currentPage, postsPerPage, selectedPosts]);


  // New function to handle marking multiple posts as read
  const handleMarkSelectedAsRead = async () => {
    if (!currentSession?.user?.id) {
      currentSetIsLoginOpen(true);
      return;
    }
    if (selectedPosts.length === 0) {
      alert('Please select at least one post to mark as read.');
      return;
    }

    // Optimistically update UI
    setReadPosts(prev => [...prev, ...selectedPosts]);
    setDontMissCount(prev => Math.max(0, prev - selectedPosts.length));
    setPosts(prevPosts => prevPosts.filter(post => !selectedPosts.includes(post.id)));
    setSelectedPosts([]); // Clear selection after action

    try {
      const cloudflareWorkerUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hpyhn.xyz/worker';
      // Chunk selectedPosts into batches of 100
      const batchSize = 100;
      const postBatches = [];
      for (let i = 0; i < selectedPosts.length; i += batchSize) {
        postBatches.push(selectedPosts.slice(i, i + batchSize));
      }

      // Send batch DELETE requests for each chunk
      const deletePromises = postBatches.map(batch =>
        fetch(`${cloudflareWorkerUrl}/api/dont-miss`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ postIds: batch, user_id: currentSession.user.id }), // Send an array of postIds
        })
      );

      const responses = await Promise.all(deletePromises);
      const failedDeletions = responses.filter(res => !res.ok);

      if (failedDeletions.length > 0) {
        // Handle partial failures or full failures
        const errorMessages = await Promise.all(failedDeletions.map(res => res.json().then(data => data.error || 'Unknown error')));
        console.error('Failed to mark some posts as read:', errorMessages);
        alert(`Failed to mark some posts as read: ${errorMessages.join(', ')}`);
        // Re-fetch posts or revert UI for failed ones if necessary
      } else {
        console.log('Selected posts marked as read successfully.');
      }
    } catch (error) {
      console.error('Error marking selected posts as read:', error);
      alert('Error marking selected posts as read.');
      // Revert optimistic UI updates if network error
    }
  };

  return (
    <div className="w-full sm:w-4/5 mx-auto px-4 py-2 bg-orange-50 relative min-h-screen">

      {/* ====================  Header ==================== */}
      <header className="bg-orange-500 py-2 px-4 flex flex-col md:flex-row md:items-center md:justify-between">
        {/* Left side: HPYHN logo and Navigation */}
        <div className="flex flex-col md:flex-row md:items-center">
          {/* HPYHN logo and mobile user section (visible on small screens) */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <Link href="/" className="font-bold text-white mr-4 hover:underline flex items-center">
              HPYHN
            </Link>
            {/* Mobile-only user section */}
            <div className="md:hidden">
              {!currentSession ? (
                <button
                  onClick={() => currentSetIsLoginOpen(true)}
                  className="text-white hover:underline text-sm bg-orange-600 px-3 py-1 rounded"
                >
                  login
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="text-white hover:text-gray-200 text-sm flex items-center relative z-30"
                  >
                    {currentSession.user.email}
                    <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  </button>
                  {isUserMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20 bg-black bg-opacity-10"
                        onClick={() => setIsUserMenuOpen(false)}
                      />
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
            </div>
          </div>
          
          {/* Navigation links (below logo/user on mobile, next to logo on desktop) */}
          <nav className="flex space-x-4 text-sm mt-2 md:mt-0 md:ml-4">
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
            {/* 收藏项 - 在所有设备上可见 */}
            {currentSession && (
              <Link href="/favorites" className="text-white hover:underline"
                onClick={() => setCurrentPage(1)}>
                favorites
              </Link>
            )}
            {/* New Don't Miss link */}
            <Link href="/dont-miss" className="text-white hover:underline relative" // Add relative here
              onClick={() => setCurrentPage(1)}>
              Don't Miss
              {postType !== 'dont-miss' && dontMissCount > 0 && (
                <span className="absolute -top-2 right-[-20px] inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                  {dontMissCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
        
        {/* Desktop-only user section (visible on large screens, pushed to right) */}
        <div className="hidden md:block mt-2 md:mt-0">
          {!currentSession ? (
            <button
              onClick={() => currentSetIsLoginOpen(true)}
              className="text-white hover:underline text-sm bg-orange-600 px-3 py-1 rounded"
            >
              login
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="text-white hover:text-gray-200 text-sm flex items-center relative z-30"
              >
                {currentSession.user.email}
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
        </div>
      </header>

      {/* ====================  Main content ==================== */}
      <main className="bg-white px-2 sm:px-4">
        {postType === 'dont-miss' ? (
          // Conditional rendering for 'dont-miss' page
          currentLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : !currentSession ? (
            <div className="py-8"> {/* Removed max-w-4xl, mx-auto, bg-orange-50, min-h-screen */}
              <header className="mb-8 text-center"> {/* Added text-center for consistency */}
                <h1 className="text-2xl font-bold text-orange-800">Don't Miss</h1>
                <p className="text-gray-600">Catch up on posts you might have missed!</p>
              </header>

              <div className="max-w-4xl mx-auto bg-orange-50 rounded-lg shadow-md p-6"> {/* Kept max-w-4xl for the inner content block */}
                <div className="text-center py-8">
                  <h2 className="text-xl font-semibold mb-4 text-orange-700">Login to Unlock "Don't Miss"</h2>
                  <p className="text-gray-600 mb-4">
                    This feature helps you discover posts you might be interested in, but missed.
                    We use an AI model, your interested topics, and custom keywords to precisely filter content for you.
                    Please log in to access this premium feature.
                  </p>
                  <button
                    onClick={() => currentSetIsLoginOpen(true)} // Use the appropriate setIsLoginOpen
                    className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
                  >
                    Login Now
                  </button>
                </div>
              </div>
            </div>
          ) : currentSession && currentSubscription?.status !== 'active' ? (
            <div className="py-8"> {/* Removed max-w-4xl, mx-auto, bg-orange-50, min-h-screen */}
              <header className="mb-8 text-center"> {/* Added text-center for consistency */}
                <h1 className="text-2xl font-bold text-orange-800">Don't Miss</h1>
                <p className="text-gray-600">Catch up on posts you might have missed!</p>
              </header>

              <div className="max-w-4xl mx-auto bg-orange-50 rounded-lg shadow-md p-6"> {/* Kept max-w-4xl for the inner content block */}
                <div className="text-center py-8">
                  <h2 className="text-xl font-semibold mb-4 text-orange-700">Unlock "Don't Miss" with a Subscription</h2>
                  <p className="text-gray-600 mb-4">
                    "Don't Miss" is a premium feature that intelligently curates posts you're likely to enjoy,
                    even if you missed them on the front page. We use an AI model, your interested topics, and custom keywords to precisely filter content for you.
                    Subscribe now to never miss out! New users get a 14-day free trial.
                  </p>
                  <Link
                    href="/account" // Link to the account page where subscription button is
                    className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
                  >
                    Subscribe Now
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            // If logged in and subscribed, render the actual posts for 'dont-miss'
            <>
              {loadingPosts ? ( // Use internal loadingPosts for the actual feed
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : posts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No posts available
                  {currentSession && currentSubscription?.status === 'active' && (
                    <p className="mt-4 text-sm text-gray-600">
                      It looks like there are no posts matching your current interest filters.
                      Remember to configure your preferences in the
                      <Link href="/account?tab=interests" className="text-blue-600 hover:underline ml-1">
                        Account Settings
                      </Link>
                         .
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Control bar for "Select All" and "Mark Selected as Read" */}
                  <div className="flex items-center justify-between py-2 px-1 sm:px-0 bg-gray-50 border-b border-gray-200">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-orange-600"
                        checked={areAllCurrentPagePostsSelected}
                        onChange={(e) => handleSelectAllPosts(e.target.checked)}
                      />
                      <span className="ml-2 text-sm text-gray-700">Select All (Page {currentPage})</span>
                    </label>
                    {/* New tip for the user */}
                    <span className="text-xs text-gray-500 ml-4 hidden md:block">
                      Comments on recent posts may update. Consider marking as read later to avoid missing important updates.
                    </span>
                    <button
                      onClick={handleMarkSelectedAsRead}
                      disabled={selectedPosts.length === 0}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        selectedPosts.length === 0
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      Mark {selectedPosts.length} Selected as Read
                    </button>
                  </div>

                  <ol className="list-none px-1 sm:px-0">
                  {/* Calculate data to display for current page */}
                  {posts
                    .slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage)
                    .map((post, index) => (
                      <li key={post.id} className={`py-2 px-1 ${readPosts.includes(post.id) ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-baseline">
                            {/* Checkbox for individual post */}
                            <input
                              type="checkbox"
                              className="form-checkbox h-4 w-4 text-orange-600 mr-1"
                              checked={selectedPosts.includes(post.id)}
                              onChange={(e) => handleSelectPost(post.id, e.target.checked)}
                            />
                            <span className="text-gray-500 mr-1">{(currentPage - 1) * postsPerPage + index + 1}.</span>
                            <div className="flex flex-col h-full mr-1">
                              <span className="text-xs  w-8 h-5 bg-orange-100 text-orange-800 px-1 rounded mt-1 flex items-center justify-center">HN</span>
                              <div className="flex-1" />
                              <div className="flex items-center">
                                <span className="mt-auto mb-auto w-8 h-8 flex items-center justify-center text-sm bg-purple-50 text-purple-700 rounded-full font-bold">
                                  {interestScores[post.id] !== undefined ? (interestScores[post.id] < 1 ? Math.round(interestScores[post.id] * 100) : interestScores[post.id]) : 0}%
                                
                                {/* Only show sort icon next to first post's interest score */}
                                {index === 0 && currentSubscription?.status === 'active' && (
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
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
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
                              <div className="flex flex-wrap items-center"> {/* Changed to flex-wrap to allow items to flow and wrap */}
                                <div className="mb-1 sm:mb-0 sm:mr-2"> {/* This div contains the points, user, timeago */}
                                  {post.points || 0} points by {post.user?.username || 'anonymous'} {timeago.format(new Date(post.created_at))}
                                </div>
                                {/* Separator for larger screens, hidden on mobile */}
                                <span className="mr-2 mb-1 hidden sm:inline">|</span> 
                                <button 
                                  onClick={() => toggleComments(post.hn_id)}
                                  className="hover:underline mr-2 mb-1 px-2 py-1 touch-manipulation"
                                >
                                  {post.comments_count || post.descendants || 0} comments
                                  {(post.comments_count > 0 || post.descendants > 0) && (
                                    <span className="ml-1 text-red-600 font-medium">{expandedComments[post.hn_id] ? 'collapse' : 'summary'}</span>
                                  )}
                                </button>
                                {post.text && (
                                  <>
                                    {/* Separator for larger screens, hidden on mobile */}
                                    <span className="mr-2 mb-1 hidden sm:inline">|</span> 
                                    <button
                                      onClick={() => toggleText(post.hn_id)}
                                      className={`hover:underline mr-2 mb-1 ${post.text ? 'text-green-600 font-medium' : 'text-gray-500'}`}
                                    >
                                      {expandedTexts[post.hn_id] ? 'hide post text' : 'show post text'}
                                    </button>
                                  </>
                                )}
                                {/* Summary expand/collapse button */}
                                {post.content_summary && (
                                  <>
                                    {/* Separator for larger screens, hidden on mobile */}
                                    <span className="mr-2 mb-1 hidden sm:inline">|</span> 
                                    <button 
                                      onClick={() => toggleSummary(post.hn_id)}
                                      className={`hover:underline mr-2 mb-1 ${post.content_summary ? 'text-blue-600 font-medium' : 'text-gray-500'}`}
                                    >
                                      {expandedSummaries[post.hn_id] ? 'hide summary' : 'post summary'}
                                    </button>
                                  </>
                                )}
                              </div>
                              {(
                                <div className="ml-auto">
                                  <FacebookReaction 
                                    postId={post.id}
                                    currentReaction={currentSession ? userInterests[post.id] : null}
                                    onSelect={(postId, reaction) => {
                                      if (!currentSession) {
                                        currentSetIsLoginOpen(true); // Use the appropriate setIsLoginOpen
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
                        {/* Comments show/hide logic */}
                        {expandedComments[post.hn_id] && (() => {
                          const { cluster_summaries, overall_comments_summary_with_sentiment } = parseSummaryComments(post.summary_comments);
                          
                          // Check if there are comments but no summary comments due to subscription status
                          if (cluster_summaries.length === 0 && !overall_comments_summary_with_sentiment &&
                            (post.comments_count > 0 || post.descendants > 0)
                          ) {
                            return (
                              <div className="mt-2 ml-6 p-3 bg-red-50 rounded border border-red-200 text-red-800 text-xs">
                                <p className="font-medium mb-1">Comments Summary is a Premium Feature</p>
                                <p>
                                  To view summarized comments and understand the key discussions quickly,
                                  please{' '}
                                  <Link href="/account" className="text-blue-600 hover:underline">
                                    subscribe to unlock this feature
                                  </Link>
                                  . New users get a 14-day free trial!
                                </p>
                              </div>
                            );
                          }

                          // Sort the comment categories (existing logic)
                          const sortedSummaryComments = cluster_summaries ? [...cluster_summaries].sort((a, b) => {
                            // Prioritize non-negative labels over -1
                            if (a.label === -1 && b.label !== -1) return 1;
                            if (a.label !== -1 && b.label === -1) return -1;
                            
                            // Then sort by num_comments in descending order
                            return b.num_comments - a.num_comments;
                          }) : [];

                          return (overall_comments_summary_with_sentiment || sortedSummaryComments.length > 0) ? (
                            <div className="mt-2 ml-6 space-y-4 border-l-2 pl-2 border-orange-200">
                              {overall_comments_summary_with_sentiment && (
                                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                  <div className="text-xs font-medium text-blue-800 mb-1">Overall comments Summary with Sentiment:</div>
                                  <div
                                    className="text-xs text-gray-700 whitespace-pre-wrap break-words prose prose-sm max-w-none"
                                    //dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(overall_comments_summary_with_sentiment) }}
                                  >
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {overall_comments_summary_with_sentiment}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}
                              {sortedSummaryComments.length > 0 && (
                                <>
                                  <div className="text-xs font-medium text-orange-800 mb-1">Comments Category:</div>
                                  {sortedSummaryComments.map((commentCategory, categoryIndex) => (
                                    <div key={categoryIndex} className="bg-orange-50 p-3 rounded">
                                      <div className="font-bold text-sm text-orange-700 mb-1">
                                        Category {commentCategory.label === -1 ? 'Uncategorized' : commentCategory.label} ({commentCategory.num_comments} comments)
                                      </div>
                                      {commentCategory.theme && (
                                        <div className="mt-1 p-2 bg-purple-50 rounded border border-purple-200">
                                          <div className="text-xs font-medium text-purple-800 mb-1">Category Theme:</div>
                                          <div className="text-xs text-gray-700">
                                            {commentCategory.theme}
                                          </div>
                                        </div>
                                      )}
                                      <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                                        <div className="text-xs font-medium text-blue-800 mb-1">Category Summary:</div>
                                        <div className="text-xs text-gray-700">
                                          {commentCategory.summary || 'No summary available.'}
                                        </div>
                                      </div>
                                      {commentCategory.comments && commentCategory.comments.length > 0 && (
                                        <div className="space-y-2">
                                          <div className="text-xs font-medium text-gray-600 p-2">Typical Comments below:</div>
                                          {commentCategory.comments.map((comment, commentIndex) => (
                                            <div key={commentIndex} className="text-xs text-gray-600 border-t border-gray-200 pt-2">
                                              <div className="font-medium text-gray-800">
                                                {comment.author || 'anonymous'} · 
                                                {timeago.format(new Date(comment.created_at))}
                                                {comment.hn_id && (
                                                  <a
                                                    href={`https://news.ycombinator.com/item?id=${comment.hn_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-1 text-orange-600 hover:underline"
                                                  >
                                                    view on HN
                                                  </a>
                                                )}
                                              </div>
                                              {comment.summary && (
                                                <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                                                  <div className="text-xs font-medium text-blue-800 mb-1">Comment Summary:</div>
                                                  <div className="text-xs text-gray-700">
                                                    {comment.summary}
                                                  </div>
                                                </div>
                                              )}
                                              <div 
                                                className="mt-1 whitespace-pre-wrap break-words max-w-none"
                                                dangerouslySetInnerHTML={{ __html: formatCommentText(comment.text) }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-2 ml-6">
                              { (post.comments_count > 0 || post.descendants > 0) ? 
                                'No comments analysis available for this post now.' : 
                                'No comments available for this post.' 
                              }
                            </div>
                          );
                        })()}
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
            </>
          )
        ) : (
          // Existing rendering logic for other feed types (front-page, newest, ask, show, favorites)
          <>
              {loadingPosts ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : posts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No posts available
                </div>
              ) : (
                <>
                    <ol className="list-none px-1 sm:px-0">
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
                                {postType !== 'favorites' && (
                                  <div className="flex items-center">
                                    <span className="mt-auto mb-auto w-8 h-8 flex items-center justify-center text-sm bg-purple-50 text-purple-700 rounded-full font-bold">
                                      {interestScores[post.id] !== undefined ? (interestScores[post.id] < 1 ? Math.round(interestScores[post.id] * 100) : interestScores[post.id]) : 0}%
                                    
                                    {/* Only show sort icon next to first post's interest score */}
                                    {index === 0 && currentSubscription?.status === 'active' && (
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
                                )}
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
                                <div className="flex flex-wrap items-center"> {/* Changed to flex-wrap to allow items to flow and wrap */}
                                  <div className="mb-1 sm:mb-0 sm:mr-2"> {/* This div contains the points, user, timeago */}
                                    {post.points || 0} points by {post.user?.username || 'anonymous'} {timeago.format(new Date(post.created_at))}
                                  </div>
                                  {/* Separator for larger screens, hidden on mobile */}
                                  <span className="mr-2 mb-1 hidden sm:inline">|</span> 
                                  <button 
                                    onClick={() => toggleComments(post.hn_id)}
                                    className="hover:underline mr-2 mb-1 px-2 py-1 touch-manipulation"
                                  >
                                    {post.comments_count || post.descendants || 0} comments
                                    {(post.comments_count > 0 || post.descendants > 0) && (
                                      <span className="ml-1 text-red-600 font-medium">{expandedComments[post.hn_id] ? 'collapse' : 'summary'}</span>
                                    )}
                                  </button>
                                  {post.text && (
                                    <>
                                      {/* Separator for larger screens, hidden on mobile */}
                                      <span className="mr-2 mb-1 hidden sm:inline">|</span> 
                                      <button
                                        onClick={() => toggleText(post.hn_id)}
                                        className={`hover:underline mr-2 mb-1 ${post.text ? 'text-green-600 font-medium' : 'text-gray-500'}`}
                                      >
                                        {expandedTexts[post.hn_id] ? 'hide post text' : 'show post text'}
                                      </button>
                                    </>
                                  )}
                                  {/* Summary expand/collapse button */}
                                  {post.content_summary && (
                                    <>
                                      {/* Separator for larger screens, hidden on mobile */}
                                      <span className="mr-2 mb-1 hidden sm:inline">|</span> 
                                      <button 
                                        onClick={() => toggleSummary(post.hn_id)}
                                        className={`hover:underline mr-2 mb-1 ${post.content_summary ? 'text-blue-600 font-medium' : 'text-gray-500'}`}
                                      >
                                        {expandedSummaries[post.hn_id] ? 'hide summary' : 'post summary'}
                                      </button>
                                    </>
                                  )}
                                </div>
                                {(
                                  <div className="ml-auto">
                                    <FacebookReaction 
                                      postId={post.id}
                                      currentReaction={currentSession ? userInterests[post.id] : null}
                                      onSelect={(postId, reaction) => {
                                        if (!currentSession) {
                                          currentSetIsLoginOpen(true); // Use the appropriate setIsLoginOpen
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
                          {/* Comments show/hide logic */}
                          {expandedComments[post.hn_id] && (() => {
                          const { cluster_summaries, overall_comments_summary_with_sentiment } = parseSummaryComments(post.summary_comments);
                          
                          // Check if there are comments but no summary comments due to subscription status
                          if (cluster_summaries.length === 0 && !overall_comments_summary_with_sentiment &&
                            (post.comments_count > 0 || post.descendants > 0)
                          ) {
                            return (
                              <div className="mt-2 ml-6 p-3 bg-red-50 rounded border border-red-200 text-red-800 text-xs">
                                <p className="font-medium mb-1">Comments Summary is a Premium Feature</p>
                                <p>
                                  To view summarized comments and understand the key discussions quickly,
                                  please{' '}
                                  <Link href="/account" className="text-blue-600 hover:underline">
                                    subscribe to unlock this feature
                                  </Link>
                                  . New users get a 14-day free trial!
                                </p>
                              </div>
                            );
                          }

                          // Sort the comment categories (existing logic)
                          const sortedSummaryComments = cluster_summaries ? [...cluster_summaries].sort((a, b) => {
                            // Prioritize non-negative labels over -1
                            if (a.label === -1 && b.label !== -1) return 1;
                            if (a.label !== -1 && b.label === -1) return -1;
                            
                            // Then sort by num_comments in descending order
                            return b.num_comments - a.num_comments;
                          }) : [];

                          return (overall_comments_summary_with_sentiment || sortedSummaryComments.length > 0) ? (
                            <div className="mt-2 ml-6 space-y-4 border-l-2 pl-2 border-orange-200">
                              {overall_comments_summary_with_sentiment && (
                                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                  <div className="text-xs font-medium text-blue-800 mb-1">Overall comments Summary with Sentiment:</div>
                                  <div
                                    className="text-xs text-gray-700 whitespace-pre-wrap break-words prose prose-sm max-w-none"
                                    //dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(overall_comments_summary_with_sentiment) }}
                                  >
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {overall_comments_summary_with_sentiment}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}
                              {sortedSummaryComments.length > 0 && (
                                <>
                                  <div className="text-xs font-medium text-orange-800 mb-1">Comments Category:</div>
                                  {sortedSummaryComments.map((commentCategory, categoryIndex) => (
                                    <div key={categoryIndex} className="bg-orange-50 p-3 rounded">
                                      <div className="font-bold text-sm text-orange-700 mb-1">
                                        Category {commentCategory.label === -1 ? 'Uncategorized' : commentCategory.label} ({commentCategory.num_comments} comments)
                                      </div>
                                      {commentCategory.theme && (
                                        <div className="mt-1 p-2 bg-purple-50 rounded border border-purple-200">
                                          <div className="text-xs font-medium text-purple-800 mb-1">Category Theme:</div>
                                          <div className="text-xs text-gray-700">
                                            {commentCategory.theme}
                                          </div>
                                        </div>
                                      )}
                                      <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                                        <div className="text-xs font-medium text-blue-800 mb-1">Category Summary:</div>
                                        <div className="text-xs text-gray-700">
                                          {commentCategory.summary || 'No summary available.'}
                                        </div>
                                      </div>
                                      {commentCategory.comments && commentCategory.comments.length > 0 && (
                                        <div className="space-y-2">
                                          <div className="text-xs font-medium text-gray-600 p-2">Typical Comments below:</div>
                                          {commentCategory.comments.map((comment, commentIndex) => (
                                            <div key={commentIndex} className="text-xs text-gray-600 border-t border-gray-200 pt-2">
                                              <div className="font-medium text-gray-800">
                                                {comment.author || 'anonymous'} · 
                                                {timeago.format(new Date(comment.created_at))}
                                                {comment.hn_id && (
                                                  <a
                                                    href={`https://news.ycombinator.com/item?id=${comment.hn_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-1 text-orange-600 hover:underline"
                                                  >
                                                    view on HN
                                                  </a>
                                                )}
                                              </div>
                                              {comment.summary && (
                                                <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                                                  <div className="text-xs font-medium text-blue-800 mb-1">Comment Summary:</div>
                                                  <div className="text-xs text-gray-700">
                                                    {comment.summary}
                                                  </div>
                                                </div>
                                              )}
                                              <div 
                                                className="mt-1 whitespace-pre-wrap break-words max-w-none"
                                                dangerouslySetInnerHTML={{ __html: formatCommentText(comment.text) }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-2 ml-6">
                              { (post.comments_count > 0 || post.descendants > 0) ? 
                                'No comments analysis available for this post now.' : 
                                'No comments available for this post.' 
                              }
                            </div>
                          );
                        })()}
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
          </>
        )}
      </main>
      
      <footer className="text-center py-4 text-xs text-gray-500">
        <Link href="/blog/" className="hover:underline">blog</Link>  
      </footer>

      <LoginModal 
        isOpen={modalIsOpen} // Use the dynamically determined modal state
        onClose={onModalClose} // Use the dynamically determined onClose handler
        onRegisterClick={() => {
          onModalClose() // Close login modal
          setIsRegisterOpen(true)
        }}
      />

      <RegisterModal 
        isOpen={isRegisterOpen} 
        onClose={() => setIsRegisterOpen(false)}
        onLoginClick={() => {
          setIsRegisterOpen(false)
          currentSetIsLoginOpen(true) // Use the appropriate setIsLoginOpen
        }}
      />
    </div>
  )
}