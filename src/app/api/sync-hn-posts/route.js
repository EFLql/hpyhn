import { syncHnPosts } from '../../../scripts/sync-hn-posts'

export async function GET(request) {
  // 获取授权头
  const authHeader = request.headers.get('authorization');
  
  // 如果配置了 CRON_AUTH_TOKEN，则验证 auth token
  if (process.env.CRON_AUTH_TOKEN) {
    if (authHeader !== `Bearer ${process.env.CRON_AUTH_TOKEN}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  const result = await syncHnPosts()
  return Response.json(result)
}