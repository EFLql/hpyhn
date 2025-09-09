import { createServerClient } from '@supabase/ssr'; // Changed from createRouteHandlerClient
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const cookieStore = await cookies(); // Get the cookie store once

  // Initialize Supabase client using createServerClient, mirroring session route
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set(name, value, options);
        },
        remove(name, options) {
          cookieStore.delete(name, options);
        },
      },
    }
  );

  try {
    // Verify authenticated user in the API route context
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user || user.id !== userId) {
      console.error('GET /api/user-preferences: Unauthorized access or user ID mismatch.', {
        authenticatedUserId: user?.id,
        requestedUserId: userId,
        userError: userError?.message
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('interests, keywords, min_points, min_comments') // Added min_points and min_comments
      .eq('user_id', userId)
      .single();

    // PGRST116 means no rows found, which is not an error for fetching preferences
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user preferences:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no preferences found, return empty strings and default numbers
    if (!data) {
      return NextResponse.json({ interests: '', keywords: '', minPoints: 0, minComments: 0 }, { status: 200 });
    }

    // Map snake_case from DB to camelCase for frontend
    return NextResponse.json({
      interests: data.interests,
      keywords: data.keywords,
      minPoints: data.min_points,
      minComments: data.min_comments,
    }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in GET /api/user-preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const { userId, interests, keywords, minPoints, minComments } = await request.json(); // Destructure new fields

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const cookieStore = await cookies(); // Get the cookie store once

  // Initialize Supabase client using createServerClient, mirroring session route
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set(name, value, options);
        },
        remove(name, options) {
          cookieStore.delete(name, options);
        },
      },
    }
  );

  try {
    // Verify authenticated user in the API route context
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user || user.id !== userId) {
      console.error('POST /api/user-preferences: Unauthorized access or user ID mismatch.', {
        authenticatedUserId: user?.id,
        requestedUserId: userId,
        userError: userError?.message
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if preferences already exist for the user
    const { data: existingPreferences, error: fetchError } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .single();

    // PGRST116 means no rows found, which is not an error for checking existence
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing preferences:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let upsertResult;
    if (existingPreferences) {
      // Update existing preferences
      upsertResult = await supabase
        .from('user_preferences')
        .update({ 
          interests, 
          keywords, 
          min_points: minPoints, // Map camelCase from frontend to snake_case for DB
          min_comments: minComments, // Map camelCase from frontend to snake_case for DB
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', userId);
    } else {
      // Insert new preferences
      upsertResult = await supabase
        .from('user_preferences')
        .insert({ 
          user_id: userId, 
          interests, 
          keywords,
          min_points: minPoints, // Map camelCase from frontend to snake_case for DB
          min_comments: minComments, // Map camelCase from frontend to snake_case for DB
        });
    }

    if (upsertResult.error) {
      console.error('Error saving user preferences:', upsertResult.error);
      return NextResponse.json({ error: upsertResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Preferences saved successfully' }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in POST /api/user-preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}