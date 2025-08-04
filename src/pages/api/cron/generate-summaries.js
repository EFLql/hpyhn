import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // 验证 cron auth token
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_AUTH_TOKEN}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    console.log('开始生成文章摘要...');
    
    // 获取没有摘要的文章（限制每次处理的数量）
    const { data: posts, error } = await supabase
      .from('hn_posts')
      .select('hn_id, url')
      .is('content_summary', null)
      .limit(10) // 每次只处理10篇文章，避免超时

    if (error) {
      throw new Error(`获取文章列表失败: ${error.message}`);
    }

    if (!posts || posts.length === 0) {
      console.log('没有需要生成摘要的文章');
      return res.status(200).json({ message: '没有需要生成摘要的文章' });
    }

    console.log(`开始处理 ${posts.length} 篇文章的摘要...`);

    // 存储需要更新的数据
    const updates = [];
    let processedCount = 0;
    
    for (const post of posts) {
      try {
        // 调用 fetch-content API 获取内容和摘要
        const apiRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/fetch-content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hnId: post.hn_id })
        });

        if (apiRes.ok) {
          const result = await apiRes.json();
          console.log(`文章 ${post.hn_id} 内容获取成功`);
          
          // 准备批量更新数据
          if (result.summary) {
            updates.push({
              hn_id: post.hn_id,
              content_summary: result.summary,
              url: result.finalUrl || post.url
            });
            processedCount++;
          }
        } else {
          const result = await apiRes.json();
          console.error(`文章 ${post.hn_id} 内容获取失败:`, result.error);
        }

        // 添加延迟避免触发频率限制
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`处理文章 ${post.hn_id} 时出错:`, error);
      }
    }

    // 批量更新数据库
    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from('hn_posts')
        .upsert(updates, { onConflict: 'hn_id' });

      if (updateError) {
        console.error('批量更新数据库失败:', updateError);
        return res.status(500).json({ error: 'Database update failed' });
      }

      console.log(`成功批量更新 ${updates.length} 篇文章的摘要`);
    }

    console.log(`摘要生成任务完成，共处理 ${processedCount} 篇文章`);
    return res.status(200).json({ 
      message: '摘要生成任务完成', 
      processed: processedCount 
    });
  } catch (error) {
    console.error('摘要生成任务失败:', error);
    return res.status(500).json({ error: error.message });
  }
}