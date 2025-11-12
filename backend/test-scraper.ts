/**
 * Simple test script for the scraper
 */
import dotenv from "dotenv";
import { scrapeProfessor } from "./src/scraper";

// Load environment variables
dotenv.config();

async function test() {
  console.log("Starting scraper test...\n");

  try {
    const result = await scrapeProfessor("Mark Guzdial", "University of Michigan");
    console.log("\n✅ Success!");
    console.log("Professor Info:", result.professorInfo);
    console.log(`Found ${result.reviews.length} reviews`);

    if (result.reviews.length > 0) {
      console.log("\nFirst review:");
      console.log(result.reviews[0]);
    }
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  }
}

test();
