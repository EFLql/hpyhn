import { getPosts } from '../lib/posts'; // Assuming a utility to fetch posts

export default async function sitemap() {
  const posts = await getPosts(); // Fetch all posts

  const postEntries = posts.map((post) => ({
    url: `https://hpyhn.xyz/posts/${post.hn_id}`,
    lastModified: new Date(post.created_at),
    changeFrequency: 'hourly',
    priority: 0.7,
  }));

  return [
    {
      url: 'https://hpyhn.xyz',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: 'https://hpyhn.xyz/ask',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: 'https://hpyhn.xyz/newest',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: 'https://hpyhn.xyz/show',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: 'https://hpyhn.xyz/weekly',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...postEntries, // Add dynamic post entries
  ];
}