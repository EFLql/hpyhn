import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import getYouTubeCaptions from 'youtube-captions-scraper'
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 创建代理代理（如果设置了代理环境变量）
console.log('HTTP_PROXY:', process.env.HTTP_PROXY);
console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY);

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;

if (agent) {
  console.log('代理已配置:', proxyUrl);
} else {
  console.log('未配置代理');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { hnId, url } = req.body

  if (!hnId) {
    return res.status(400).json({ error: 'Missing hnId' })
  }

  if (!url) {
    return res.status(400).json({ error: 'Missing url' })
  }

  try {
    let finalUrl = url
    let content = await fetchContentWithRetry(finalUrl)

    // 如果原始链接失败或需要登录，尝试 Web Archive
    if (!content || requiresLogin(content)) {
      console.log(`尝试使用 Web Archive 获取内容: ${finalUrl}`)
      const archiveUrl = `https://web.archive.org/web/${finalUrl}`
      content = await fetchContentWithRetry(archiveUrl)
      if (content) finalUrl = archiveUrl
    }

    // 如果内容是PDF，则解析PDF
    if (isPdfUrl(finalUrl) && content) {
      content = await extractPdfContent(content)
    }

    // 如果是YouTube视频，提取字幕
    if (isYouTubeUrl(finalUrl) && !content) {
      content = await extractYouTubeCaptions(finalUrl)
    }

    if (content) {
      // 这里可以调用 LLM API 进行总结
      const summary = await summarizeContent(content)
      
      return res.status(200).json({ 
        message: 'Content fetched and summarized successfully',
        finalUrl,
        summary
      })
    } else {
      return res.status(404).json({ error: 'Content not found' })
    }
  } catch (error) {
    console.error('处理内容时出错:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function fetchContentWithRetry(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      // 配置 fetch 选项
      const fetchOptions = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };
      
      // 如果有代理，添加代理代理
      if (agent) {
        fetchOptions.agent = agent;
      }
      
      // 使用 node-fetch 而不是全局 fetch
      const res = await fetch(url, fetchOptions)
      
      // 如果是PDF，返回Buffer
      if (isPdfUrl(url)) {
        return await res.arrayBuffer()
      }
      
      const html = await res.text()
      
      // 如果是普通网页，提取正文
      if (!isYouTubeUrl(url) && !isPdfUrl(url)) {
        const dom = new JSDOM(html, { url });
        const document = dom.window.document;
        const reader = new Readability(document);
        const article = reader.parse();
        return article ? article.textContent : html;
      }
      
      return html
    } catch (err) {
      console.error(`抓取失败 (尝试 ${i + 1}/${retries + 1}): ${url}`, err.message)
      if (i === retries) {
        return null
      }
      // 等待一段时间再重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}

function isPdfUrl(url) {
  return url.toLowerCase().endsWith('.pdf') || 
         (typeof url === 'string' && url.includes('.pdf?'))
}

function isYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  return youtubeRegex.test(url);
}

// 使用 Python 脚本解析 PDF
async function extractPdfContent(buffer) {
  return new Promise((resolve, reject) => {
    // 创建临时文件
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `temp_pdf_${Date.now()}.pdf`);
    
    // 将 buffer 写入临时文件
    fs.writeFile(tempFilePath, Buffer.from(buffer), async (err) => {
      if (err) {
        console.error('创建临时PDF文件失败:', err);
        return resolve(null);
      }
      
      try {
        // 调用 Python 脚本
        const pythonScriptPath = path.join(__dirname, '../../../scripts', 'parse_pdf.py');
        const pythonProcess = spawn('python3', [pythonScriptPath, tempFilePath]);
        
        let result = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          // 删除临时文件
          fs.unlink(tempFilePath, () => {});
          
          if (code !== 0) {
            console.error('Python 脚本执行失败:', errorOutput);
            return resolve(null);
          }
          
          try {
            const parsedResult = JSON.parse(result);
            resolve(parsedResult.result);
          } catch (parseError) {
            console.error('解析 Python 脚本输出失败:', parseError);
            resolve(null);
          }
        });
      } catch (error) {
        // 删除临时文件
        fs.unlink(tempFilePath, () => {});
        console.error('调用 Python 脚本时出错:', error);
        resolve(null);
      }
    });
  });
}

async function extractYouTubeCaptions(url) {
  try {
    // 从URL中提取视频ID
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      console.error('无法从URL中提取YouTube视频ID:', url);
      return null;
    }

    // 获取字幕
    const captions = await getYouTubeCaptions.getSubtitles({
      videoID: videoId,
      lang: 'en' // 优先获取英文 subtitles
    });

    // 如果没有英文字幕，尝试获取默认字幕
    if (!captions || captions.length === 0) {
      const defaultCaptions = await getYouTubeCaptions.getSubtitles({
        videoID: videoId
      });
      
      if (!defaultCaptions || defaultCaptions.length === 0) {
        console.log('该视频没有可用的字幕');
        return null;
      }
      
      return defaultCaptions.map(caption => caption.text).join(' ');
    }

    // 将字幕文本连接起来
    return captions.map(caption => caption.text).join(' ');
  } catch (error) {
    console.error('YouTube字幕提取失败:', error);
    return null;
  }
}

function getYouTubeVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function requiresLogin(html) {
  return html.includes('login') || 
         html.includes('sign in') || 
         html.includes('requires authentication')
}

// 调用 OpenAI API 进行内容总结
async function summarizeContent(content) {
  // 如果内容为空或太短，直接返回
  if (!content || content.length < 50) {
    return {
      articleType: '无法提取类型',
      contentSummary: content || '无法提取内容',
      keywords: '无法提取关键词'
    };
  }
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // 配置 fetch 选项
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: `${process.env.OPENAI_MODEL_NAME}`,
          messages: [
            {
              role: 'system',
              content: '你是一个文章类型判断，关键词提取专家，帮助用户提取文章得以下内容： \n文章类型：xxx \n文章大体内容：一句话描述 \n关键词：关键词1,关键词2,关键词3\n请严格按照以上格式输出，不要添加其他内容。'
            },
            {
              role: 'user',
              content: `${content}`
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        })
      };
      
      // 如果有代理，添加代理代理
      if (agent) {
        fetchOptions.agent = agent;
        console.log('使用代理请求 OpenAI API');
      }
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', fetchOptions);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`OpenAI API 错误 (尝试 ${attempt}/3):`, errorData);
        if (attempt === 3) {
          throw new Error(`OpenAI API 请求失败: ${response.status} ${response.statusText}`);
        }
        continue;
      }
      
      const data = await response.json();
      const resultText = data.choices[0].message.content.trim();
      
      // 解析结果
      const parsedResult = parseSummaryResult(resultText);
      
      // 检查是否所有字段都存在
      if (parsedResult.articleType && parsedResult.contentSummary && parsedResult.keywords) {
        return parsedResult;
      } else {
        console.log(`解析结果不完整 (尝试 ${attempt}/3):`, parsedResult);
        if (attempt === 3) {
          // 最后一次尝试，使用默认值填充缺失字段
          return {
            articleType: parsedResult.articleType || '无法提取类型',
            contentSummary: parsedResult.contentSummary || '无法提取内容',
            keywords: parsedResult.keywords || '无法提取关键词'
          };
        }
      }
    } catch (error) {
      console.error(`调用 OpenAI API 时出错 (尝试 ${attempt}/3):`, error.message);
      if (attempt === 3) {
        // 如果三次都失败，返回默认结果
        return {
          articleType: '无法提取类型',
          contentSummary: '无法提取内容',
          keywords: '无法提取关键词'
        };
      }
    }
  }
}

// 解析摘要结果
function parseSummaryResult(text) {
  const result = {
    articleType: null,
    contentSummary: null,
    keywords: null
  };
  
  // 提取文章类型
  const typeMatch = text.match(/文章类型[:：]\s*(.+?)(?=\n|$)/i);
  if (typeMatch) {
    result.articleType = typeMatch[1].trim();
  }
  
  // 提取文章大体内容
  const summaryMatch = text.match(/文章大体内容[:：]\s*(.+?)(?=\n|$)/i);
  if (summaryMatch) {
    result.contentSummary = summaryMatch[1].trim();
  }
  
  // 提取关键词
  const keywordsMatch = text.match(/关键词[:：]\s*(.+?)(?=\n|$)/i);
  if (keywordsMatch) {
    result.keywords = keywordsMatch[1].trim();
  }
  
  return result;
}