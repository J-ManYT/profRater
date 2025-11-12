/**
 * ProfRater Type Definitions
 * TypeScript interfaces for professor reviews and analysis
 */

/**
 * Individual review from RateMyProfessor
 */
export interface Review {
  rating: number;
  difficulty: number;
  course: string;
  date: string;
  comment: string;
  tags: string[];
  thumbsUp: number;
  thumbsDown: number;
}

/**
 * Professor metadata and overall stats
 */
export interface ProfessorInfo {
  overallRating: number;
  totalRatings: number;
  wouldTakeAgainPercent: number;
  difficultyRating: number;
  department: string;
}

/**
 * Request body for the /api/analyze endpoint
 */
export interface AnalysisRequest {
  professorName: string;
  university: string;
  course?: string;
  userQuestion?: string;
}

/**
 * Response from the /api/analyze endpoint
 */
export interface AnalysisResponse {
  success: boolean;
  summary: string;
  stats: {
    averageRating: number;
    totalReviews: number;
    averageDifficulty: number;
    wouldTakeAgain: number;
  };
  reviews: Review[];
  professorInfo: ProfessorInfo;
}

/**
 * Result from the scraper
 */
export interface ScraperResult {
  reviews: Review[];
  professorInfo: ProfessorInfo;
}
