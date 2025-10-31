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
  const hn_id = searchParams.get('hn_id')
  const limit = searchParams.get('limit') || 60
  
  try {
    let query
    let tableName

    if (hn_id) {
      // If an ID is provided, fetch a single post from hn_posts table
      const { data, error } = await supabase
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
          text,
          content_summary,
          summary_comments
        `)
        .eq('hn_id', hn_id)
        .single(); // Use .single() to get a single record

      if (error) throw error;

      if (!data) {
        return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      const formattedPost = {
        ...data,
        source: 'hn',
        comments_count: data.descendants,
        text: data.text,
        user: { username: data.user_id || 'anonymous' },
        time: new Date(data.created_at).getTime() / 1000, // Convert to Unix timestamp
        content: data.text || data.content_summary, // Use text or summary as content
      };

      return new Response(
        JSON.stringify(formattedPost),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
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
    
    console.log(`Fetching posts from table: ${tableName} with limit: ${limit}`)
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
    
    if (error) {
      console.error('Supabase query error:', error)
      throw error
    }
    console.log(`Fetched ${data.length} records from ${tableName}`)
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

    if (type === 'front-page') {
      console.log('Triggering sitemap update for front-page posts...');
      // Sort by points in descending order and take the top 6 for sitemap update
      const top6Posts = formattedHnPosts.sort((a, b) => b.points - a.points).slice(0, 6);
      const processedUrls = top6Posts.map(post => `${process.env.PUBLIC_DOMAIN_SITE}/posts/${post.hn_id}`);
      try {
        const sitemapUpdateResponse = await fetch(`https://${process.env.VERCEL_BACKEND_URL}/api/sitemap-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_AUTH_TOKEN}`
          },
          body: JSON.stringify({ urls: processedUrls })
        });
        
        if (sitemapUpdateResponse.ok) {
          console.log(`Sitemap update[${processedUrls.length}] triggered successfully.`);
        } else {
          const errorData = await sitemapUpdateResponse.json();
          console.error('Failed to trigger sitemap update:', errorData.error);
        }
      } catch (sitemapError) {
        console.error('Failed to trigger sitemap update:', sitemapError);
      }
    }
    
    return new Response(
      JSON.stringify(formattedHnPosts),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching posts:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}