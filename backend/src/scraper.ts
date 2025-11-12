/**
 * ProfRater Scraper Module
 * Uses Puppeteer with Browserbase for web scraping of RateMyProfessor
 */

import puppeteer, { Browser, Page } from "puppeteer-core";
import { Review, ProfessorInfo, ScraperResult } from "./types";

/**
 * Helper function to wait for a specified amount of time
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scrapes professor reviews and information from RateMyProfessor
 * Uses Puppeteer with Browserbase for browser automation
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

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Load and validate environment variables
    console.log("🔐 Validating environment variables...");
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

    // Connect to Browserbase via WebSocket
    console.log("🚀 Connecting to Browserbase...");
    const browserWSEndpoint = `wss://connect.browserbase.com?apiKey=${browserbaseApiKey}&projectId=${browserbaseProjectId}`;

    try {
      browser = await puppeteer.connect({
        browserWSEndpoint,
        defaultViewport: {
          width: 1280,
          height: 720,
        },
      });
      console.log("✅ Connected to Browserbase");
    } catch (connectError) {
      console.error("❌ Failed to connect to Browserbase:", connectError);
      throw new Error(
        `Browserbase connection failed: ${connectError instanceof Error ? connectError.message : String(connectError)}`
      );
    }

    // Get browser pages
    try {
      console.log("📄 Getting browser page...");
      const pages = await browser.pages();
      console.log(`   Found ${pages.length} page(s)`);

      if (pages.length > 0) {
        page = pages[0];
      } else {
        page = await browser.newPage();
      }
      console.log("✅ Page ready");
    } catch (pageError) {
      console.error("❌ Failed to get page:", pageError);
      throw new Error(
        `Failed to get page: ${pageError instanceof Error ? pageError.message : String(pageError)}`
      );
    }

    // Navigate directly to search page with query
    try {
      console.log(`🔎 Searching for "${professorName}" at "${universityName}"...`);

      // Build search query URL
      const searchQuery = `${professorName} ${universityName}`;
      const encodedQuery = encodeURIComponent(searchQuery);
      const searchUrl = `https://www.ratemyprofessors.com/search/professors?q=${encodedQuery}`;

      console.log(`   Search URL: ${searchUrl}`);

      // Navigate directly to search results
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      console.log("✅ Search page loaded");

      // Wait for results to render
      await wait(3000);

      const currentUrl = page.url();
      console.log(`   Current URL: ${currentUrl}`);
    } catch (searchError) {
      console.error("❌ Search failed:", searchError);
      throw new Error(
        `Failed to search: ${searchError instanceof Error ? searchError.message : String(searchError)}`
      );
    }

    // Click on first professor result
    try {
      console.log("👆 Looking for professor result...");

      // Debug: Find all links on the page
      const links = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll("a[href*='professor']"));
        return allLinks.slice(0, 5).map((link) => ({
          href: link.getAttribute("href"),
          text: link.textContent?.trim().substring(0, 50),
          className: link.className,
        }));
      });
      console.log("   Found professor links:", JSON.stringify(links, null, 2));

      if (links.length === 0) {
        throw new Error("No professor links found on search results page");
      }

      // Get the first professor link's href
      const firstProfessorHref = links[0].href;
      if (!firstProfessorHref) {
        throw new Error("First professor link has no href");
      }

      // Navigate directly to the professor page using the href
      const professorUrl = firstProfessorHref.startsWith("http")
        ? firstProfessorHref
        : `https://www.ratemyprofessors.com${firstProfessorHref}`;

      console.log(`   Navigating to: ${professorUrl}`);

      await page.goto(professorUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      console.log("✅ Professor page loaded");

      // Wait for page to settle
      await wait(3000);

      const currentUrl = page.url();
      console.log(`   Current URL: ${currentUrl}`);
    } catch (clickError) {
      console.error("❌ Click failed:", clickError);
      throw new Error(
        `Failed to click professor: ${clickError instanceof Error ? clickError.message : String(clickError)}`
      );
    }

    // Extract professor information
    console.log("📊 Extracting professor information...");
    let professorInfo: ProfessorInfo;

    try {
      professorInfo = (await page.evaluate(`
        (() => {
          function safeGetText(selector) {
            const element = document.querySelector(selector);
            return element?.textContent?.trim() || "";
          }

          function safeGetNumber(selector) {
            const text = safeGetText(selector);
            const num = parseFloat(text.replace(/[^\\d.]/g, ""));
            return isNaN(num) ? 0 : num;
          }

          let overallRating = 0;
          const ratingSelectors = [
            '[class*="RatingValue"]',
            '[class*="rating-value"]',
            '[class*="avgRating"]',
            'div[class*="Rating"]'
          ];

          for (const selector of ratingSelectors) {
            const val = safeGetNumber(selector);
            if (val > 0) {
              overallRating = val;
              break;
            }
          }

          const totalRatingsText = safeGetText('[class*="RatingValue"] + div, [class*="rating-count"]');
          const totalRatings = parseInt(totalRatingsText.replace(/[^\\d]/g, "")) || 0;

          let wouldTakeAgainPercent = 0;
          const feedbackItems = Array.from(document.querySelectorAll('[class*="FeedbackItem"]'));
          for (const item of feedbackItems) {
            const text = item.textContent || "";
            if (text.toLowerCase().includes("would take again")) {
              const percent = parseFloat(text.replace(/[^\\d.]/g, ""));
              if (!isNaN(percent)) {
                wouldTakeAgainPercent = percent;
                break;
              }
            }
          }

          let difficultyRating = 0;
          for (const item of feedbackItems) {
            const text = item.textContent || "";
            if (text.toLowerCase().includes("difficulty")) {
              const rating = parseFloat(text.replace(/[^\\d.]/g, ""));
              if (!isNaN(rating)) {
                difficultyRating = rating;
                break;
              }
            }
          }

          const department =
            safeGetText('[class*="TeacherDepartment"]') ||
            safeGetText('[class*="department"]') ||
            "Unknown";

          return {
            overallRating,
            totalRatings,
            wouldTakeAgainPercent,
            difficultyRating,
            department
          };
        })()
      `)) as ProfessorInfo;

      console.log(
        `✅ Professor info extracted: ${professorInfo.overallRating}/5 (${professorInfo.totalRatings} ratings)`
      );
    } catch (extractInfoError) {
      console.error("❌ Failed to extract professor info:", extractInfoError);
      throw new Error(
        `Failed to extract professor info: ${extractInfoError instanceof Error ? extractInfoError.message : String(extractInfoError)}`
      );
    }

    // Extract reviews
    console.log("💬 Extracting reviews...");
    let reviews: Review[];

    try {
      // Scroll to load more reviews
      console.log("   Scrolling to load reviews...");
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await wait(1000);
      }

      reviews = (await page.evaluate(`
        (() => {
          function safeCardText(card, selector) {
            const element = card.querySelector(selector);
            return element?.textContent?.trim() || "";
          }

          function safeCardNumber(card, selector) {
            const text = safeCardText(card, selector);
            const num = parseFloat(text.replace(/[^\\d.]/g, ""));
            return isNaN(num) ? 0 : num;
          }

          const reviewSelectors = [
            '[class*="Rating__StyledRating"]',
            '[class*="rating-card"]',
            '[class*="RatingCard"]',
            '[class*="Review"]'
          ];

          let reviewCards = [];
          for (const selector of reviewSelectors) {
            reviewCards = Array.from(document.querySelectorAll(selector));
            if (reviewCards.length > 0) break;
          }

          return reviewCards.map((card) => {
            let rating = 0;
            const ratingSelectors = ['[class*="CardNumRating"]', '[class*="quality"]', '[class*="Rating"]'];
            for (const selector of ratingSelectors) {
              const val = safeCardNumber(card, selector);
              if (val > 0) {
                rating = val;
                break;
              }
            }

            let difficulty = 0;
            const difficultySelectors = ['[class*="Difficulty"]', '[class*="difficulty"]'];
            for (const selector of difficultySelectors) {
              const val = safeCardNumber(card, selector);
              if (val > 0) {
                difficulty = val;
                break;
              }
            }

            const courseSelectors = ['[class*="RatingHeader__StyledClass"]', '[class*="course"]', '[class*="Class"]'];
            let course = "N/A";
            for (const selector of courseSelectors) {
              const val = safeCardText(card, selector);
              if (val) {
                course = val;
                break;
              }
            }

            const dateSelectors = ['[class*="TimeStamp"]', '[class*="date"]', '[class*="Date"]'];
            let date = "Unknown";
            for (const selector of dateSelectors) {
              const val = safeCardText(card, selector);
              if (val) {
                date = val;
                break;
              }
            }

            const commentSelectors = ['[class*="Comments"]', '[class*="comment"]', '[class*="Comment"]'];
            let comment = "";
            for (const selector of commentSelectors) {
              const val = safeCardText(card, selector);
              if (val) {
                comment = val;
                break;
              }
            }

            const tagElements = Array.from(card.querySelectorAll('[class*="Tag"], [class*="tag"]'));
            const tags = tagElements
              .map((tag) => tag.textContent?.trim() || "")
              .filter((t) => t.length > 0);

            const thumbsUpText = safeCardText(card, '[class*="thumbs-up"], [class*="helpful"]');
            const thumbsUp = parseInt(thumbsUpText.replace(/[^\\d]/g, "")) || 0;

            const thumbsDownText = safeCardText(card, '[class*="thumbs-down"], [class*="unhelpful"]');
            const thumbsDown = parseInt(thumbsDownText.replace(/[^\\d]/g, "")) || 0;

            return {
              rating,
              difficulty,
              course,
              date,
              comment,
              tags,
              thumbsUp,
              thumbsDown
            };
          });
        })()
      `)) as Review[];

      // Filter out empty reviews
      reviews = reviews.filter((review) => review.comment.length > 0);

      console.log(`✅ Extracted ${reviews.length} reviews`);

      if (reviews.length === 0) {
        console.warn("⚠️  No reviews found - selectors may need updating");
      }
    } catch (extractReviewsError) {
      console.error("❌ Failed to extract reviews:", extractReviewsError);
      // Don't throw - return empty reviews instead
      reviews = [];
      console.log("   Continuing with empty reviews array");
    }

    console.log("🎉 Scraping completed successfully!");

    return {
      reviews,
      professorInfo,
    };
  } catch (error) {
    console.error("❌❌❌ SCRAPER ERROR ❌❌❌");
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }

    // Re-throw with detailed error message
    throw new Error(
      `Failed to scrape professor data: ${error instanceof Error ? error.message : "Unknown error"}. Check logs for details.`
    );
  } finally {
    // Ensure browser is closed
    if (browser) {
      try {
        console.log("🧹 Closing browser...");
        await browser.disconnect();
        console.log("✅ Browser closed");
      } catch (closeError) {
        console.error("⚠️  Error closing browser:", closeError);
      }
    }
  }
}
