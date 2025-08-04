import { syncHnPosts } from '../../scripts/sync-hn-posts'

export async function GET() {
  try {
    const result = await syncHnPosts('news', 200)
    return Response.json({ 
      success: true, 
      type: 'news',
      count: result.count,
      message: `Successfully synced ${result.count} news posts`
    })
  } catch (error) {
    return Response.json({ 
      success: false, 
      type: 'news',
      error: error.message 
    }, { status: 500 })
  }
}