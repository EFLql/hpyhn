import { createClient } from '@supabase/supabase-js'
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { Sha256 } from '@aws-crypto/sha256-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
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

// 修改后的获取评论函数
async function fetchComments(postId) {
  try {
    // 先获取帖子详情
    const story = await fetchStory(postId);
    
    // 检查是否有评论
    if (!story.kids || story.kids.length === 0) {
      console.log(`文章 ${postId} 没有评论`);
      return;
    }
    
    // 只取前3条评论
    const top3CommentIds = story.kids.slice(0, 3);
    
    console.log(`开始处理文章 ${postId} 的 ${top3CommentIds.length} 条评论...`);
    
    for (const commentId of top3CommentIds) {
      try {
        // 获取评论详情
        const comment = await fetchStory(commentId);
        
        if (!comment || !comment.text) continue

        // 保存评论
        const { error } = await supabase
          .from('hn_comments')
          .upsert({
            hn_id: comment.id,
            post_id: postId,
            text: comment.text,
            user_id: comment.by || 'anonymous',
            parent_id: comment.parent || null,
            created_at: new Date(comment.time * 1000).toISOString()
          }, {
            onConflict: 'hn_id'
          })

        if (error) console.error(`评论同步失败 ${comment.id}:`, error)
        
        await new Promise(resolve => setTimeout(resolve, 200)) // 限速
      } catch (error) {
        console.error(`处理评论 ${commentId} 失败:`, error)
      }
    }
  } catch (error) {
    console.error(`获取文章 ${postId} 的评论失败:`, error)
  }
}

// 调用 AWS Lambda 接口 - 使用 IAM 认证
async function invokeLambda(payload) {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  // 你的 API Gateway endpoint
  const endpoint = 'https://b9zo4r44jc.execute-api.us-east-1.amazonaws.com/summary_feature_gen';

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
    //const text = await res.text();
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

    // 批量插入主贴到 hn_posts 表
    if (postsToInsert.length > 0) {
      const { error: postError } = await supabase
        .from('hn_posts')
        .upsert(postsToInsert, {
          onConflict: 'hn_id'
        })

      if (postError) {
        console.error('主贴批量同步失败:', postError)
        // 如果批量插入失败，逐个插入
        for (const post of postsToInsert) {
          const { error: singleError } = await supabase
            .from('hn_posts')
            .upsert(post, {
              onConflict: 'hn_id'
            })
          if (singleError) {
            console.error(`主贴同步失败 ${post.hn_id}:`, singleError)
          }
        }
      }
    }

    // 准备分类表的批量插入数据
    const typePostsToInsert = postsToInsert.map(post => ({
      post_id: post.hn_id
    }));

    // 批量插入到对应的分类表
    if (typePostsToInsert.length > 0) {
      let typeError;
      switch(type) {
        case 'front_page':
          const { error: frontError } = await supabase
            .from('hn_front_page_posts')
            .upsert(typePostsToInsert, {
              onConflict: 'post_id'
            });
          typeError = frontError;
          break;
        case 'news':
          const { error: newsError } = await supabase
            .from('hn_news_posts')
            .upsert(typePostsToInsert, {
              onConflict: 'post_id'
            });
          typeError = newsError;
          break;
        case 'ask':
          const { error: askError } = await supabase
            .from('hn_ask_posts')
            .upsert(typePostsToInsert, {
              onConflict: 'post_id'
            });
          typeError = askError;
          break;
        case 'show':
          const { error: showError } = await supabase
            .from('hn_show_posts')
            .upsert(typePostsToInsert, {
              onConflict: 'post_id'
            });
          typeError = showError;
          break;
      }

      if (typeError) {
        console.error('分类表批量同步失败:', typeError)
        // 如果批量插入失败，逐个插入
        for (const typePost of typePostsToInsert) {
          let singleError;
          switch(type) {
            case 'front_page':
              const { error: frontSingleError } = await supabase
                .from('hn_front_page_posts')
                .upsert(typePost, {
                  onConflict: 'post_id'
                });
              singleError = frontSingleError;
              break;
            case 'news':
              const { error: newsSingleError } = await supabase
                .from('hn_news_posts')
                .upsert(typePost, {
                  onConflict: 'post_id'
                });
              singleError = newsSingleError;
              break;
            case 'ask':
              const { error: askSingleError } = await supabase
                .from('hn_ask_posts')
                .upsert(typePost, {
                  onConflict: 'post_id'
                });
              singleError = askSingleError;
              break;
            case 'show':
              const { error: showSingleError } = await supabase
                .from('hn_show_posts')
                .upsert(typePost, {
                  onConflict: 'post_id'
                });
              singleError = showSingleError;
              break;
          }
          
          if (singleError) {
            console.error(`分类表同步失败 ${typePost.post_id}:`, singleError)
          }
        }
      }
    }

    const savedPosts = postsToInsert.length;
    console.log(`Hacker News ${type} 数据同步完成，共保存 ${savedPosts} 篇文章`)
    
    // 调用 AWS Lambda 接口
    if (savedPosts > 0) {
      const payload = {
        type: type,
        count: savedPosts,
        timestamp: new Date().toISOString()
      };
      
      if (type == 'show') {
        await invokeLambda(payload);
      }
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