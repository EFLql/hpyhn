import { syncHnPosts } from '../../scripts/sync-hn-posts'

export async function GET() {
  try {
    const result = await syncHnPosts('show', 100)
    return Response.json({ 
      success: true, 
      type: 'show',
      count: result.count,
      message: `Successfully synced ${result.count} show posts`
    })
  } catch (error) {
    return Response.json({ 
      success: false, 
      type: 'show',
      error: error.message 
    }, { status: 500 })
  }
}