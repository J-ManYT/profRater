/**
 * ProfRater Scraper Module
 * Uses Stagehand with Browserbase for AI-powered web scraping of RateMyProfessor
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";
import { Review, ProfessorInfo, ScraperResult } from "./types";

/**
 * Helper function to wait for a specified amount of time
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Zod schema for extracting individual reviews
 */
const ReviewSchema = z.object({
  rating: z.number().describe("The quality rating given by the student (1-5)"),
  difficulty: z.number().describe("The difficulty rating (1-5)"),
  course: z.string().describe("The course name or code"),
  date: z.string().describe("The date of the review"),
  comment: z.string().describe("The written review comment"),
  tags: z.array(z.string()).describe("Tags associated with the review (e.g., 'Tough grader', 'Amazing lectures')"),
  thumbsUp: z.number().describe("Number of helpful votes"),
  thumbsDown: z.number().describe("Number of not helpful votes"),
});

/**
 * Zod schema for extracting professor information
 */
const ProfessorInfoSchema = z.object({
  overallRating: z.number().describe("Overall average rating (1-5)"),
  totalRatings: z.number().describe("Total number of ratings"),
  wouldTakeAgainPercent: z.number().describe("Percentage of students who would take again (0-100)"),
  difficultyRating: z.number().describe("Average difficulty rating (1-5)"),
  department: z.string().describe("Professor's department or subject area"),
});

/**
 * Zod schema for extracting all reviews from the page
 */
const ReviewsSchema = z.object({
  reviews: z.array(ReviewSchema),
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
  console.log(`🔍 Starting scrape for: ${professorName} at ${universityName}`);

  let stagehand: Stagehand | null = null;

  try {
    // Load and validate OpenAI API key
    console.log("🔐 Validating environment variables...");
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not set in environment variables");
    }
    console.log(`🔑 OpenAI API Key loaded: ${openaiApiKey.substring(0, 7)}...`);

    // Validate Browserbase credentials
    const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
    const browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID;

    if (!browserbaseApiKey) {
      throw new Error("BROWSERBASE_API_KEY is not set in environment variables");
    }
    if (!browserbaseProjectId) {
      throw new Error("BROWSERBASE_PROJECT_ID is not set in environment variables");
    }
    console.log(`🔑 Browserbase API Key loaded: ${browserbaseApiKey.substring(0, 7)}...`);
    console.log(`🔑 Browserbase Project ID: ${browserbaseProjectId}`);

    // Initialize Stagehand with Browserbase
    console.log("🚀 Initializing Stagehand with Browserbase...");
    try {
      stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: browserbaseApiKey,
        projectId: browserbaseProjectId,
        verbose: 1,
        domSettleTimeout: 1000,
        model: {
          modelName: "gpt-4o",
          apiKey: openaiApiKey,
        },
      });
      console.log("✅ Stagehand instance created");
    } catch (initError) {
      console.error("❌ Failed to create Stagehand instance:", initError);
      throw new Error(`Stagehand initialization failed: ${initError instanceof Error ? initError.message : String(initError)}`);
    }

    // Initialize the session
    try {
      console.log("⏳ Calling stagehand.init()...");
      await stagehand.init();
      console.log("✅ Stagehand.init() completed");

      // Give the browser a moment to fully initialize
      console.log("⏳ Waiting for browser to stabilize...");
      await wait(2000);
      console.log("✅ Browser ready");
    } catch (initError) {
      console.error("❌ stagehand.init() failed:", initError);
      console.error("Stack trace:", initError instanceof Error ? initError.stack : "No stack trace");
      throw new Error(`Failed to initialize Stagehand session: ${initError instanceof Error ? initError.message : String(initError)}`);
    }

    // Get the page
    let page;
    try {
      console.log("📄 Getting page from context...");
      const pages = stagehand.context.pages();
      console.log(`   Found ${pages.length} page(s) in context`);

      if (pages.length === 0) {
        throw new Error("No pages found in context after initialization");
      }

      page = pages[0];
      console.log("✅ Page object retrieved");
    } catch (pageError) {
      console.error("❌ Failed to get page:", pageError);
      throw new Error(`Failed to get page object: ${pageError instanceof Error ? pageError.message : String(pageError)}`);
    }

    // Navigate to RateMyProfessor
    try {
      console.log("🌐 Navigating to RateMyProfessor.com...");
      console.log("   URL: https://www.ratemyprofessors.com/");
      console.log("   WaitUntil: domcontentloaded");
      console.log("   Timeout: 60000ms");

      await page.goto("https://www.ratemyprofessors.com/", {
        waitUntil: "domcontentloaded",
        timeoutMs: 60000, // 60 second timeout
      });

      console.log("✅ Navigation completed");

      // Wait for page to fully settle
      console.log("⏳ Waiting for page to settle...");
      await wait(3000);
      console.log("✅ Page fully loaded");
    } catch (navError) {
      console.error("❌ Navigation failed:", navError);
      console.error("Error name:", navError instanceof Error ? navError.name : "unknown");
      console.error("Error message:", navError instanceof Error ? navError.message : String(navError));
      console.error("Stack trace:", navError instanceof Error ? navError.stack : "No stack trace");

      // Try to get current URL for debugging
      try {
        const currentUrl = await page.evaluate("window.location.href");
        console.error("Current URL:", currentUrl);
      } catch (e) {
        console.error("Could not get current URL");
      }

      throw new Error(`Failed to navigate to RateMyProfessors: ${navError instanceof Error ? navError.message : String(navError)}`);
    }

    // Search for the professor
    try {
      console.log(`🔎 Searching for "${professorName}" at "${universityName}"...`);
      await stagehand.act(
        `Search for professor "${professorName}" at "${universityName}" and press enter or click search`
      );
      console.log("✅ Search action completed");
    } catch (searchError) {
      console.error("❌ Search failed:", searchError);
      console.error("Stack trace:", searchError instanceof Error ? searchError.stack : "No stack trace");
      throw new Error(`Failed to search for professor: ${searchError instanceof Error ? searchError.message : String(searchError)}`);
    }

    // Wait for search results to load
    console.log("⏳ Waiting for search results (3s)...");
    await wait(3000);
    console.log("✅ Wait completed");

    // Click on the first professor result
    try {
      console.log("👆 Clicking on first professor result...");
      await stagehand.act(
        "Click on the first professor result in the search results"
      );
      console.log("✅ Click action completed");
    } catch (clickError) {
      console.error("❌ Click failed:", clickError);
      console.error("Stack trace:", clickError instanceof Error ? clickError.stack : "No stack trace");
      throw new Error(`Failed to click professor result: ${clickError instanceof Error ? clickError.message : String(clickError)}`);
    }

    // Wait for professor page to load
    console.log("⏳ Waiting for professor page to load (3s)...");
    await wait(3000);
    console.log("✅ Professor page should be loaded");

    // Extract professor information using AI
    try {
      console.log("📊 Extracting professor information...");
      const professorInfo = await stagehand.extract(
        "Extract the professor's overall statistics and information from the page",
        ProfessorInfoSchema
      );
      console.log(`✅ Professor info extracted: ${professorInfo.overallRating}/5 (${professorInfo.totalRatings} ratings)`);

      // Extract all reviews using AI
      console.log("💬 Extracting reviews...");
      const { reviews } = await stagehand.extract(
        "Extract all visible student reviews from the page. Each review should include the rating, difficulty, course, date, comment, tags, and vote counts.",
        ReviewsSchema
      );
      console.log(`✅ Extracted ${reviews.length} reviews`);

      // End the session
      console.log("🔚 Closing browser session...");
      await stagehand.close();
      console.log("🎉 Scraping completed successfully!");

      return {
        reviews,
        professorInfo,
      };
    } catch (extractError) {
      console.error("❌ Extraction failed:", extractError);
      console.error("Stack trace:", extractError instanceof Error ? extractError.stack : "No stack trace");
      throw new Error(`Failed to extract data: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
    }
  } catch (error) {
    console.error("❌❌❌ SCRAPER ERROR ❌❌❌");
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }

    // Re-throw with detailed error message
    throw new Error(
      `Failed to scrape professor data: ${error instanceof Error ? error.message : "Unknown error"}. Check logs for details.`
    );
  } finally {
    // Ensure browser is closed
    if (stagehand !== null) {
      try {
        console.log("🧹 Attempting to close browser session...");
        await stagehand.close();
        console.log("✅ Browser session closed");
      } catch (closeError) {
        console.error("⚠️  Error closing session:", closeError);
        console.error("Close error details:", closeError instanceof Error ? closeError.message : String(closeError));
      }
    }
  }
}
