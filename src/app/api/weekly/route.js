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
  
  try {
    // Calculate the date one week ago from the current date
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoISO = oneWeekAgo.toISOString();
    console.log(`oneWeekAgoISO=${oneWeekAgoISO}`)

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
      .gte('created_at', oneWeekAgoISO) // Filter posts created in the last week
      .order('points', {ascending: false, nullsFirst: false }) // Corrected: Sort by points descending from hn_posts
      .limit(100) // Limit to 100 posts
    
    if (error) {
       console.error('Error fetching weekly posts:', error); // Log the detailed error
        throw error
    }
    
    let formattedHnPosts = data
      .filter(item => item.hn_posts !== null && item.update_time !== null)
      .map(item => ({
        ...item,
        source: 'hn',
        comments_count: item.descendants,
        user: { username: item.user_id || 'anonymous' },
      }));
    
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
