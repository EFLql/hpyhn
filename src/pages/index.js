import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Home() {
  const [url, setUrl] = useState('https://news.ycombinator.com/item?id=45229799');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState(''); // New state for email input
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false); // New state for email submission loading
  const [emailSubmitMessage, setEmailSubmitMessage] = useState(null); // New state for email submission message
  const [turnstileToken, setTurnstileToken] = useState(''); // 新增 Turnstile token 状态
  const turnstileWidgetRef = useRef(null);
  // Turnstile 客户端渲染逻辑
  useEffect(() => {
    // 只在客户端执行
    if (typeof window === 'undefined') return;
    // 加载 Turnstile 脚本
    if (!window.turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      document.body.appendChild(script);
      script.onload = renderTurnstile;
    } else {
      renderTurnstile();
    }

    function renderTurnstile() {
      if (window.turnstile && turnstileWidgetRef.current) {
        window.turnstile.render(turnstileWidgetRef.current, {
          sitekey: '0x4AAAAAAB1gi5HPX_NQ6ooE',
          theme: 'dark',
          callback: (token) => {
            setTurnstileToken(token);
          },
        });
      }
    }
    // 清理函数：卸载时销毁 widget
    return () => {
      if (turnstileWidgetRef.current) {
        turnstileWidgetRef.current.innerHTML = '';
      }
    };
  }, []);

  const handleAnalyzeClick = async () => {
    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);

    try {
      // Replace with your actual backend API endpoint
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResult(data);
    } catch (e) {
      setError('Failed to fetch analysis: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    setEmailSubmitMessage(null);

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailSubmitMessage('Please enter a valid email address.');
      return;
    }
    if (!turnstileToken) {
      setEmailSubmitMessage('Please complete the security verification first.');
      return;
    }
    setIsSubmittingEmail(true);

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, turnstileToken }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setEmailSubmitMessage(data.message);
      setEmail(''); // Clear email input on success
      setTurnstileToken(''); // 清空 token
      // 重新渲染 Turnstile
      if (window.turnstile && window.turnstile.render) {
        window.turnstile.render('#turnstile-widget');
      }
    } catch (e) {
      setEmailSubmitMessage('Failed to subscribe: ' + e.message);
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <Head>
        <title>Hacker News AI Analyst</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        {/* Hero Section */}
        <section className="hero-section flex flex-col lg:flex-row items-center justify-between px-8 py-16 max-w-6xl mx-auto">
          <div className="text-content lg:w-1/2">
            <div className="flex items-center mb-4">
              {/* Placeholder for Logo */}
              <div className="w-8 h-8 bg-hnOrange rounded-full mr-2"></div>
              <span className="text-xl font-bold">HPYHN</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-4">
              Stop Scrolling. Start Understanding Hacker News.
            </h1>
            <h2 className="text-xl text-gray-300 mb-8">
              AI-powered summaries, comment analysis, and personalized interest scoring for the posts you <em className="text-hnOrange">actually</em> care about.
            </h2>
            <div className="cta-buttons flex space-x-4">
              <Link href="#early-access" className="bg-hnOrange text-white font-bold py-3 px-6 rounded-md hover:opacity-90 transition-opacity">
                Get Early Access
              </Link>
              <Link href="#demo" className="text-hnOrange border border-hnOrange py-3 px-6 rounded-md hover:bg-hnOrange hover:text-white transition-colors">
                  View Live Demo ↓
              </Link>
            </div>
            {/* Social Proof */}
            <p className="text-gray-400 mt-4">
              Join 150+ HN readers on the waitlist.
            </p>
          </div>
          <div className="visual-element lg:w-1/2 mt-8 lg:mt-0 flex justify-center">
            {/* Wistia Video Embed */}
            <div className="w-full max-w-md bg-gray-800 rounded-lg">
              <div
                dangerouslySetInnerHTML={{
                  __html: `
                    <script src="https://fast.wistia.com/player.js" async></script>
                    <script src="https://fast.wistia.com/embed/i4cgou8w6k.js" async type="module"></script>
                    <style>wistia-player[media-id='i4cgou8w6k']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/i4cgou8w6k/swatch'); display: block; filter: blur(5px); padding-top:53.13%; }</style>
                    <wistia-player media-id="i4cgou8w6k" aspect="1.8823529411764706"></wistia-player>
                  `,
                }}
              />
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section id="demo" className="demo-section bg-gray-800 px-8 py-16 max-w-6xl mx-auto rounded-lg shadow-lg mt-16">
          <h2 className="text-4xl font-bold text-center mb-12">How It Works</h2>
          <div className="flex flex-col items-center">
            <div className="flex w-full max-w-full mb-8"> {/* Changed max-w-xl to max-w-full */}
              <input
                type="text"
                placeholder="e.g., https://news.ycombinator.com/item?id=45229799"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-grow p-3 rounded-l-md bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-hnOrange"
              />
              <button
                onClick={handleAnalyzeClick}
                disabled={isLoading}
                className="bg-hnOrange text-white font-bold py-3 px-6 rounded-r-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Analyzing...' : 'Analyze This Thread'}
              </button>
            </div>
            {/* Analysis Results Placeholder */}
            <div className="w-full max-w-full bg-gray-900 rounded-lg p-6 min-h-[300px] flex items-center justify-center text-gray-500 border border-gray-700"> {/* Changed max-w-xl to max-w-full */}
              {isLoading && <p>Loading analysis...</p>}
              {error && <p className="text-red-500">{error}</p>}
              {analysisResult && (
                <div className="text-gray-100 text-left w-full">
                  <h3 className="text-xl font-bold mb-2">Analysis Summary:</h3>
                  <p><strong>Title:</strong> {analysisResult.title}</p>
                  <p><strong>URL:</strong> <a href={analysisResult.url} target="_blank" rel="noopener noreferrer" className="text-hnOrange hover:underline">{analysisResult.url}</a></p>
                  <p><strong>Author:</strong> {analysisResult.user_id}</p>
                  <p><strong>Created At:</strong> {new Date(analysisResult.created_at).toLocaleString()}</p>

                  {analysisResult.content_summary && (() => {
                    let parsedContentSummary;
                    try {
                      parsedContentSummary = typeof analysisResult.content_summary === 'string'
                        ? JSON.parse(analysisResult.content_summary)
                        : analysisResult.content_summary;
                    } catch (e) {
                      console.error("Failed to parse content_summary:", e);
                      parsedContentSummary = null;
                    }

                    return parsedContentSummary && (
                      <div className="mt-4">
                        <h4 className="text-lg font-bold mb-2">Content Summary:</h4>
                        <p><strong>Type:</strong> <span className="bg-gray-700 text-gray-200 px-2 py-1 rounded-md text-sm">{parsedContentSummary.type}</span></p>
                        <p className="mt-2"><strong>Keywords:</strong> {parsedContentSummary.keywords.split(',').map(keyword => (
                          <span key={keyword.trim()} className="bg-gray-700 text-gray-200 px-2 py-1 rounded-md text-sm mr-2 mb-2 inline-block">{keyword.trim()}</span>
                        ))}</p>
                        <p className="mt-2"><strong>Post summary</strong>:{parsedContentSummary.content}</p>
                      </div>
                    );
                  })()}

                  {analysisResult.summary_comments && (() => {
                    let parsedSummaryComments;
                    try {
                      parsedSummaryComments = typeof analysisResult.summary_comments === 'string'
                        ? JSON.parse(analysisResult.summary_comments)
                        : analysisResult.summary_comments;
                    } catch (e) {
                      console.error("Failed to parse summary_comments:", e);
                      parsedSummaryComments = null;
                    }

                    return parsedSummaryComments && (
                      <div className="mt-4">
                        <h4 className="text-lg font-bold mb-2">Comment Analysis:</h4>
                        {parsedSummaryComments.overall_comments_summary_with_sentiment && (() => {
                          const cleanedMarkdown = parsedSummaryComments.overall_comments_summary_with_sentiment
                            .replace(/^```markdown\n/, '')
                            .replace(/\n```$/, '');
                          return (
                            <div className="mt-2 p-4 bg-gray-800 rounded-lg prose prose-sm prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {cleanedMarkdown}
                              </ReactMarkdown>
                            </div>
                          );
                        })()}

                        {parsedSummaryComments.cluster_summaries && parsedSummaryComments.cluster_summaries.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-md font-bold mb-2">Key Discussion grouped into themes:</h5>
                            {parsedSummaryComments.cluster_summaries.map((cluster, index) => (
                              <div key={index} className="bg-gray-800 p-4 rounded-lg mb-4">
                                {cluster.theme && <p className="font-semibold">Theme: {cluster.theme}</p>}
                                <p className="font-medium">Summary: {cluster.summary}</p>
                                {cluster.comments && cluster.comments.length > 0 && (
                                  <div className="mt-2 ml-4 border-l border-gray-700 pl-4">
                                    <p className="font-medium mb-1">Typical Comments:</p>
                                    {cluster.comments.map((comment, commentIndex) => (
                                      <div key={commentIndex} className="mb-2 text-sm">
                                        <div dangerouslySetInnerHTML={{ __html: comment.text }} className="italic"></div>
                                        <p className="text-gray-400">- {comment.author} on {new Date(comment.created_at).toLocaleString()}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              {!isLoading && !error && !analysisResult && (
                <p>Analysis Results Will Appear Here</p>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section px-8 py-16 max-w-6xl mx-auto mt-16">
          <h2 className="text-4xl font-bold text-center mb-12">Everything You Need to Conquer HN Information Overload.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="feature-card bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
              <div className="text-hnOrange text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-2">Instant AI Summaries</h3>
              <p className="text-gray-300">Condense hours of reading into minutes. Get the key takeaways from any article and its entire comment section without opening a single new tab.</p>
            </div>
            {/* Feature 2 */}
            <div className="feature-card bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
              <div className="text-hnOrange text-4xl mb-4">🧭</div>
              <h3 className="text-xl font-bold mb-2">Deep Comment Analysis</h3>
              <p className="text-gray-300">Go beyond the surface. Understand comment sentiment, identify key discussion themes, and find the most insightful (or controversial) arguments at a glance.</p>
            </div>
            {/* Feature 3 */}
            <div className="feature-card bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
              <div className="text-hnOrange text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-2">Personalized Interest Scoring</h3>
              <p className="text-gray-300">Stop guessing which posts are worth your time. Our system evaluates posts based on your pre-defined interests, so you only focus on what truly matters to you.</p>
            </div>
            {/* Feature 4 */}
            <div className="feature-card bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
              <div className="text-hnOrange text-4xl mb-4">🔔</div>
              <h3 className="text-xl font-bold mb-2">Don't Miss Out</h3>
              <p className="text-gray-300">Never miss a post you care about. Our system highlights and notifies you of high-interest discussions based on your personalized preferences.</p>
            </div>
          </div>
        </section>

        {/* Target Audience Section */}
        <section className="target-audience-section px-8 py-16 max-w-6xl mx-auto mt-16">
          <h2 className="text-4xl font-bold text-center mb-12">Built for the Serious HN Reader.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Persona 1 */}
            <div className="persona-card bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-xl font-bold mb-2">The Busy Professional</h3>
              <p className="text-gray-300">"You love HN's insights but lack the time to sift through hundreds of comments. Get the executive summary and stay ahead."</p>
            </div>
            {/* Persona 2 */}
            <div className="persona-card bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-xl font-bold mb-2">The Lifelong Learner</h3>
              <p className="text-gray-300">"You use HN to discover new technologies and ideas. Our tool helps you find the signal in the noise and learn faster."</p>
            </div>
            {/* Persona 3 */}
            <div className="persona-card bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
              <h3 className="text-xl font-bold mb-2">The Data Junkie</h3>
              <p className="text-gray-300">"You're curious about the trends and sentiments of the tech community. Uncover hidden patterns within HN discussions."</p>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section id="early-access" className="final-cta-section bg-gray-900 px-8 py-16 max-w-6xl mx-auto mt-16 text-center rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-4xl font-bold mb-4">Ready to Read Hacker News Smarter, Not Harder?</h2>
          <p className="text-xl text-gray-300 mb-8">Be the first to get access when we launch. Early users get a lifetime 50% discount.</p>
          <div className="flex flex-col sm:flex-row justify-center items-center w-full max-w-md mx-auto">
            <input
              type="email"
              placeholder="Your Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-grow p-3 rounded-l-md sm:rounded-l-md sm:rounded-r-none bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-hnOrange mb-4 sm:mb-0"
            />
            <button
              onClick={handleEmailSubmit}
              disabled={isSubmittingEmail}
              className="bg-hnOrange text-white font-bold py-3 px-6 rounded-r-md sm:rounded-r-md sm:rounded-l-none hover:opacity-90 transition-opacity w-full sm:w-auto"
            >
              {isSubmittingEmail ? 'Securing...' : 'Secure My Spot'}
            </button>
          </div>
          {/* Turnstile Widget (仅客户端渲染) */}
          <div className="mt-4 flex justify-center">
            <div ref={turnstileWidgetRef}></div>
          </div>
          {emailSubmitMessage && (
            <p className="text-center mt-4 text-sm">
              {emailSubmitMessage}
            </p>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="footer bg-gray-900 text-gray-400 text-sm px-8 py-8 max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center mt-16 border-t border-gray-700">
        <div className="mb-4 sm:mb-0">
          © 2025 HPYHN. Built by a fellow HN reader.
        </div>
      </footer>
    </div>
  );
}