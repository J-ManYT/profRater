'use client';

/**
 * ProfRater Main Page
 * Search form, polling logic, and results display
 */

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Job, JobResult } from '@/lib/types';

type LoadingState = 'idle' | 'creating' | 'scraping' | 'analyzing' | 'complete' | 'error';

export default function Home() {
  const [professorName, setProfessorName] = useState('');
  const [university, setUniversity] = useState('');
  const [userQuestion, setUserQuestion] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<JobResult | null>(null);
  const [expandedReviews, setExpandedReviews] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const poll = async () => {
      try {
        const response = await fetch(`/api/check-job?id=${jobId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to check job status');
        }

        const job: Job = await response.json();

        // Update loading state based on job status
        if (job.status === 'queued') {
          setLoadingState('creating');
        } else if (job.status === 'running') {
          setLoadingState('scraping');
        } else if (job.status === 'complete') {
          setLoadingState('complete');
          setResult(job.result || null);
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        } else if (job.status === 'error') {
          setLoadingState('error');
          setErrorMessage(job.error || 'Unknown error occurred');
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Polling error:', error);
          setLoadingState('error');
          setErrorMessage('Failed to check job status');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        }
      }
    };

    // Start polling every 1.5 seconds
    await poll(); // Initial poll
    pollingIntervalRef.current = setInterval(poll, 1500);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset state
    setErrorMessage('');
    setResult(null);
    setLoadingState('creating');

    try {
      // Create scraping job
      const response = await fetch('/api/start-scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professorName,
          university,
          userQuestion: userQuestion || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start scraping job');
      }

      const { jobId } = await response.json();

      // Start polling
      setLoadingState('scraping');
      await pollJobStatus(jobId);
    } catch (error: any) {
      console.error('Submission error:', error);
      setLoadingState('error');
      setErrorMessage(error.message || 'Failed to submit request');
    }
  };

  // Handle reset
  const handleReset = () => {
    setProfessorName('');
    setUniversity('');
    setUserQuestion('');
    setLoadingState('idle');
    setErrorMessage('');
    setResult(null);
    setExpandedReviews(false);

    // Stop polling
    abortControllerRef.current?.abort();
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
  };

  // Get loading message
  const getLoadingMessage = () => {
    switch (loadingState) {
      case 'creating':
        return 'Creating job';
      case 'scraping':
        return 'Scraping RateMyProfessor';
      case 'analyzing':
        return 'Analyzing reviews with AI';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
            ProfRater
          </h1>
          <p className="text-gray-400 text-lg">
            AI-powered professor insights from RateMyProfessor
          </p>
        </div>

        {/* Search Form */}
        {loadingState === 'idle' && (
          <form onSubmit={handleSubmit} className="glass-card p-8 mb-8">
            <div className="space-y-6">
              <div>
                <label htmlFor="professorName" className="block text-sm font-medium mb-2">
                  Professor Name
                </label>
                <input
                  type="text"
                  id="professorName"
                  value={professorName}
                  onChange={(e) => setProfessorName(e.target.value)}
                  placeholder="e.g., John Smith"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label htmlFor="university" className="block text-sm font-medium mb-2">
                  University
                </label>
                <input
                  type="text"
                  id="university"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="e.g., University of California Berkeley"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label htmlFor="userQuestion" className="block text-sm font-medium mb-2">
                  Optional Question <span className="text-gray-500">(for AI analysis)</span>
                </label>
                <textarea
                  id="userQuestion"
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  placeholder="e.g., Is this professor good for beginners?"
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 glass-button font-semibold text-lg"
              >
                Analyze Professor
              </button>
            </div>
          </form>
        )}

        {/* Loading State */}
        {(loadingState === 'creating' || loadingState === 'scraping' || loadingState === 'analyzing') && (
          <div className="glass-card p-12 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-2xl font-semibold mb-2 loading-dots">
              {getLoadingMessage()}
            </h3>
            <p className="text-gray-400">
              This may take 1-5 minutes depending on the number of reviews
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Analyzing: {professorName} at {university}
            </p>
          </div>
        )}

        {/* Error State */}
        {loadingState === 'error' && (
          <div className="glass-card p-8 border-red-500/30">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-semibold text-red-400 mb-2">Error</h3>
              <p className="text-gray-300">{errorMessage}</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-3 glass-button"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {loadingState === 'complete' && result && (
          <div className="space-y-8">
            {/* Professor Stats */}
            <div className="glass-card p-8">
              <h2 className="text-3xl font-bold mb-6">{professorName}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-card p-4 text-center">
                  <div className="text-3xl font-bold text-primary">
                    {result.professorInfo.overallRating.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Overall Rating</div>
                </div>
                <div className="glass-card p-4 text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {result.professorInfo.wouldTakeAgainPercent}%
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Would Take Again</div>
                </div>
                <div className="glass-card p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400">
                    {result.professorInfo.difficultyRating.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Difficulty</div>
                </div>
                <div className="glass-card p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400">
                    {result.professorInfo.totalRatings}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">Total Ratings</div>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div>
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <span>🤖</span> AI Analysis
              </h2>
              <div className="space-y-4">
                {(() => {
                  // Parse AI summary into sections
                  const sections = result.aiSummary.split(/(?=##\s)/g).filter(s => s.trim());

                  // Emoji mapping for common sections
                  const sectionEmojis: Record<string, string> = {
                    'quick stats': '📊',
                    'stats': '📊',
                    'teaching style': '📚',
                    'teaching': '📚',
                    'workload': '⚡',
                    'difficulty': '⚡',
                    'grading': '✅',
                    'grading style': '✅',
                    'best for': '🎯',
                    'recommendations': '🎯',
                    'pros': '👍',
                    'cons': '👎',
                    'overall': '💡',
                    'summary': '💡',
                  };

                  const getEmoji = (title: string) => {
                    const lowerTitle = title.toLowerCase();
                    for (const [key, emoji] of Object.entries(sectionEmojis)) {
                      if (lowerTitle.includes(key)) return emoji;
                    }
                    return '📌';
                  };

                  return sections.map((section, index) => {
                    // Extract title from ## header
                    const titleMatch = section.match(/##\s+(.+)/);
                    const title = titleMatch ? titleMatch[1].trim() : `Section ${index + 1}`;
                    const content = section.replace(/##\s+.+\n?/, '').trim();
                    const emoji = getEmoji(title);

                    return (
                      <div key={index} className="glass-card p-6">
                        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                          <span>{emoji}</span>
                          <span>{title}</span>
                        </h3>
                        <div className="text-gray-300">
                          <ReactMarkdown
                            components={{
                              p: ({ node, ...props }) => <p className="mb-3 leading-relaxed" {...props} />,
                              ul: ({ node, ...props }) => <ul className="mb-3 space-y-1.5 ml-6 list-disc" {...props} />,
                              ol: ({ node, ...props }) => <ol className="mb-3 space-y-1.5 ml-6 list-decimal" {...props} />,
                              li: ({ node, ...props }) => <li className="leading-relaxed text-gray-200" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
                              em: ({ node, ...props }) => <em className="italic" {...props} />,
                              h3: ({ node, ...props }) => <h4 className="text-lg font-medium mb-2 mt-3 text-white" {...props} />,
                            }}
                          >
                            {content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Reviews */}
            <div className="glass-card p-8">
              <button
                onClick={() => setExpandedReviews(!expandedReviews)}
                className="w-full flex items-center justify-between text-xl font-bold hover:text-primary transition-colors py-2"
              >
                <span>
                  {expandedReviews ? 'Hide Reviews' : `Show ${result.reviews.length} Reviews`}
                </span>
                <span className="text-2xl">{expandedReviews ? '−' : '+'}</span>
              </button>

              {expandedReviews && (
                <div className="space-y-6 mt-8">
                  {result.reviews.map((review, index) => (
                    <div key={index} className="glass-card p-6 hover:border-primary/30 transition-colors">
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">Rating:</span>
                          <span className="font-semibold text-primary text-lg">{review.rating}/5</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">Difficulty:</span>
                          <span className="font-semibold text-yellow-400 text-lg">{review.difficulty}/5</span>
                        </div>
                        <div className="ml-auto text-sm text-gray-500">{review.date}</div>
                      </div>
                      <div className="text-sm text-gray-400 mb-3 font-medium">{review.course}</div>
                      <p className="text-gray-200 leading-relaxed mb-4">{review.comment}</p>
                      {review.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {review.tags.map((tag, tagIndex) => (
                            <span
                              key={tagIndex}
                              className="px-3 py-1 bg-primary/20 text-primary text-xs rounded-full border border-primary/30"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* New Search Button */}
            <button
              onClick={handleReset}
              className="w-full py-4 glass-button font-semibold"
            >
              Search Another Professor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
