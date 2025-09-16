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
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    const { email, turnstileToken } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    // Email 格式校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }
    if (!turnstileToken) {
      return res.status(400).json({ message: 'Security verification required.' });
    }

    // 校验 Turnstile token
    try {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return res.status(403).json({ message: 'Security verification failed.' });
      }
    } catch (err) {
      console.error('Turnstile verification error:', err);
      return res.status(500).json({ message: 'Security verification error.' });
    }

    try {
      const { data, error } = await supabase
        .from('beta_signups')
        .insert([{ email }]);

      if (error) {
        throw error;
      }

      return res.status(201).json({ message: 'Subscription successful!', data });
    } catch (error) {
      console.error('Supabase subscription error:', error.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}