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
 * Zod schema for extracting the entire page data at once
 */
const PageDataSchema = z.object({
  professorName: z.string().describe("The professor's full name"),
  department: z.string().describe("Professor's department or subject area"),
  overallRating: z.number().describe("Overall average rating (1-5)"),
  totalRatings: z.number().describe("Total number of ratings"),
  wouldTakeAgainPercent: z.number().describe("Percentage of students who would take again (0-100)"),
  difficultyRating: z.number().describe("Average difficulty rating (1-5)"),
  reviews: z.array(z.object({
    rating: z.number().describe("The quality rating given by the student (1-5)"),
    difficulty: z.number().describe("The difficulty rating (1-5)"),
    course: z.string().describe("The course name or code"),
    date: z.string().describe("The date of the review"),
    comment: z.string().describe("The written review comment"),
    tags: z.array(z.string()).describe("Tags associated with the review (e.g., 'Tough grader', 'Amazing lectures')"),
    thumbsUp: z.number().describe("Number of helpful votes"),
    thumbsDown: z.number().describe("Number of not helpful votes"),
  })).describe("All student reviews visible on the page"),
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
      verbose: 1,
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
    // PHASE 1: NAVIGATION
    // ============================================================
    console.log("📋 PHASE 1: NAVIGATION");
    console.log("-".repeat(60));

    // Step 1.1: Navigate to RateMyProfessor
    console.log("🌐 Step 1.1: Navigating to RateMyProfessor.com...");
    await page.goto("https://www.ratemyprofessors.com/", {
      waitUntil: "domcontentloaded",
    });
    console.log("   ✅ Page loaded");
    await wait(2000);

    // Step 1.2: Type university name in school search field
    console.log(`\n🏫 Step 1.2: Searching for university "${universityName}"...`);
    await stagehand.act(
      `Type "${universityName}" into the school search field`
    );
    console.log("   ✅ University name typed");
    await wait(1500);

    // Step 1.3: Click TOP result from university dropdown
    console.log("\n👆 Step 1.3: Clicking top university result...");
    await stagehand.act(
      "Click on the first/top university in the dropdown results"
    );
    console.log("   ✅ University selected");
    await wait(2000);

    // Step 1.4: Type professor name in professor search field
    console.log(`\n👨‍🏫 Step 1.4: Searching for professor "${professorName}"...`);
    await stagehand.act(
      `Type "${professorName}" into the professor search field`
    );
    console.log("   ✅ Professor name typed");
    await wait(1500);

    // Step 1.5: Click TOP professor result
    console.log("\n👆 Step 1.5: Clicking top professor result...");
    await stagehand.act(
      "Click on the first/top professor in the search results"
    );
    console.log("   ✅ Professor page loading...");
    await wait(3000);
    console.log("   ✅ Professor page loaded\n");

    // ============================================================
    // PHASE 2: REVIEW LOADING (CRITICAL)
    // ============================================================
    console.log("📋 PHASE 2: REVIEW LOADING");
    console.log("-".repeat(60));

    // Step 2.1: Extract total number of ratings
    console.log("📊 Step 2.1: Getting total number of ratings...");
    const totalRatingsData = await stagehand.extract(
      "Extract the total number of ratings displayed on this professor's page",
      TotalRatingsSchema
    ) as z.infer<typeof TotalRatingsSchema>;
    const totalRatings = totalRatingsData.totalRatings;
    console.log(`   ✅ Total ratings found: ${totalRatings}`);

    // Step 2.2: Load ALL reviews by clicking "Show More" / "Load More Ratings"
    console.log("\n📜 Step 2.2: Loading all reviews...");
    let clickCount = 0;
    let maxClicks = Math.ceil(totalRatings / 20); // Estimate max clicks needed (assuming ~20 reviews per page)

    console.log(`   Estimated clicks needed: ${maxClicks}`);

    while (clickCount < maxClicks) {
      try {
        console.log(`   Attempt ${clickCount + 1}/${maxClicks}: Clicking "Load More" button...`);

        await stagehand.act(
          'Click the "Load More" or "Show More" button to load more ratings'
        );

        clickCount++;
        console.log(`   ✅ Click ${clickCount} successful, waiting for reviews to load...`);
        await wait(2000); // Wait for reviews to load

      } catch (error) {
        console.log(`   ℹ️  No more "Load More" button found (clicked ${clickCount} times)`);
        console.log("   ✅ All reviews loaded!");
        break;
      }
    }

    if (clickCount >= maxClicks) {
      console.log(`   ⚠️  Reached maximum clicks (${maxClicks}), proceeding with loaded reviews`);
    }

    // Give extra time for all reviews to settle
    console.log("\n⏳ Waiting for all reviews to settle...");
    await wait(3000);
    console.log("   ✅ Reviews settled\n");

    // ============================================================
    // PHASE 3: SCRAPING
    // ============================================================
    console.log("📋 PHASE 3: SCRAPING");
    console.log("-".repeat(60));

    console.log("🔍 Extracting all data from page...");
    const pageData = await stagehand.extract(
      "Extract all professor information and ALL review cards from the page. Include professor name, department, overall rating, total ratings, would take again percentage, difficulty rating, and every single review with its rating, difficulty, course, date, comment, tags, thumbs up count, and thumbs down count.",
      PageDataSchema
    ) as z.infer<typeof PageDataSchema>;

    console.log("   ✅ Data extracted successfully!");
    console.log(`   Professor: ${pageData.professorName}`);
    console.log(`   Department: ${pageData.department}`);
    console.log(`   Overall Rating: ${pageData.overallRating}/5`);
    console.log(`   Total Ratings: ${pageData.totalRatings}`);
    console.log(`   Would Take Again: ${pageData.wouldTakeAgainPercent}%`);
    console.log(`   Difficulty: ${pageData.difficultyRating}/5`);
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

    // Return data in expected format
    return {
      professorInfo: {
        overallRating: pageData.overallRating,
        totalRatings: pageData.totalRatings,
        wouldTakeAgainPercent: pageData.wouldTakeAgainPercent,
        difficultyRating: pageData.difficultyRating,
        department: pageData.department,
      },
      reviews: pageData.reviews,
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
