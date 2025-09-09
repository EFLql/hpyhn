import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request) {
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
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    const { postId } = await request.json()
    
    // 获取当前分数
    const { data: post, error: fetchError } = await supabase
      .from('hn_posts')
      .select('points')
      .eq('id', postId)
      .single()
    
    if (fetchError) throw fetchError
    
    // 更新分数
    const { error: updateError } = await supabase
      .from('posts')
      .update({ points: (post.points || 0) + 1 })
      .eq('id', postId)
    
    if (updateError) throw updateError
    
    return new Response(
      JSON.stringify({ success: true, newPoints: (post.points || 0) + 1 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}