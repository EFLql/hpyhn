import { syncHnPosts } from '../../scripts/sync-hn-posts'

export async function GET() {
  try {
    const result = await syncHnPosts('front_page', 200)
    return Response.json({ 
      success: true, 
      type: 'front_page',
      count: result.count,
      message: `Successfully synced ${result.count} front page posts`
    })
  } catch (error) {
    return Response.json({ 
      success: false, 
      type: 'front_page',
      error: error.message 
    }, { status: 500 })
  }
}