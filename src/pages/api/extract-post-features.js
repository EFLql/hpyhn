import { spawn } from 'child_process';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { hnId, title, points, author, comments_count, summary } = req.body

  if (!hnId) {
    return res.status(400).json({ error: 'Missing hnId' })
  }

  try {
    // 提取帖子特征（调用Python脚本）
    const features = await extractFeaturesWithPython({
      hn_id: hnId,
      title,
      points,
      author,
      comments_count,
      summary
    });

    if (features && !features.error) {
      return res.status(200).json({ 
        message: 'Features extracted successfully',
        features
      })
    } else {
      return res.status(404).json({ error: 'Failed to extract features', details: features?.error })
    }
  } catch (error) {
    console.error('处理特征时出错:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// 调用Python脚本提取特征
async function extractFeaturesWithPython(postData) {
  return new Promise((resolve, reject) => {
    try {
      // 准备传递给Python脚本的参数
      const pythonScriptPath = path.join(process.cwd(), 'scripts', 'extract_features.py');
      
      // 构造参数
      const args = [
        pythonScriptPath,
        '--points', postData.points?.toString() || '0',
        '--comments', postData.comments_count?.toString() || '0',
        '--summary', JSON.stringify(postData.summary || {})
      ];

      // 调用Python脚本
      const pythonProcess = spawn('python3', args);
      
      let result = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python脚本执行失败，退出码: ${code}`);
          console.error('错误输出:', errorOutput);
          reject(new Error(`Python脚本执行失败: ${errorOutput}`));
          return;
        }
        
        try {
          // 解析Python脚本返回的JSON结果
          const features = JSON.parse(result);
          resolve(features);
        } catch (parseError) {
          console.error('解析Python脚本输出失败:', parseError);
          console.error('原始输出:', result);
          reject(new Error('解析Python脚本输出失败'));
        }
      });
      
      // 设置超时
      pythonProcess.on('error', (error) => {
        reject(new Error(`启动Python进程失败: ${error.message}`));
      });
      
      // 10秒超时（特征提取可能需要更长时间）
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Python脚本执行超时'));
      }, 10000);
    } catch (error) {
      reject(error);
    }
  });
}