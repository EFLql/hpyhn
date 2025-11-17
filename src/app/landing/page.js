'use client';
import Link from 'next/link';
import ImageGallery from '../../components/ImageGallery';
import LoginModal from '../../components/LoginModal';
import RegisterModal from '../../components/RegisterModal';
import { useState } from 'react';

export function ClientLink({ href, className, children }) {
  const handleClick = () => {
    sessionStorage.setItem('hasVisitedMainPage', 'true');
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const handleLoginClick = () => {
    setShowLogin(true);
    setShowRegister(false);
  };
  const handleCloseLogin = () => setShowLogin(false);
  const handleRegisterClick = () => {
    setShowLogin(false);
    setShowRegister(true);
  };
  const handleCloseRegister = () => setShowRegister(false);
  return (
    <div className="w-full sm:w-4/5 mx-auto px-4 py-2 bg-orange-50 relative min-h-screen">
      {/* Header */}
      <header className="bg-orange-500 py-2 px-4 flex justify-center">
        <h1 className="font-bold text-white text-2xl">HPYHN - Hacker News Reimagined</h1>
      </header>

      <main className="bg-white px-2 sm:px-4 py-8">
        {/* Section 1: Introduction to Hacker News Value */}
        <section className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-orange-700 mb-4">Unlock the True Value of Hacker News</h2>
          <p className="text-lg text-gray-700 mb-6 font-serif">
            Hacker News is a goldmine for tech enthusiasts, offering:
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-full flex justify-center">
                <ImageGallery images={[
                  { src: '/interesting_project_no_code.png', alt: 'Interesting Project No Code' },
                  { src: '/interesting_useful_projects_css_only_terrain.png', alt: 'CSS Only Terrain' },
                  { src: '/interesting_useful_tools_api-test-tool.gif', alt: 'API Test Tool' },
                  { src: '/interesting_useful_tools_deepwiki.png', alt: 'Deepwiki' },
                ]} />
              </div>
              <p className="text-md text-gray-700 font-semibold font-serif mt-4">Finding interesting, practical, and free Projects/Tools</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-full flex justify-center">
                <ImageGallery images={[
                  { src: '/experience_sharing_almost_got_hacked_by_a_job_interview.png', alt: 'Almost Got Hacked by a Job Interview' },
                  { src: '/experience_sharing_get_off_the_cloud_save_10x.png', alt: 'Get Off the Cloud Save 10x' },
                  { src: '/experience_sharing_pelican_on_bicycle.png', alt: 'Pelican on Bicycle' },
                ]} />
              </div>
              <p className="text-md text-gray-700 font-semibold font-serif mt-4">Experience sharing from industry professionals</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-full flex justify-center">
                <ImageGallery images={[
                  { src: '/valuable_insights_of_self-hosting.png', alt: 'Valuable Insights of Self-Hosting' },
                  { src: '/valuble_insights_of_comments.png', alt: 'Valuable Insights of Comments' },
                ]} />
              </div>
              <p className="text-md text-gray-700 font-semibold font-serif mt-4">Valuable knowledge, information, and multiple perspectives from comments</p>
            </div>
          </div>
          <button className="px-8 py-3 bg-orange-500 text-white text-xl font-semibold rounded-md hover:bg-orange-600 transition-colors" onClick={handleLoginClick}>
            Register Now
          </button>
        </section>

        {/* Section 2: Problem 1 - Overwhelming Comments */}
        <section className="flex flex-col md:flex-row items-center justify-center mb-12 bg-gray-100 p-6 rounded-lg shadow-md">
          <div className="md:w-1/2 p-4 text-center md:text-left">
            <h3 className="text-2xl font-bold text-orange-700 mb-3">Efficiently Digest Valuable Comments</h3>
            <p className="text-gray-700 mb-4 font-serif">
              Tired of sifting through hundreds of comments to find valuable insights? We analyze lengthy comment sections,
              grouping comments spread across entire threads under the same theme, so you can easily see multiple perspectives.
            </p>
            <button className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors" onClick={handleLoginClick}>
              Register to Analyze Comments
            </button>
          </div>
          <div className="md:w-1/2 p-4">
            <ImageGallery images={[
              { src: '/Part1_unstructured_comments.png', alt: 'Unstructured Comments' },
              { src: '/part1_structured_themes.png', alt: 'Structured Themes' },
              { src: '/Part1_3.png', alt: 'group comments' },
            ]} />
          </div>
        </section>

        {/* Section 3: Problem 2 - Unclear Post Themes */}
        <section className="flex flex-col md:flex-row-reverse items-center justify-center mb-12 bg-gray-100 p-6 rounded-lg shadow-md">
          <div className="md:w-1/2 p-4 text-center md:text-left">
            <h3 className="text-2xl font-bold text-orange-700 mb-3">Instantly Grasp Post Themes</h3>
            <p className="text-gray-700 mb-4 font-serif">
              Never waste time on irrelevant articles again. We provide a concise one-sentence summary and extract tags and keywords for each post,
              allowing you to quickly decide if it's worth a deeper dive.
            </p>
            <button className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors" onClick={handleLoginClick}>
              Register for Post Summaries
            </button>
          </div>
          <div className="md:w-1/2 p-4">
            <ImageGallery images={[
              { src: '/part2.png', alt: 'One-Sentence Post Summary' },
              { src: '/Part2_2.png', alt: 'if it\'s worth a deep dive' }
            ]} />
          </div>
        </section>

        {/* Section 4: Problem 3 - Filtering Content */}
        <section className="flex flex-col md:flex-row items-center justify-center mb-12 bg-gray-100 p-6 rounded-lg shadow-md">
          <div className="md:w-1/2 p-4 text-center md:text-left">
            <h3 className="text-2xl font-bold text-orange-700 mb-3">Personalized Content Filtering with AI</h3>
            <p className="text-gray-700 mb-4 font-serif">
              we need to focus our time on interesting content while dabbling in other areas to keep a broad view. 
              Our neural network model scores each post based on your interests, allowing you to prioritize what matters most. 
              You'll see more of what you love, without completely missing out on diverse perspectives.
            </p>
            <button className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors" onClick={handleLoginClick}>
              Register for Personalized Feeds
            </button>
          </div>
          <div className="md:w-1/2 p-4">
            <ImageGallery images={[
              { src: '/Part3_2.png', alt: 'Interest-Based Scoring Part 2' },
              { src: '/Part3_3.png', alt: 'Interest-Based Scoring Part 3' },
              { src: '/part3_1.png', alt: 'Interest-Based Scoring Part 1' },
            ]} />
          </div>
        </section>

        {/* Section 5: Problem 4 - Missing Posts */}
        <section className="flex flex-col md:flex-row-reverse items-center justify-center mb-12 bg-gray-100 p-6 rounded-lg shadow-md">
          <div className="md:w-1/2 p-4 text-center md:text-left">
            <h3 className="text-2xl font-bold text-orange-700 mb-3">Never Miss a Post with "Don't Miss"</h3>
            <p className="text-gray-700 mb-4 font-serif">
              You might miss interesting posts while you are busy with work, studying or taking holidays. Our "Don't Miss" section curates posts you would have
              loved, ensuring you're always up-to-date with content relevant to your interests.
            </p>
            <button className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors" onClick={handleLoginClick}>
              Register for "Don't Miss"
            </button>
          </div>
          <div className="md:w-1/2 p-4">
            <ImageGallery images={[
              { src: '/Part4.png', alt: 'Don\'t Miss Section' }
            ]} />
          </div>
        </section>

        {/* Final Section: Call to Action to Main Page */}
        <section className="text-center py-8">
          <h2 className="text-3xl font-bold text-orange-700 mb-4">Ready to Experience Hacker News Differently?</h2>
          <ClientLink href="/" // Changed from Link to ClientLink
            className="px-8 py-3 bg-orange-500 text-white text-xl font-semibold rounded-md hover:bg-orange-600 transition-colors"
          >
            Start Exploring
          </ClientLink>
        </section>
      </main>

      <footer className="text-center py-4 text-xs text-gray-500">
        <Link href="/blog/" className="hover:underline">blog</Link>
        <span className="mx-2">|</span>
        <Link href="https://x.com/liqilin3" target="_blank" rel="noopener noreferrer" className="hover:underline">Contact Me</Link>
      </footer>
      {showLogin && (
        <LoginModal isOpen={showLogin} onClose={handleCloseLogin} onRegisterClick={handleRegisterClick} />
      )}
      {showRegister && (
        <RegisterModal isOpen={showRegister} onClose={handleCloseRegister} onLoginClick={handleLoginClick} />
      )}
    </div>
  );
}