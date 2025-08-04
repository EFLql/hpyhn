import { createClient } from '@supabase/supabase-js'
import { SuffixPathnameNormalizer } from 'next/dist/server/normalizers/request/suffix';

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
    console.log('开始提取帖子特征...');
    
    // 获取没有特征信息的帖子（限制每次处理的数量）
    const { data: posts, error } = await supabase
      .from('hn_posts')
      .select('hn_id, title, points, author, comments_count, content_summary')
      .is('post_features', null)
      .not('content_summary', 'is', null)
      .limit(20) // 每次处理20个帖子

    if (error) {
      throw new Error(`获取帖子列表失败: ${error.message}`);
    }

    if (!posts || posts.length === 0) {
      console.log('没有需要提取特征的帖子');
      return res.status(200).json({ message: '没有需要提取特征的帖子' });
    }

    console.log(`开始处理 ${posts.length} 个帖子的特征...`);

    // 存储需要更新的特征数据
    const featureUpdates = [];
    
    for (const post of posts) {
      try {
        // 调用 extract-post-features API 获取帖子特征
        const apiRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/extract-post-features`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            hnId: post.hn_id,
            title: post.title,
            points: post.points,
            author: post.author,
            comments_count: post.comments_count,
            summary: post.content_summary
          })
        });

        if (apiRes.ok) {
          const result = await apiRes.json();
          console.log(`帖子 ${post.hn_id} 特征提取成功`);
          
          // 准备批量更新数据
          if (result.features) {
            featureUpdates.push({
              hn_id: post.hn_id,
              post_features: result.features
            });
          }
        } else {
          const result = await apiRes.json();
          console.error(`帖子 ${post.hn_id} 特征提取失败:`, result.error);
        }

        // 添加延迟避免触发频率限制
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`处理帖子 ${post.hn_id} 特征时出错:`, error);
      }
    }

    // 批量更新特征数据到数据库
    if (featureUpdates.length > 0) {
      const { error: updateError } = await supabase
        .from('hn_posts')
        .upsert(featureUpdates, { onConflict: 'hn_id' });

      if (updateError) {
        console.error('批量更新帖子特征失败:', updateError);
        return res.status(500).json({ error: 'Feature update failed' });
      }

      console.log(`成功批量更新 ${featureUpdates.length} 个帖子的特征`);
    }

    console.log(`帖子特征提取任务完成，共处理 ${featureUpdates.length} 个帖子`);
    
    return res.status(200).json({ 
      message: '帖子特征提取任务完成', 
      processed: featureUpdates.length 
    });
  } catch (error) {
    console.error('帖子特征提取任务失败:', error);
    return res.status(500).json({ error: error.message });
  }
}