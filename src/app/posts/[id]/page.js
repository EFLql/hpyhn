import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import remarkGfm from 'remark-gfm'; // Import remarkGfm

async function getPost(id) {
  const baseUrl = process.env.VERCEL_BACKEND_URL ? `https://${process.env.VERCEL_BACKEND_URL}` : 'http://localhost:3000';
  const apiUrl = `${baseUrl}/api/posts?hn_id=${id}`;
  console.log(`Fetching from: ${apiUrl}`); // Log the URL being fetched

  const res = await fetch(apiUrl);

  if (!res.ok) {
    const errorText = await res.text(); // Try to get the error response body
    console.error(`Failed to fetch data from ${apiUrl}. Status: ${res.status}, StatusText: ${res.statusText}, Response: ${errorText}`);
    throw new Error('Failed to fetch data');
  }
  return res.json();
}

// 解析摘要内容的函数
const parseSummaryContent = (summary) => {
  if (!summary) return null;
  
  // 如果是对象格式（包含 type, contentSummary, keywords）
  if (typeof summary === 'object') {
    return summary;
  }
  
  // 如果是字符串格式，尝试解析
  if (typeof summary === 'string') {
    try {
      // 尝试解析为 JSON
      const parsed = JSON.parse(summary);
      return parsed;
    } catch (e) {
      // 如果不是 JSON，当作纯文本处理
      return {
        contentSummary: summary
      };
    }
  }
  
  return null;
}

// Helper function to parse summary_comments
const parseSummaryComments = (summaryCommentsInput) => {
  let clusterSummaries = [];
  let overallPostSummary = null;

  if (!summaryCommentsInput) {
    return { cluster_summaries: clusterSummaries, overall_comments_summary_with_sentiment: overallPostSummary };
  }

  // Case 1: Input is already an object
  if (typeof summaryCommentsInput === 'object') {
    // New format: { cluster_summaries: [], overall_comments_summary_with_sentiment: "..." }
    
      overallPostSummary = typeof summaryCommentsInput.overall_comments_summary_with_sentiment === 'string' ? 
                           summaryCommentsInput.overall_comments_summary_with_sentiment
                             .replace(/^```markdown\s*\n?/, '') // Remove leading ```markdown and optional newline
                             .replace(/\n?```$/, '') // Remove optional newline and trailing ```
                             .replace(/\\n/g, '\n') // Replace any sequence of newline, optional whitespace, and two or more newlines with two newlines
                             .replace(/\n{3,}/g, '\n') // Normalize multiple newlines to at most two
                             .trim() : // Trim any remaining leading/trailing whitespace
                           null;
    if (summaryCommentsInput.cluster_summaries !== undefined) {
      clusterSummaries = Array.isArray(summaryCommentsInput.cluster_summaries) ? summaryCommentsInput.cluster_summaries : [];
    }
    // Old format: directly an array
    else if (Array.isArray(summaryCommentsInput)) {
      clusterSummaries = summaryCommentsInput;
    }
  }
  // Case 2: Input is a string, try to parse it as JSON
  else if (typeof summaryCommentsInput === 'string') {
    try {
      const parsed = JSON.parse(summaryCommentsInput);
      // New format after parsing: { cluster_summaries: [], overall_comments_summary_with_sentiment: "..." }
      
        overallPostSummary = typeof parsed.overall_comments_summary_with_sentiment === 'string' ? 
                             parsed.overall_comments_summary_with_sentiment
                               .replace(/^```markdown\s*\n?/, '') // Remove leading ```markdown and optional newline
                               .replace(/\n?```$/, '') // Remove optional newline and trailing ```
                               //.replace(/\\n/g, '\n') // Replace any sequence of newline, optional whitespace, and two or more newlines with two newlines
                               .replace(/\n{3,}/g, '\n') // Normalize multiple newlines to at most two
                               .trim() : // Trim any remaining leading/trailing whitespace
                             null;
      if (parsed.cluster_summaries !== undefined) {
        clusterSummaries = Array.isArray(parsed.cluster_summaries) ? parsed.cluster_summaries : [];
      }
      // Old format after parsing: directly an array
      else if (Array.isArray(parsed)) {
        clusterSummaries = parsed;
      }
    } catch (e) {
      console.error("Error parsing summary_comments string:", e);
      // If parsing fails, treat as no valid comments
    }
  }
  //console.log(`overallPostSummary:${overallPostSummary}`)
  return { cluster_summaries: clusterSummaries, overall_comments_summary_with_sentiment: overallPostSummary };
};

export async function generateMetadata({ params }) {
  const post = await getPost(params.id);
  return {
    title: post ? `${post.title} | Happy Hacker News` : 'Post Not Found',
  };
}

export default async function PostPage(props) {
  const params = await props.params;
  const post = await getPost(params.id);

  if (!post) {
    notFound();
  }

  return (
    <div className="w-full sm:w-4/5 mx-auto px-4 py-2 bg-orange-50 relative min-h-screen">
      <main className="bg-white px-2 sm:px-4">
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4 text-black">
            {post.url ? (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {post.title}
              </a>
            ) : (
              post.title
            )}
          </h1>
          <div className="flex flex-wrap items-baseline">
            {post.content_summary && (() => {
              const summaryData = parseSummaryContent(post.content_summary);
              if (summaryData && summaryData.type && summaryData.type !== 'Unable to get article type') {
                return (
                  <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded mr-1">
                    {summaryData.type}
                  </span>
                );
              }
            })()}
            {post.url && (
              <span className="text-gray-500 text-xs ml-1">
                ({new URL(post.url).hostname.replace('www.', '')})
              </span>
            )}
            {post.hn_id && (
              <a 
                href={`https://news.ycombinator.com/item?id=${post.hn_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline ml-2 text-orange-600 font-medium text-xs"
              >
                view on HackerNews
              </a>
            )}
          </div>
          {post.content_summary && (() => {
            const summaryData = parseSummaryContent(post.content_summary);
            if (summaryData && summaryData.keywords && summaryData.keywords !== 'Unable to get keywords') {
              const keywordsArr = summaryData.keywords.split(',').slice(0, 12);
              return (
                <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1">
                  {keywordsArr.map((kw, idx) => (
                    <span key={idx} className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded">{kw.trim()}</span>
                  ))}
                </div>
              );
            }
          })()}
          <p className="text-xs text-gray-500 mb-2">Author: {post.user?.username || 'anonymous'}</p>
          <p className="text-xs text-gray-500 mb-4">Date: {new Date(post.created_at).toLocaleDateString()}</p>
          {post.content_summary && (
            <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
              <div className="text-xs font-medium text-blue-800 mb-1">Article Summary:</div>
              <div className="text-xs text-gray-700">
                {(() => {
                  const summaryData = parseSummaryContent(post.content_summary);
                  if (!summaryData) return 'No summary content available';
                  
                  if (summaryData.content && summaryData.content !== 'Unable to generate content summary') {
                    return <div>{summaryData.content}</div>;
                  }
                  
                  return 'No summary content available';
                })()}
              </div>
            </div>
          )}
          
          {post.summary_comments && (() => {
            const { cluster_summaries, overall_comments_summary_with_sentiment } = parseSummaryComments(post.summary_comments);
            
            const sortedSummaryComments = cluster_summaries ? [...cluster_summaries].sort((a, b) => {
              if (a.label === -1 && b.label !== -1) return 1;
              if (a.label !== -1 && b.label === -1) return -1;
              
              return b.num_comments - a.num_comments;
            }) : [];

            return (overall_comments_summary_with_sentiment) ? (
              <div className="mt-2 space-y-4 border-l-2 pl-2 border-orange-200">
                {overall_comments_summary_with_sentiment && (
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <div className="text-xs font-medium text-blue-800 mb-1">comments analysis:</div>
                    <div
                      className="text-xm text-gray-700 break-words prose prose-sm max-w-none"
                    >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {overall_comments_summary_with_sentiment}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                {sortedSummaryComments.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-orange-800 mb-1">Comments Category:</div>
                    {sortedSummaryComments.map((commentCategory, categoryIndex) => (
                      <div key={categoryIndex} className="bg-orange-50 p-3 rounded">
                        <div className="font-bold text-sm text-orange-700 mb-1">
                          Category {commentCategory.label === -1 ? 'Uncategorized' : commentCategory.label} ({commentCategory.num_comments} comments)
                        </div>
                        {commentCategory.theme && (
                          <div className="mt-1 p-2 bg-purple-50 rounded border border-purple-200">
                            <div className="text-xs font-medium text-purple-800 mb-1">Category Theme:</div>
                            <div className="text-xs text-gray-700">
                              {commentCategory.theme}
                            </div>
                          </div>
                        )}
                        <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                          <div className="text-xs font-medium text-blue-800 mb-1">Category Summary:</div>
                          <div className="text-xs text-gray-700">
                            {commentCategory.summary || 'No summary available.'}
                          </div>
                        </div>
                        {commentCategory.comments && commentCategory.comments.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-gray-600 p-2">Typical Comments below:</div>
                            {commentCategory.comments.map((comment, commentIndex) => (
                              <div key={commentIndex} className="text-xs text-gray-600 border-t border-gray-200 pt-2">
                                <div className="font-medium text-gray-800">
                                  {comment.author || 'anonymous'} · 
                                  {new Date(comment.created_at).toLocaleDateString()}
                                  {comment.hn_id && (
                                    <a
                                      href={`https://news.ycombinator.com/item?id=${comment.hn_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-1 text-orange-600 hover:underline"
                                    >
                                      view on HN
                                    </a>
                                  )}
                                </div>
                                {comment.summary && (
                                  <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                                    <div className="text-xs font-medium text-blue-800 mb-1">Comment Summary:</div>
                                    <div className="text-xs text-gray-700">
                                      {comment.summary}
                                    </div>
                                  </div>
                                )}
                                <div 
                                  className="mt-1 whitespace-pre-wrap break-words max-w-none"
                                  dangerouslySetInnerHTML={{ __html: comment.text }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 mt-2">
                { (post.comments_count > 0 || post.descendants > 0) ? 
                  'No comments analysis available for this post now.' : 
                  'No comments available for this post.' 
                }
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
