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
        set(name, value, options) {
          cookieStore.set(name, value, options)
        },
        remove(name, options) {
          cookieStore.delete(name, options)
        },
      },
    }
  )
  
  // Get the session first
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    console.error('Error getting session in /api/auth/session:', sessionError);
  } else {
    console.log('Session in /api/auth/session:', session);
  }
  
  // If there's a session, get the authenticated user data
  let user = null
  if (session) {
    const { data: { user: authenticatedUser }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.error('Error getting user in /api/auth/session:', userError);
    } else {
      user = authenticatedUser
      console.log('User in /api/auth/session:', user);
    }
  }
  
  return new Response(
    JSON.stringify({ session, user }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}