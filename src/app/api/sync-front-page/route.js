import { syncHnPosts } from '../../../scripts/sync-hn-posts'

export async function GET(request) {
  // 获取授权头
  const authHeader = request.headers.get('authorization');
  
  // 验证cron auth token
  if (authHeader !== `Bearer ${process.env.CRON_AUTH_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncHnPosts('front_page', 200)
    return Response.json({ 
      success: true, 
      type: 'front_page',
      count: result.processed,
      message: `Successfully synced ${result.processed} front page posts`
    })
  } catch (error) {
    return Response.json({ 
      success: false, 
      type: 'front_page',
      error: error.message 
    }, { status: 500 })
  }
}