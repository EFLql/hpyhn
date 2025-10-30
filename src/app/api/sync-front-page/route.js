import { syncHnPosts } from '../../../scripts/sync-hn-posts'

export async function GET(request) {
  // 获取授权头
  const authHeader = request.headers.get('authorization');
  
  // 验证cron auth token
  if (authHeader !== `Bearer ${process.env.CRON_AUTH_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let processedUrls = [];
  let result;
  try {
    result = await syncHnPosts('front_page', 60)
    processedUrls = result.front_page ? result.front_page.map(post => `${process.env.PUBLIC_DOMAIN_SITE}/posts/${post.hn_id}`) : [];
  } catch (error) {
    return Response.json({ 
      success: false, 
      type: 'front_page',
      error: error.message 
    }, { status: 500 })
  }

  // Trigger sitemap update after successful sync
  try {
    const sitemapUpdateResponse = await fetch(`${process.env.PUBLIC_DOMAIN_SITE}/api/sitemap-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_AUTH_TOKEN}`
      },
      body: JSON.stringify({ urls: processedUrls })
    });
    
    if (sitemapUpdateResponse.ok) {
      console.log(`Sitemap update[${processedUrls.length}] triggered successfully.`);
    } else {
      const errorData = await sitemapUpdateResponse.json();
      console.error('Failed to trigger sitemap update:', errorData.error);
    }
  } catch (sitemapError) {
    console.error('Failed to trigger sitemap update:', sitemapError);
  }

  return Response.json({
      success: true,
      type: 'front_page',
      count: result.processed,
      message: `Successfully synced ${result.processed} front page posts`
    });
}