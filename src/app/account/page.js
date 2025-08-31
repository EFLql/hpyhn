'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GumroadSubscribeButton from '../../components/GumroadSubscribeButton'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

// Structured list of all topics for selection
const CATEGORIZED_TOPICS = [
  {
    category: "Software Development",
    subTopics: [
      "Programming Languages", "Web Development & Frontend", "Backend & APIs",
      "Databases & Storage", "Software Architecture & Design", "Testing & QA",
      "Developer Tools & Environments", "Code Editors & IDEs", "Performance Engineering",
      "Mobile Development", "Algorithms & Data Structures", "Open Source & Licensing",
      "Design, UX & Technical Writing", "Emulators & Retro Gaming (Engineering)", "Game Development",
      "Graphics Programming & Rendering", "Web Browsers & Engines", "Software Releases & Release Notes"
    ]
  },
  {
    category: "AI & Machine Learning",
    subTopics: [
      "LLMs & Generative AI", "ML Research & Theory", "Computer Vision & Multimodal",
      "NLP & Speech", "Reinforcement Learning", "MLOps & ML Systems",
      "Frameworks & Tools", "Evaluation, Safety & Ethics"
    ]
  },
  {
    category: "DevOps & Infrastructure",
    subTopics: [
      "Containers & Orchestration", "Infrastructure as Code", "CI/CD & Build Pipelines",
      "Observability & Telemetry", "SRE & Reliability Engineering", "Serverless & Edge Compute",
      "Cloud Architecture", "Networking & Delivery"
    ]
  },
  {
    category: "Security",
    subTopics: [
      "Vulnerabilities & Exploits", "Application Security & Secure Coding", "Cryptography & PKI",
      "Network Security", "Identity & Access Management", "Privacy Engineering & Anonymity",
      "Supply Chain & Software Integrity", "Incident Response & Threat Intelligence"
    ]
  },
  {
    category: "Hardware & Electronics",
    subTopics: [
      "CPUs & Instruction Sets", "GPUs & Accelerators", "Semiconductors & Manufacturing",
      "Microcontrollers & Embedded Firmware", "IoT Devices & Sensors", "Storage & Memory",
      "PCB Design & Prototyping", "Hardware Hacking & Reverse Engineering"
    ]
  },
  {
    category: "OS & Low-Level Tech",
    subTopics: [
      "Kernel Internals & Scheduling", "Filesystems & Storage Stacks", "Device Drivers",
      "Compilers & Toolchains", "Linking, Binaries & ABI", "Networking Stacks & Protocols",
      "Virtualization & Hypervisors", "OS Design & Architecture"
    ]
  },
  {
    category: "Business & Startups",
    subTopics: [
      "Startup Launch & Stories", "Product Management", "Growth & Marketing",
      "Sales & Pricing", "Team & Culture"
    ]
  },
  {
    category: "Finance & Economics",
    subTopics: [
      "VC & Fundraising", "Tech Markets & Valuation", "Macroeconomics & Monetary Policy",
      "Fintech & Payments Infrastructure", "Unit Economics & Business Models"
    ]
  },
  {
    category: "Blockchain & Cryptocurrency",
    subTopics: [
      "Blockchain Engineering & Protocols", "Crypto Markets & Ecosystem"
    ]
  },
  {
    category: "Science & Research",
    subTopics: [
      "Physics & Mathematics", "Biology & Health", "Chemistry & Materials Science",
      "Earth & Planetary Science"
    ]
  },
  {
    category: "Space",
    subTopics: [
      "Rockets & Launch Vehicles", "Satellites & Communications", "Spacecraft, Probes & Rovers",
      "Telescopes & Instruments", "Astronomy & Astrophysics", "Space Industry & Commercial Spaceflight"
    ]
  },
  {
    category: "Environment & Energy",
    subTopics: [
      "Renewable Energy", "Nuclear Fission & Fusion", "Grid, Storage & Battery Systems",
      "Carbon Capture & Climate Tech", "Energy Efficiency & Built Environment",
      "Sustainability & Environmental Impact", "Energy Markets & Industry"
    ]
  },
  {
    category: "Culture & Society",
    subTopics: [
      "Tech History", "Philosophy & Ethics of Technology", "Media & Internet Culture",
      "Arts & Entertainment", "General History", "Military & Defense", "Education",
      "Work", "Culture"
    ]
  },
  {
    category: "Tech Regulation & Compliance",
    subTopics: [
      "Data Protection & Privacy Laws", "Antitrust & Competition", "Intellectual Property & Licensing",
      "Computer Misuse & Web Scraping Law", "Crypto Regulation & AML/KYC",
      "Platform Governance & Moderation Rules", "Compliance Frameworks & Audits"
    ]
  },
  {
    category: "Politics",
    subTopics: [
      "Elections & Campaigns", "Legislation & Lawmaking", "Public Administration & Government Programs",
      "Geopolitics & International Relations", "Political Ideology & Opinion", "Civil Liberties & Activism"
    ]
  },
  {
    category: "Personal Development",
    subTopics: [
      "Productivity Systems & Time Management", "Learning & Study Strategies", "Career & Job Search",
      "Writing & Communication", "Habits, Focus & Wellbeing"
    ]
  },
  {
    category: "Other",
    subTopics: [] // "Other" is a category itself, no sub-topics listed in the provided format
  }
];

export default function AccountPage() {
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [selectedInterests, setSelectedInterests] = useState([])
  const [keywords, setKeywords] = useState('')
  const [isTopicSelectorOpen, setIsTopicSelectorOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams() // Initialize useSearchParams

  useEffect(() => {
    const checkSession = async () => {
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      
      if (!data.session) {
        router.push('/')
        return
      }
      setSession(data.session)
      fetchSubscription()
      fetchUserPreferences(data.session.user.id)
    }
    // Read tab from URL and set activeTab
    const tab = searchParams.get('tab')
    if (tab) {
      setActiveTab(tab)
    }

    checkSession()
  }, [router])

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscription')
      const data = await response.json()
      
      if (response.ok) {
        setSubscription(data)
      } else {
        console.error('Failed to fetch subscription:', data.error)
        setSubscription(null)
      }
    } catch (error) {
      console.error('Error fetching subscription:', error)
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserPreferences = async (userId) => {
    try {
      const response = await fetch(`/api/user-preferences?userId=${userId}`)
      const data = await response.json()
      if (response.ok) {
        setSelectedInterests(data.interests ? data.interests.split(',').map(s => s.trim()).filter(s => s !== '') : [])
        setKeywords(data.keywords || '')
      } else {
        console.error('Failed to fetch user preferences:', data.error)
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error)
    }
  }

  const saveUserPreferences = async () => {
    try {
      const response = await fetch('/api/user-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: session.user.id, interests: selectedInterests.join(','), keywords }),
      })
      if (response.ok) {
        alert('Preferences saved successfully!')
      } else {
        const data = await response.json()
        alert(`Failed to save preferences: ${data.error}`)
      }
    } catch (error) {
      console.error('Error saving user preferences:', error)
      alert('Error saving preferences.')
    }
  }

  const handleToggleInterest = (interest) => {
    const trimmedInterest = interest.trim();
    if (selectedInterests.includes(trimmedInterest)) {
      setSelectedInterests(selectedInterests.filter(item => item !== trimmedInterest));
    } else {
      setSelectedInterests([...selectedInterests, trimmedInterest]);
    }
  };

  const handleRemoveInterestTag = (interestToRemove) => {
    setSelectedInterests(selectedInterests.filter(interest => interest !== interestToRemove));
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 bg-orange-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-orange-800">Account Settings</h1>
        <p className="text-gray-600">Manage your subscription and account details</p>
      </header>

      <main className="bg-white rounded-lg shadow-md p-6">
        {/* Tab Navigation */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('profile')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Profile & Subscription
            </button>
            {session && subscription?.status === 'active' && (
              <button
                onClick={() => setActiveTab('interests')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'interests'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
                Interests & Filters
              </button>
            )}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <div className="mt-1 p-2 bg-gray-50 rounded-md">
                    {session?.user?.email}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">User ID</label>
                  <div className="mt-1 p-2 bg-gray-50 rounded-md">
                    {session?.user?.id}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold mb-4">Subscription</h2>
              
              {subscription ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-green-800">Active Subscription</h3>
                      <p className="text-sm text-green-700 mt-1">
                        Your subscription is active and will renew on{' '}
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </p>
                      <div className="mt-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </div>
                    </div>
                    <div>
                      <GumroadSubscribeButton 
                        session={session} 
                        subscription={subscription} 
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-medium text-orange-800">No Active Subscription</h3>
                  <p className="text-sm text-orange-700 mt-1">
                    Subscribe to unlock premium features and support our service.
                  </p>
                  <div className="mt-4">
                    <GumroadSubscribeButton 
                      session={session} 
                      subscription={subscription} 
                    />
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-2">Subscription Benefits</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>AI-powered interest model predicts your interest level for each post</li>
                  <li>Automatically filters posts you might be interested in based on your preferences</li>
                  <li>Early access to new features</li>
                  <li>Access to "Don't Miss" page</li>
                </ul>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  After successful subscription, please refresh the page to check your subscription status. 
                  There might be a delay due to network conditions, please don't worry.
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'interests' && session && subscription?.status === 'active' && (
          <div className="pt-8">
            <h2 className="text-xl font-semibold mb-4">Interests & Keyword Filters</h2>
            <p className="text-gray-600 mb-4">
              Configure your preferences to personalize your "Don't Miss" feed.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700">
                Your Selected Interests
              </label>
              <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md bg-white min-h-[40px]">
                {selectedInterests.length === 0 && (
                  <span className="text-gray-500 text-sm">No interests selected.</span>
                )}
                {selectedInterests.map((interest, index) => (
                  <span 
                    key={index} 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                  >
                    {interest}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveInterestTag(interest)}
                      className="flex-shrink-0 ml-1 h-4 w-4 rounded-full inline-flex items-center justify-center text-orange-400 hover:bg-orange-200 hover:text-orange-500 focus:outline-none focus:bg-orange-500 focus:text-white"
                    >
                      <span className="sr-only">Remove interest</span>
                      <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={() => setIsTopicSelectorOpen(!isTopicSelectorOpen)}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
              >
                {isTopicSelectorOpen ? 'Hide Topic Selector' : 'Select/Edit Interests'}
              </button>

              {isTopicSelectorOpen && (
                <div className="mt-4 p-4 border border-gray-300 rounded-md bg-gray-50 max-h-96 overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-3">Available Topics</h3>
                  {CATEGORIZED_TOPICS.map((categoryGroup, catIndex) => (
                    <div key={catIndex} className="mb-4">
                      <h4 className="text-md font-medium text-gray-800 mb-2">{categoryGroup.category}</h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {categoryGroup.subTopics.length > 0 ? (
                          categoryGroup.subTopics.map((topic, topicIndex) => (
                            <label key={topicIndex} className="inline-flex items-center">
                              <input
                                type="checkbox"
                                className="form-checkbox h-4 w-4 text-orange-600 transition duration-150 ease-in-out"
                                checked={selectedInterests.includes(topic)}
                                onChange={() => handleToggleInterest(topic)}
                              />
                              <span className="ml-2 text-sm text-gray-700">{topic}</span>
                            </label>
                          ))
                        ) : (
                          // For categories like "Other" that are selectable themselves
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              className="form-checkbox h-4 w-4 text-orange-600 transition duration-150 ease-in-out"
                              checked={selectedInterests.includes(categoryGroup.category)}
                              onChange={() => handleToggleInterest(categoryGroup.category)}
                            />
                            <span className="ml-2 text-sm text-gray-700">{categoryGroup.category}</span>
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
                Keywords to Filter (comma-separated words to include/exclude, e.g., Python, Rust, Blockchain)
              </label>
              <div className="mt-1">
                <textarea
                  id="keywords"
                  rows="3"
                  className="shadow-sm focus:ring-orange-500 focus:border-orange-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
                  placeholder="e.g., JavaScript, React, Next.js, Cybersecurity"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveUserPreferences}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-8 mt-8">
          <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                const response = await fetch('/api/auth/logout', {
                  method: 'POST',
                })
                if (response.ok) {
                  router.push('/')
                }
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              Sign Out
            </button>
            <Link 
              href="/"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}