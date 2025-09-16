// In-memory rate limit store
const rateLimitStore = {};
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window per IP

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = [];
  }
  // Remove expired timestamps
  rateLimitStore[ip] = rateLimitStore[ip].filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (rateLimitStore[ip].length >= RATE_LIMIT_MAX) {
    return false;
  }
  rateLimitStore[ip].push(now);
  return true;
}
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Rate limiting by IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let hnId;
    try {
      const urlObj = new URL(url);
      const idParam = urlObj.searchParams.get('id');
      if (!idParam) {
        throw new Error('Could not extract HN ID from URL');
      }
      hnId = idParam;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid Hacker News URL provided.' });
    }

    try {
      const { data, error } = await supabase
        .from('hn_posts')
        .select('title, url, user_id, created_at, content_summary, summary_comments')
        .eq('hn_id', hnId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          return res.status(404).json({ error: 'Hacker News post not found.' });
        }
        throw error;
      }

      return res.status(200).json({
        title: data.title,
        url: data.url,
        user_id: data.user_id,
        created_at: data.created_at,
        content_summary: data.content_summary,
        summary_comments: data.summary_comments,
      });
    } catch (e) {
      console.error('Backend API error:', e);
      return res.status(500).json({ error: 'Failed to fetch analysis from backend: ' + e.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
