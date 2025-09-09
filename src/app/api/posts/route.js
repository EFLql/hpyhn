import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
  
  // 注意：这个路由不需要用户认证，因为它是获取公开的帖子数据
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'front-page'
  const limit = searchParams.get('limit') || 60
  
  try {
    let query
    let tableName
    
    switch (type) {
      case 'news':
        tableName = 'hn_news_posts'
        break
      case 'ask':
        tableName = 'hn_ask_posts'
        break
      case 'show':
        tableName = 'hn_show_posts'
        break
      case 'front-page':
      default:
        tableName = 'hn_front_page_posts'
        break
    }
    
    const { data, error } = await supabase
      .from(tableName)
      .select(`
        created_at,
        update_time,
        hn_posts (
          id,
          hn_id,
          title,
          url,
          points,
          created_at,
          descendants,
          user_id,
          text,
          content_summary,
          summary_comments
        )
      `)
      .order('update_time', { ascending: false, nullsFirst: false })
      .limit(parseInt(limit))
    
    if (error) throw error
    
    // 过滤掉 hn_posts 为 null 的记录并格式化数据
    let formattedHnPosts = data
      .filter(item => item.hn_posts !== null && item.update_time !== null)
      .map(item => ({
        ...item.hn_posts,
        source: 'hn',
        comments_count: item.hn_posts.descendants,
        text: item.hn_posts.text,
        user: { username: item.hn_posts.user_id || 'anonymous' },
        update_time: item.update_time
      }));
    
    if (type === 'ask') {
      formattedHnPosts.sort((a, b) => b.comments_count - a.comments_count);
    } else if (type === 'show') {
      formattedHnPosts.sort((a, b) => b.points - a.points);
    } else {
      formattedHnPosts.sort((a, b) => {
        const timeA = new Date(a.update_time).getTime();
        const timeB = new Date(b.update_time).getTime();
        return timeA - timeB;
      });
    }
    
    return new Response(
      JSON.stringify(formattedHnPosts),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}