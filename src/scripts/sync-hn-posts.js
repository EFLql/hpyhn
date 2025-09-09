import { createClient } from '@supabase/supabase-js'
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 获取 HN 不同类型的文章ID - 修改为使用官方 API
async function fetchTopStories(type = 'front_page', limit = 200) {
  let url;
  
  switch(type) {
    case 'front_page':
      // Hacker News 官方 API 获取 top stories
      const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
      const topStoriesIds = await topStoriesRes.json()
      return topStoriesIds.slice(0, limit);
    case 'news':
      // Hacker News 官方 API 获取 new stories
      const newStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/newstories.json')
      const newStoriesIds = await newStoriesRes.json()
      return newStoriesIds.slice(0, limit);
    case 'ask':
      // Hacker News 官方 API 获取 ask stories
      const askStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/askstories.json')
      const askStoriesIds = await askStoriesRes.json()
      return askStoriesIds.slice(0, limit);
    case 'show':
      // Hacker News 官方 API 获取 show stories
      const showStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/showstories.json')
      const showStoriesIds = await showStoriesRes.json()
      return showStoriesIds.slice(0, limit);
    default:
      // 默认获取 top stories
      const defaultStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
      const defaultStoriesIds = await defaultStoriesRes.json()
      return defaultStoriesIds.slice(0, limit);
  }
}

// 获取单篇文章详情 - 修改为使用官方 API
async function fetchStory(id) {
  try {
    const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
    if (!res.ok) {
      throw new Error(`获取文章失败: ${res.status} ${res.statusText}`);
    }
    return res.json()
  } catch (error) {
    console.error(`获取文章 ${id} 失败:`, error);
    return {}; // 返回空对象作为后备
  }
}


// 调用 AWS Lambda 接口 - 使用 IAM 认证
async function invokeLambda(payload, endpoint) {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  // 解析 hostname 和 path
  const url = new URL(endpoint);
  const hostname = url.hostname;
  const path = url.pathname + url.search;

  const body = JSON.stringify(payload);

  const request = new HttpRequest({
    method: 'POST',
    protocol: 'https:',
    path,
    hostname,
    headers: {
      'Content-Type': 'application/json',
      'Host': hostname
    },
    body
  });

  const signer = new SignatureV4({
    service: 'execute-api',
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    sha256: Sha256
  });

  const signedRequest = await signer.sign(request);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: signedRequest.headers,
    body
  });

  if (!res.ok) {
    console.error('API Gateway 调用失败:', res.status, res.statusText);
    //throw new Error(`API Gateway 调用失败: ${res.status} ${res.statusText}`);
  }
  else  {
    const text = await res.text();
    console.log('API Gateway 调用成功:', text);
  }

  return res;
}
// 同步到 Supabase - 修改为批量写入
export async function syncHnPosts(type = 'front_page', limit = 200) {
  try {
    console.log(`开始同步 Hacker News ${type} 数据，数量: ${limit}...`)
    const storyIds = await fetchTopStories(type, limit)
    
    // 获取每个故事的详细信息
    const stories = [];
    for (const id of storyIds) {
      const story = await fetchStory(id);
      if (story && story.title) {
        stories.push(story);
      }
      // 添加延迟以避免过于频繁的请求
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (stories.length === 0) {
      console.log('没有更多文章需要处理')
      return { processed: 0, hasMore: false }
    }

    // 准备批量插入的数据
    const postsToInsert = stories
      .filter(story => story && story.title && story.id) // 确保有必要字段
      .map(story => ({
        hn_id: story.id,
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        points: story.score || 0,
        user_id: story.by || 'anonymous',
        descendants: story.descendants || 0,
        created_at: new Date(story.time * 1000).toISOString(),
        text: story.text || ''
      }));
    
    // Fetch existing updated_posts to determine what needs to be updated or deleted
    const { data: existingUpdatedPosts, error: updatedPostsError } = await supabase
        .from('updated_posts')
        .select('hn_id')
        .eq('post_type', type);

    if (updatedPostsError) {
        console.error('Error fetching existing updated_posts:', updatedPostsError);
        return { error: updatedPostsError.message };
    }

    const existingUpdatedHnIds = new Set(existingUpdatedPosts.map(post => post.hn_id));

    // Fetch descendants for all posts that are currently in updated_posts from hn_posts table
    // This is needed to compare descendants for existing posts
    const { data: existingHnPostsForComparison, error: hnPostsForComparisonError } = await supabase
        .from('hn_posts')
        .select('hn_id, descendants')
        .in('hn_id', Array.from(existingUpdatedHnIds));

    if (hnPostsForComparisonError) {
        console.error('Error fetching existing hn_posts for comparison:', hnPostsForComparisonError);
        return { error: hnPostsForComparisonError.message };
    }

    const existingHnPostsMap = new Map(existingHnPostsForComparison.map(post => [post.hn_id, post.descendants]));

    // Process posts for updated_posts table
    const updatedPostsToUpsert = [];
    const hnIdsToConsiderForDeletion = new Set(existingUpdatedHnIds); // Keep track of existing IDs in updated_posts

    for (const post of postsToInsert) {
        const hnId = post.hn_id;
        const currentDescendants = post.descendants;

        if (existingUpdatedHnIds.has(hnId)) {
            // This hnId was in updated_posts before, so remove it from consideration for deletion of "extra" items
            hnIdsToConsiderForDeletion.delete(hnId);

            // Case 2: ID already exists, compare descendants
            const existingDescendants = existingHnPostsMap.get(hnId);
            if (existingDescendants === currentDescendants) {
                // Descendants are the same, update update_time, set need_update to false
                updatedPostsToUpsert.push({ hn_id: hnId, update_time: new Date().toISOString(), post_type: type, need_update: false });
            } else {
                // Descendants are different, update update_time, set need_update to true
                updatedPostsToUpsert.push({ hn_id: hnId, update_time: new Date().toISOString(), post_type: type, need_update: true });
            }
        } else {
            // Case 1: New post ID, add to updated_posts with need_update: true
            updatedPostsToUpsert.push({ hn_id: hnId, update_time: new Date().toISOString(), post_type: type, need_update: true });
        }
    }

     // 批量插入主贴到 hn_posts 表
    if (postsToInsert.length > 0) {
      // Replace batch upsert with sequential insertion to preserve order
      for (const post of postsToInsert) {
        const { error } = await supabase
          .from('hn_posts')
          .upsert(post, {
            onConflict: 'hn_id'
          });
        if (error) {
          console.error(`主贴同步失败 ${post.hn_id}:`, error);
        }
      }
    }

    // Perform batch upserts for updated_posts
    if (updatedPostsToUpsert.length > 0) {
        const { error } = await supabase
            .from('updated_posts')
            .upsert(updatedPostsToUpsert, { onConflict: 'hn_id,post_type' });
        if (error) {
            console.error('Error upserting into updated_posts:', error);
        }
    }

    // Case 3: Handle extra hn_id in updated_posts (those remaining in hnIdsToConsiderForDeletion)
    const hnIdsToRemoveFromUpdatedPosts = Array.from(hnIdsToConsiderForDeletion);

    if (hnIdsToRemoveFromUpdatedPosts.length > 0) {
        const { error } = await supabase
            .from('updated_posts')
            .delete()
            .eq('post_type', type)
            .in('hn_id', hnIdsToRemoveFromUpdatedPosts);
        if (error) {
            console.error('Error deleting extra hn_ids from updated_posts:', error);
        }
    }


    // 准备分类表的批量插入数据
    const now = Date.now();                     // 基准时间
    const typePostsToInsert = postsToInsert.map((post, idx) => ({
      post_id: post.hn_id,
      // 为每条记录加上不同的毫秒数，确保时间唯一
      update_time: new Date(now + idx).toISOString()
    }));

    // ------------------------------------------------------------
    // 2️⃣ 批量 upsert 到对应的分类表（一次写入，提高性能）
    // ------------------------------------------------------------
    if (typePostsToInsert.length > 0) {
      try {
        switch (type) {
          case 'front_page':
            await supabase
              .from('hn_front_page_posts')
              .upsert(typePostsToInsert, { onConflict: 'post_id' });
            break;
          case 'news':
            await supabase
              .from('hn_news_posts')
              .upsert(typePostsToInsert, { onConflict: 'post_id' });
            break;
          case 'ask':
            await supabase
              .from('hn_ask_posts')
              .upsert(typePostsToInsert, { onConflict: 'post_id' });
            break;
          case 'show':
            await supabase
              .from('hn_show_posts')
              .upsert(typePostsToInsert, { onConflict: 'post_id' });
            break;
        }
      } catch (error) {
        console.error(`分类表批量同步失败 (${type}):`, error);
      }
    }

    const savedPosts = postsToInsert.length;
    console.log(`Hacker News ${type} 数据同步完成，共保存 ${savedPosts} 篇文章`)
    if (type == 'show') {
      const payload = {
        type: type,
        count: savedPosts,
        timestamp: new Date().toISOString()
      };
      // 你的 API Gateway endpoint summary and features extraction
      let endpoint = 'https://b9zo4r44jc.execute-api.us-east-1.amazonaws.com/summary_feature_gen_asyn';
      await invokeLambda(payload, endpoint);
      //comments processing
      endpoint = 'https://b9zo4r44jc.execute-api.us-east-1.amazonaws.com/comments_summary_asyn';
      await invokeLambda(payload, endpoint);
    }
    
    // 返回是否还有更多文章需要处理
    return { 
      processed: savedPosts, 
      [type]: postsToInsert, // type 作为 key，帖子详细信息作为 value
      hasMore: stories.length === limit 
    }
  } catch (error) {
    console.error('同步错误:', error)
    return { error: error.message }
  }
}

// 直接执行脚本时运行
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const type = args[0] || 'front_page';
  const limit = parseInt(args[1]) || 200;
  syncHnPosts(type, limit)
}