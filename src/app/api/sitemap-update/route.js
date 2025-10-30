export async function POST(request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_AUTH_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Ping Google to notify about sitemap update
    const sitemapUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/sitemap.xml`;
    const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    
    const response = await fetch(googlePingUrl);

    if (!response.ok) {
      throw new Error(`Google ping failed with status: ${response.status}`);
    }

    return Response.json({ success: true, message: 'Sitemap updated and Google notified.' });
  } catch (error) {
    console.error('Error updating sitemap and notifying Google:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}