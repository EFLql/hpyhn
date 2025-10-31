import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request) {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('hn_front_page_posts')
    .select(`
      post_id,
      update_time
    `)
    .gte('update_time', fiveDaysAgo)
    .order('update_time', { ascending: false });

  if (error) {
    console.error('Error fetching posts for sitemap:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const posts = data.map(item => ({
    hn_id: item.post_id,
    update_time: item.update_time,
  }));

  const postEntries = posts.map((post) => ({
    url: `https://hpyhn.xyz/posts/${post.hn_id}`,
    lastModified: new Date(post.update_time).toISOString(),
    changeFrequency: 'hourly',
    priority: 0.7,
  }));

  const staticEntries = [
    {
      url: 'https://hpyhn.xyz',
      lastModified: new Date().toISOString(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: 'https://hpyhn.xyz/ask',
      lastModified: new Date().toISOString(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: 'https://hpyhn.xyz/newest',
      lastModified: new Date().toISOString(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: 'https://hpyhn.xyz/show',
      lastModified: new Date().toISOString(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: 'https://hpyhn.xyz/weekly',
      lastModified: new Date().toISOString(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const allEntries = [...staticEntries, ...postEntries];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  allEntries.forEach(entry => {
    xml += `  <url>\n`;
    xml += `    <loc>${entry.url}</loc>\n`;
    xml += `    <lastmod>${entry.lastModified}</lastmod>\n`;
    xml += `    <changefreq>${entry.changeFrequency}</changefreq>\n`;
    xml += `    <priority>${entry.priority}</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}