/**
 * ProfRater Scraper Module
 * Uses Stagehand with Browserbase for AI-powered web scraping of RateMyProfessor
 *
 * FIXED: Proper interaction order with RateMyProfessor
 * 1. Navigate to site
 * 2. Search university first, then professor
 * 3. Load ALL reviews before scraping
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { Review, ProfessorInfo, ScraperResult } from "./types";

/**
 * Helper function to wait for a specified amount of time
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Zod schema for extracting the total number of ratings
 */
const TotalRatingsSchema = z.object({
  totalRatings: z.number().describe("The total number of ratings shown on the page"),
});

/**
 * TypeScript type for extracted review data
 */
type ExtractedReview = {
  rating: number;
  difficulty?: number;
  course?: string;
  date: string;
  comment: string;
  tags?: string[];
  thumbsUp?: number;
  thumbsDown?: number;
};

/**
 * TypeScript type for extracted page data
 */
type ExtractedPageData = {
  professorName: string;
  department?: string;
  overallRating: number;
  totalRatings: number;
  wouldTakeAgainPercent?: number;
  difficultyRating?: number;
  reviews: ExtractedReview[];
};

/**
 * Zod schema for a single review
 * Extracted separately to avoid deep type instantiation issues
 */
const ReviewSchema = z.object({
  rating: z.number().describe("The quality rating given by the student (1-5)"),
  difficulty: z.number().optional().describe("The difficulty rating (1-5). May not be present for all reviews."),
  course: z.string().optional().describe("The course name or code. If not visible, omit it."),
  date: z.string().describe("The date of the review"),
  comment: z.string().describe("The written review comment"),
  tags: z.array(z.string()).optional().describe("Tags associated with the review (e.g., 'Tough grader', 'Amazing lectures'). Omit if no tags."),
  thumbsUp: z.number().optional().describe("Number of helpful votes. Omit if not visible."),
  thumbsDown: z.number().optional().describe("Number of not helpful votes. Omit if not visible."),
});

/**
 * Zod schema for extracting the entire page data at once
 * Made flexible to handle professors with incomplete data
 */
const PageDataSchema = z.object({
  professorName: z.string().describe("The professor's full name"),
  department: z.string().optional().describe("Professor's department or subject area. If not found, omit it."),
  overallRating: z.number().describe("Overall average rating (1-5)"),
  totalRatings: z.number().describe("Total number of ratings"),
  wouldTakeAgainPercent: z.number().optional().describe("Percentage of students who would take again (0-100). This may not be available for all professors."),
  difficultyRating: z.number().optional().describe("Average difficulty rating (1-5). This may not be available for all professors."),
  reviews: z.array(ReviewSchema).describe("All student reviews visible on the page"),
});

/**
 * Scrapes professor reviews and information from RateMyProfessor
 * Uses Stagehand's AI-powered navigation and extraction
 *
 * @param professorName - Full name of the professor
 * @param universityName - Name of the university
 * @returns ScraperResult containing reviews and professor info
 */
export async function scrapeProfessor(
  professorName: string,
  universityName: string
): Promise<ScraperResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 STARTING SCRAPE`);
  console.log(`   Professor: ${professorName}`);
  console.log(`   University: ${universityName}`);
  console.log(`${"=".repeat(60)}\n`);

  let stagehand: Stagehand | null = null;

  try {
    // ============================================================
    // PHASE 0: INITIALIZATION
    // ============================================================
    console.log("📋 PHASE 0: INITIALIZATION");
    console.log("-".repeat(60));

    // Validate environment variables
    console.log("🔐 Validating environment variables...");
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
    const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not set in environment variables");
    }
    if (!browserbaseApiKey) {
      throw new Error("BROWSERBASE_API_KEY is not set in environment variables");
    }
    if (!browserbaseProjectId) {
      throw new Error("BROWSERBASE_PROJECT_ID is not set in environment variables");
    }

    console.log(`   ✅ OpenAI API Key: ${openaiApiKey.substring(0, 7)}...`);
    console.log(`   ✅ Browserbase API Key: ${browserbaseApiKey.substring(0, 7)}...`);
    console.log(`   ✅ Browserbase Project ID: ${browserbaseProjectId}`);

    // Initialize Stagehand with Browserbase
    console.log("\n🚀 Initializing Stagehand with Browserbase...");
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: browserbaseApiKey,
      projectId: browserbaseProjectId,
      verbose: 0, // Disable verbose logging for serverless compatibility
      domSettleTimeout: 1000,
      model: {
        modelName: "gpt-4o",
        apiKey: openaiApiKey,
      },
    });
    console.log("   ✅ Stagehand instance created");

    // Initialize the session
    console.log("⏳ Initializing browser session...");
    await stagehand.init();
    console.log("   ✅ Browser session initialized");
    await wait(2000);
    console.log("   ✅ Browser stabilized\n");

    // Get the page
    const pages = stagehand.context.pages();
    if (pages.length === 0) {
      throw new Error("No page available after initialization");
    }
    const page = pages[0];

    // ============================================================
    // PHASE 1: NAVIGATION (SIMPLIFIED - USING SEARCH URL)
    // ============================================================
    console.log("📋 PHASE 1: NAVIGATION");
    console.log("-".repeat(60));

    // Build search URL directly to bypass unreliable UI
    const searchQuery = `${professorName} ${universityName}`;
    const searchUrl = `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(searchQuery)}`;

    console.log(`🔍 Navigating directly to search: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await wait(5000); // Wait for search results

    console.log(`👆 Clicking first professor result...`);
    await stagehand.act(`Click on the first professor card in the search results`);
    await wait(4000);

    // Validate we're on a professor page
    console.log("🔍 Validating professor page...");
    const currentUrl = page.url();
    if (!currentUrl.includes("ratemyprofessors.com/professor/")) {
      throw new Error(`Navigation failed: Not on a professor page. Current URL: ${currentUrl}`);
    }
    console.log(`   ✅ Confirmed on professor page: ${currentUrl}\n`);

    // ============================================================
    // PHASE 2: REVIEW LOADING (CRITICAL)
    // ============================================================
    console.log("📋 PHASE 2: REVIEW LOADING");
    console.log("-".repeat(60));

    // Step 2.1: Scroll down to ensure page is loaded
    console.log("📜 Step 2.1: Scrolling to load initial reviews...");
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await wait(2000);
    console.log("   ✅ Initial scroll complete");

    // Step 2.2: Wait for initial reviews to load
    console.log("\n📜 Step 2.2: Waiting for initial reviews to load...");
    await wait(3000);
    console.log("   ✅ Initial reviews loaded (will scrape ~20-30 reviews)\n");

    // ============================================================
    // PHASE 3: SCRAPING
    // ============================================================
    console.log("📋 PHASE 3: SCRAPING");
    console.log("-".repeat(60));

    console.log("🔍 Extracting all data from page...");
    const pageData = await stagehand.extract(
      `Extract all professor information and ALL review cards visible on the page.

      IMPORTANT: Some fields may not be present - only include them if they are clearly visible:
      - Department: include if visible, otherwise omit
      - Would Take Again percentage: include if shown, otherwise omit
      - Difficulty rating: include if shown, otherwise omit

      For each review, extract what is visible:
      - Rating (always present)
      - Difficulty (include if shown, otherwise omit)
      - Course name (include if shown, otherwise omit)
      - Date (always present)
      - Comment text (always present)
      - Tags (include if present, otherwise omit)
      - Thumbs up count (include if shown, otherwise omit)
      - Thumbs down count (include if shown, otherwise omit)

      Extract every single review card that is currently loaded on the page.`,
      PageDataSchema as any
    ) as ExtractedPageData;

    console.log("   ✅ Data extracted successfully!");
    console.log(`   Professor: ${pageData.professorName}`);
    console.log(`   Department: ${pageData.department ?? 'Not specified'}`);
    console.log(`   Overall Rating: ${pageData.overallRating}/5`);
    console.log(`   Total Ratings: ${pageData.totalRatings}`);
    console.log(`   Would Take Again: ${pageData.wouldTakeAgainPercent !== undefined ? pageData.wouldTakeAgainPercent + '%' : 'N/A'}`);
    console.log(`   Difficulty: ${pageData.difficultyRating !== undefined ? pageData.difficultyRating + '/5' : 'N/A'}`);
    console.log(`   Reviews Scraped: ${pageData.reviews.length}`);

    // ============================================================
    // CLEANUP
    // ============================================================
    console.log("\n🔚 Closing browser session...");
    await stagehand.close();
    console.log("   ✅ Browser closed");

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎉 SCRAPING COMPLETED SUCCESSFULLY`);
    console.log(`   Total Reviews: ${pageData.reviews.length}`);
    console.log(`${"=".repeat(60)}\n`);

    // Return data in expected format with defaults for optional fields
    return {
      professorInfo: {
        overallRating: pageData.overallRating,
        totalRatings: pageData.totalRatings,
        wouldTakeAgainPercent: pageData.wouldTakeAgainPercent ?? 0,
        difficultyRating: pageData.difficultyRating ?? 0,
        department: pageData.department ?? "Not specified",
      },
      reviews: pageData.reviews.map(review => ({
        rating: review.rating,
        difficulty: review.difficulty ?? 0,
        course: review.course ?? "Not specified",
        date: review.date,
        comment: review.comment,
        tags: review.tags ?? [],
        thumbsUp: review.thumbsUp ?? 0,
        thumbsDown: review.thumbsDown ?? 0,
      })),
    };

  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ SCRAPER ERROR");
    console.error("=".repeat(60));
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error message:", error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    // Re-throw with context
    throw new Error(
      `Failed to scrape professor data for ${professorName} at ${universityName}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );

  } finally {
    // Ensure browser is always closed
    if (stagehand !== null) {
      try {
        console.log("\n🧹 Ensuring browser cleanup...");
        await stagehand.close();
        console.log("   ✅ Cleanup complete");
      } catch (closeError) {
        console.error("   ⚠️  Error during cleanup:", closeError instanceof Error ? closeError.message : String(closeError));
      }
    }
  }
}
