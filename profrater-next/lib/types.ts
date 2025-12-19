/**
 * TypeScript interfaces for ProfRater application
 */

export interface Review {
  rating: number;
  difficulty: number;
  course: string;
  date: string;
  comment: string;
  tags: string[];
}

export interface ProfessorInfo {
  overallRating: number;
  totalRatings: number;
  wouldTakeAgainPercent: number;
  difficultyRating: number;
  department?: string;
  professorName?: string;
}

export interface JobResult {
  professorInfo: ProfessorInfo;
  reviews: Review[];
  aiSummary: string;
}

export type JobStatus = "queued" | "running" | "complete" | "error";

export interface Job {
  status: JobStatus;
  professorName: string;
  university: string;
  userQuestion?: string;
  result?: JobResult;
  error?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StartScrapeRequest {
  professorName: string;
  university: string;
  userQuestion?: string;
}

export interface StartScrapeResponse {
  jobId: string;
  message: string;
}

export interface CheckJobResponse extends Job {
  jobId: string;
}
