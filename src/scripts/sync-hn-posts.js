import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 获取 HN 不同类型的文章ID - 修改为使用 Algolia API
async function fetchTopStories(type = 'front_page', limit = 200) {
  let url;
  
  switch(type) {
    case 'front_page':
      url = `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`;
      break;
    case 'news':
      url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=${limit}`;
      break;
    case 'ask':
      url = `https://hn.algolia.com/api/v1/search_by_date?tags=ask_hn&hitsPerPage=${limit}`;
      break;
    case 'show':
      url = `https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=${limit}`;
      break;
    default:
      url = `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`;
  }
  
  const res = await fetch(url)
  const data = await res.json()
  return data.hits
}

// 获取单篇文章详情 - 修改为使用 Algolia API
async function fetchStory(id) {
  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/items/${id}`)
    if (!res.ok) {
      throw new Error(`获取文章失败: ${res.status} ${res.statusText}`);
    }
    return res.json()
  } catch (error) {
    console.error(`获取文章 ${id} 失败:`, error);
    return { children: [] }; // 返回空评论数组作为后备
  }
}

// 修改后的获取评论函数
async function fetchComments(postId) {
  try {
    // 先获取帖子详情
    const story = await fetchStory(postId);
    
    // 检查是否有评论
    if (!story.children || story.children.length === 0) {
      console.log(`文章 ${postId} 没有评论`);
      return;
    }
    
    // 只取前3条评论
    const top3Comments = story.children.slice(0, 3);
    
    console.log(`开始处理文章 ${postId} 的 ${top3Comments.length} 条评论...`);
    
    for (const comment of top3Comments) {
      try {
        if (!comment || !comment.text) continue

        // 保存评论
        const { error } = await supabase
          .from('hn_comments')
          .upsert({
            hn_id: comment.id,
            post_id: postId,
            text: comment.text,
            user_id: comment.author || 'anonymous',
            parent_id: comment.parent_id || null,
            created_at: new Date(comment.created_at_i * 1000).toISOString()
          }, {
            onConflict: 'hn_id'
          })

        if (error) console.error(`评论同步失败 ${comment.id}:`, error)
        
        await new Promise(resolve => setTimeout(resolve, 200)) // 限速
      } catch (error) {
        console.error(`处理评论 ${comment.id} 失败:`, error)
      }
    }
  } catch (error) {
    console.error(`获取文章 ${postId} 的评论失败:`, error)
  }
}

// 同步到 Supabase - 修改为批量写入
export async function syncHnPosts(type = 'front_page', limit = 200) {
  try {
    console.log(`开始同步 Hacker News ${type} 数据，数量: ${limit}，偏移: ${offset}...`)
    const stories = await fetchTopStories(type, limit)
    
    // 应用偏移量
    const storiesToProcess = stories
    
    if (storiesToProcess.length === 0) {
      console.log('没有更多文章需要处理')
      return { processed: 0, hasMore: false }
    }

    // 准备批量插入的数据
    const postsToInsert = storiesToProcess
      .filter(story => story && story.title && story.story_id) // 确保有必要字段
      .map(story => ({
        hn_id: story.story_id,
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        points: story.points || 0,
        user_id: story.author || 'anonymous',
        descendants: story.num_comments || 0,
        created_at: new Date(story.created_at_i * 1000).toISOString(),
        text: story.story_text || ''
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
    
    // 返回是否还有更多文章需要处理
    return { 
      processed: savedPosts, 
      hasMore: storiesToProcess.length === 10 && savedPosts === 10 
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