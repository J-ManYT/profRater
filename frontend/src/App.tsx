import { useState } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'

interface Review {
  class: string
  comment: string
  date: string
  rating: number
  difficulty: number
  wouldTakeAgain: boolean
}

interface ProfessorInfo {
  overallRating?: number
  totalRatings?: number
  wouldTakeAgainPercent?: number
  difficultyRating?: number
  department?: string
}

interface AnalysisResult {
  success: boolean
  summary: string
  stats: {
    averageRating?: number
    totalReviews?: number
    wouldTakeAgain?: number
    averageDifficulty?: number
  }
  reviews: Review[]
  professorInfo: ProfessorInfo
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function App() {
  const [professorName, setProfessorName] = useState('')
  const [university, setUniversity] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [showReviews, setShowReviews] = useState(false)

  const universitySuggestions = [
    'University of Michigan',
    'University of California, Berkeley',
    'Stanford University',
    'MIT',
    'Harvard University',
    'Columbia University',
    'University of Texas at Austin',
    'University of Washington',
  ]

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!professorName.trim() || !university.trim()) {
      setError('Please enter both professor name and university')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setLoadingStatus('Initializing...')

    try {
      // Simulate status updates during the ~30 second scraping process
      const statusInterval = setInterval(() => {
        const statuses = [
          'Searching for professor...',
          'Found professor! Scraping reviews...',
          'Analyzing review data...',
          'Processing insights with AI...',
          'Almost done...',
        ]
        setLoadingStatus(statuses[Math.floor(Math.random() * statuses.length)])
      }, 3000)

      const response = await axios.post(`${API_URL}/api/analyze`, {
        professorName: professorName.trim(),
        university: university.trim(),
      })

      clearInterval(statusInterval)

      if (response.data.success) {
        setResult(response.data)
        setLoadingStatus('Analysis complete!')
      } else {
        setError(response.data.error || 'Failed to analyze professor')
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message || 'Failed to connect to server')
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold gradient-text mb-4">
            ProfRater AI
          </h1>
          <p className="text-gray-600 text-lg">
            Get AI-powered insights about professors from RateMyProfessors
          </p>
        </div>

        {/* Search Form */}
        <div className="glass-card p-8 mb-8">
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div>
              <label htmlFor="professor" className="block text-sm font-medium text-gray-700 mb-2">
                Professor Name
              </label>
              <input
                id="professor"
                type="text"
                value={professorName}
                onChange={(e) => setProfessorName(e.target.value)}
                placeholder="e.g., John Smith"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="university" className="block text-sm font-medium text-gray-700 mb-2">
                University
              </label>
              <input
                id="university"
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g., University of Michigan"
                list="universities"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                disabled={loading}
              />
              <datalist id="universities">
                {universitySuggestions.map((uni) => (
                  <option key={uni} value={uni} />
                ))}
              </datalist>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-primary-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
            >
              {loading ? 'Analyzing...' : 'Analyze Professor'}
            </button>
          </form>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="glass-card p-8 text-center">
            <div className="loading-spinner w-16 h-16 mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium text-lg">{loadingStatus}</p>
            <p className="text-gray-500 text-sm mt-2">This may take up to 30 seconds...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="glass-card p-6 bg-red-50 border-red-200">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-red-800 font-semibold">Error</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Professor Info */}
            <div className="glass-card p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {professorName}
              </h2>
              <p className="text-gray-600">
                {result.professorInfo?.department || 'Department N/A'} • {university}
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-6 text-center">
                <div className="text-3xl font-bold text-primary-600 mb-1">
                  {result.stats.averageRating != null ? result.stats.averageRating.toFixed(1) : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Average Rating</div>
              </div>
              <div className="glass-card p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {result.stats.totalReviews ?? 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Total Reviews</div>
              </div>
              <div className="glass-card p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {result.stats.wouldTakeAgain != null ? result.stats.wouldTakeAgain.toFixed(0) : 'N/A'}%
                </div>
                <div className="text-sm text-gray-600">Would Take Again</div>
              </div>
              <div className="glass-card p-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {result.stats.averageDifficulty != null ? result.stats.averageDifficulty.toFixed(1) : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Difficulty</div>
              </div>
            </div>

            {/* AI Summary */}
            <div className="glass-card p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Analysis
              </h3>
              <div className="prose prose-lg max-w-none">
                <ReactMarkdown>{result.summary}</ReactMarkdown>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="glass-card p-6">
              <button
                onClick={() => setShowReviews(!showReviews)}
                className="w-full flex items-center justify-between text-left"
              >
                <h3 className="text-xl font-bold text-gray-800">
                  All Reviews ({result.reviews.length})
                </h3>
                <svg
                  className={`w-6 h-6 text-gray-600 transition-transform ${showReviews ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showReviews && (
                <div className="mt-6 space-y-4 max-h-[600px] overflow-y-auto">
                  {result.reviews.map((review, index) => (
                    <div key={index} className="border-l-4 border-primary-500 pl-4 py-2">
                      <div className="flex items-center gap-4 mb-2 flex-wrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                          {review.class}
                        </span>
                        <span className="text-sm text-gray-600">{review.date}</span>
                        <span className="text-sm font-semibold text-gray-700">
                          Rating: {review.rating}/5
                        </span>
                        <span className="text-sm text-gray-600">
                          Difficulty: {review.difficulty}/5
                        </span>
                        {review.wouldTakeAgain && (
                          <span className="text-sm text-green-600 font-medium">
                            ✓ Would take again
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
