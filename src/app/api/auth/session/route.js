import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request) {
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
  
  // Get the session first
  const { data: { session } } = await supabase.auth.getSession()
  
  // If there's a session, get the authenticated user data
  let user = null
  if (session) {
    const { data: { user: authenticatedUser }, error } = await supabase.auth.getUser()
    if (!error) {
      user = authenticatedUser
    }
  }
  
  return new Response(
    JSON.stringify({ session, user }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}