import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
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
              <span className="text-xl font-bold">HN AI</span>
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-4">
              Stop Scrolling. Start Understanding Hacker News.
            </h1>
            <h2 className="text-xl text-gray-300 mb-8">
              AI-powered summaries, comment analysis, and personalized interest scoring for the posts you <em className="text-hnOrange">actually</em> care about.
            </h2>
            <div className="cta-buttons flex space-x-4">
              <button className="bg-hnOrange text-white font-bold py-3 px-6 rounded-md hover:opacity-90 transition-opacity">
                Get Early Access
              </button>
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
            {/* Placeholder for GIF */}
            <div className="w-full max-w-md h-64 bg-gray-800 rounded-lg flex items-center justify-center text-gray-500">
              Awesome GIF Demo Here
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section id="demo" className="demo-section bg-gray-800 px-8 py-16 max-w-6xl mx-auto rounded-lg shadow-lg mt-16">
          <h2 className="text-4xl font-bold text-center mb-12">How It Works</h2>
          <div className="flex flex-col items-center">
            <div className="flex w-full max-w-xl mb-8">
              <input
                type="text"
                placeholder="e.g., https://news.ycombinator.com/item?id=30781254"
                defaultValue="https://news.ycombinator.com/item?id=30781254"
                className="flex-grow p-3 rounded-l-md bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-hnOrange"
              />
              <button className="bg-hnOrange text-white font-bold py-3 px-6 rounded-r-md hover:opacity-90 transition-opacity">
                Analyze This Thread
              </button>
            </div>
            {/* Analysis Results Placeholder */}
            <div className="w-full max-w-xl bg-gray-900 rounded-lg p-6 min-h-[300px] flex items-center justify-center text-gray-500 border border-gray-700">
              Analysis Results Will Appear Here
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
              <div className="text-hnOrange text-4xl mb-4">✉️</div>
              <h3 className="text-xl font-bold mb-2">Your Daily HN Digest</h3>
              <p className="text-gray-300">(Paid Feature) Receive a daily or weekly email with summarized, high-interest posts tailored just for you. Your personal HN briefing, delivered.</p>
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
        <section className="final-cta-section bg-gray-900 px-8 py-16 max-w-6xl mx-auto mt-16 text-center rounded-lg shadow-lg border border-gray-700">
          <h2 className="text-4xl font-bold mb-4">Ready to Read Hacker News Smarter, Not Harder?</h2>
          <p className="text-xl text-gray-300 mb-8">Be the first to get access when we launch. Early users get a lifetime 50% discount.</p>
          <div className="flex flex-col sm:flex-row justify-center items-center w-full max-w-md mx-auto">
            <input
              type="email"
              placeholder="Your Email Address"
              className="flex-grow p-3 rounded-l-md sm:rounded-l-md sm:rounded-r-none bg-gray-700 border border-gray-600 text-gray-100 focus:outline-none focus:border-hnOrange mb-4 sm:mb-0"
            />
            <button className="bg-hnOrange text-white font-bold py-3 px-6 rounded-r-md sm:rounded-r-md sm:rounded-l-none hover:opacity-90 transition-opacity w-full sm:w-auto">
              Secure My Spot
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer bg-gray-900 text-gray-400 text-sm px-8 py-8 max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center mt-16 border-t border-gray-700">
        <div className="mb-4 sm:mb-0">
          © 2024 HN AI. Built by a fellow HN reader.
        </div>
        <div className="flex space-x-4">
          <Link href="#" className="hover:text-hnOrange transition-colors">Twitter/X</Link>
          <Link href="#" className="hover:text-hnOrange transition-colors">Contact</Link>
          <Link href="#" className="hover:text-hnOrange transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
