import { syncHnPosts } from '../../../scripts/sync-hn-posts'

export async function GET() {
  try {
    const result = await syncHnPosts('ask', 100)
    return Response.json({ 
      success: true, 
      type: 'ask',
      count: result.count,
      message: `Successfully synced ${result.count} ask posts`
    })
  } catch (error) {
    return Response.json({ 
      success: false, 
      type: 'ask',
      error: error.message 
    }, { status: 500 })
  }
}