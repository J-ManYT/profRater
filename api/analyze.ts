// Vercel serverless function for /api/analyze endpoint
import type { Request, Response } from 'express';
import { scrapeProfessor } from '../backend/src/scraper';
import { analyzeWithAI } from '../backend/src/analyzer';

export default async function handler(req: Request, res: Response) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { professorName, university } = req.body;

    if (!professorName || !university) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: professorName and university are required',
      });
      return;
    }

    console.log(`\nAnalyzing ${professorName} at ${university}...`);

    const scraperResult = await scrapeProfessor(professorName, university);
    const { reviews, professorInfo } = scraperResult;

    if (reviews.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No reviews found for this professor.',
      });
      return;
    }

    const summary = await analyzeWithAI(reviews, professorInfo);

    const stats = {
      averageRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
      totalReviews: reviews.length,
      averageDifficulty: reviews.reduce((sum, r) => sum + r.difficulty, 0) / reviews.length,
      wouldTakeAgain: professorInfo.wouldTakeAgainPercent,
    };

    res.status(200).json({
      success: true,
      summary,
      stats,
      reviews,
      professorInfo,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    });
  }
}
