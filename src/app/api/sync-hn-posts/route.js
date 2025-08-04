import { syncHnPosts } from '../../../scripts/sync-hn-posts'

export async function GET() {
  const result = await syncHnPosts()
  return Response.json(result)
}