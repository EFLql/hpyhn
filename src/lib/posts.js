export async function getPosts() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || 'https://hpyhn.xyz/worker'}/api/posts?type=front-page`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const posts = await response.json();
    return posts;
  } catch (error) {
    console.error("Error fetching posts for sitemap:", error);
    return [];
  }
}