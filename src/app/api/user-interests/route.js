import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request) {
  try {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    
    const { data, error } = await supabase
      .from('user_post_interests')
      .select('post_id, interest_type')
      .eq('user_id', user.id)
    
    if (error) throw error
    
    // 转换为对象格式便于前端使用
    const interests = {}
    data?.forEach(item => {
      interests[item.post_id] = item.interest_type
    })
    
    return new Response(
      JSON.stringify(interests),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in GET /api/user-interests:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function POST(request) {
  try {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    
    const { postId, interest } = await request.json()
    
    // 验证参数
    if (!postId) {
      return new Response(
        JSON.stringify({ error: 'postId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    if (interest !== null && typeof interest !== 'string') {
      return new Response(
        JSON.stringify({ error: 'interest must be a string or null' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    if (interest !== null && !['like', 'dislike', 'save'].includes(interest)) {
      return new Response(
        JSON.stringify({ error: 'interest must be one of: like, dislike, save, or null' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    if (interest === null) {
      // 删除兴趣
      const { error } = await supabase
        .from('user_post_interests')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId)
      
      if (error) throw error
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    } else {
      // 添加/更新兴趣
      const { error } = await supabase
        .from('user_post_interests')
        .upsert(
          {
            user_id: user.id,
            post_id: postId,
            interest_type: interest
          },
          { onConflict: ['user_id', 'post_id'] }
        )
      
      if (error) throw error
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error in POST /api/user-interests:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}