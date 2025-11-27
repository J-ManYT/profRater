/**
 * ProfRater Express Server
 * API server for analyzing professor reviews using AI
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { scrapeProfessor } from "./scraper";
import { analyzeWithAI } from "./analyzer";
import { AnalysisRequest, AnalysisResponse } from "./types";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "ProfRater API is running",
    version: "1.0.0",
  });
});

/**
 * Main analysis endpoint
 * POST /api/analyze
 * Body: { professorName: string, university: string, course?: string, userQuestion?: string }
 */
app.post("/api/analyze", async (req: Request, res: Response) => {
  try {
    const { professorName, university } = req.body as AnalysisRequest;

    // Validate required fields
    if (!professorName || !university) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: professorName and university are required",
      });
      return;
    }

    console.log("\n<� New analysis request:");
    console.log(`   Professor: ${professorName}`);
    console.log(`   University: ${university}`);

    // Step 1: Scrape professor data
    console.log("\n=� Step 1: Scraping professor data...");
    const scraperResult = await scrapeProfessor(professorName, university);
    const { reviews, professorInfo } = scraperResult;

    if (reviews.length === 0) {
      res.status(404).json({
        success: false,
        error: "No reviews found for this professor. Please check the name and university.",
      });
      return;
    }

    // Step 2: Analyze with AI
    console.log("\n🤖 Step 2: Analyzing with Claude AI...");
    const summary = await analyzeWithAI(reviews, professorInfo);

    // Calculate stats
    const stats = {
      averageRating:
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
      totalReviews: reviews.length,
      averageDifficulty:
        reviews.reduce((sum, r) => sum + r.difficulty, 0) / reviews.length,
      wouldTakeAgain: professorInfo.wouldTakeAgainPercent,
    };

    console.log("\n Analysis complete!");
    console.log(`   Reviews analyzed: ${stats.totalReviews}`);
    console.log(`   Average rating: ${stats.averageRating.toFixed(2)}/5`);
    console.log(`   Average difficulty: ${stats.averageDifficulty.toFixed(2)}/5`);

    // Return response
    const response: AnalysisResponse = {
      success: true,
      summary,
      stats,
      reviews,
      professorInfo,
    };

    res.json(response);
  } catch (error) {
    console.error("\nL Error processing request:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});

/**
 * Error handling middleware
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log("\n=� ProfRater API Server");
  console.log(`=� Server running on http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("\nEndpoints:");
  console.log(`   GET  /              - Health check`);
  console.log(`   POST /api/analyze   - Analyze professor reviews`);
  console.log("\n( Ready to analyze professors!\n");
});
