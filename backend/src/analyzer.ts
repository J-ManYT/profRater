/**
 * ProfRater AI Analyzer Module
 * Uses Anthropic Claude API to analyze professor reviews and generate insights
 */

import Anthropic from "@anthropic-ai/sdk";
import { Review, ProfessorInfo } from "./types";

/**
 * Formats reviews into a structured prompt for Claude
 */
function formatReviewsForPrompt(
  reviews: Review[],
  profInfo: ProfessorInfo,
  userQuestion?: string
): string {
  const reviewTexts = reviews
    .map(
      (review, index) =>
        `Review ${index + 1}:
Rating: ${review.rating}/5 | Difficulty: ${review.difficulty}/5 | Course: ${review.course}
Date: ${review.date}
Tags: ${review.tags.join(", ")}
Comment: ${review.comment}
Votes: =M ${review.thumbsUp} | =N ${review.thumbsDown}
---`
    )
    .join("\n\n");

  const prompt = `You are an expert educational advisor analyzing professor reviews. Your task is to provide a comprehensive, helpful summary for students considering this professor.

PROFESSOR INFORMATION:
- Name: Professor (details from reviews)
- Department: ${profInfo.department}
- Overall Rating: ${profInfo.overallRating}/5.0 (${profInfo.totalRatings} total ratings)
- Would Take Again: ${profInfo.wouldTakeAgainPercent}%
- Difficulty Rating: ${profInfo.difficultyRating}/5.0

STUDENT REVIEWS (${reviews.length} reviews analyzed):
${reviewTexts}

Please analyze these reviews and provide a comprehensive summary in the following format:

## =Ê Quick Stats
(Summarize key numbers: overall rating, difficulty, would take again %, etc.)

## =h<ë Teaching Style
(Describe how this professor teaches, their approach, strengths and weaknesses)

## =Ú Workload & Difficulty
(Explain what students say about homework, exams, time commitment)

## =Ý Grading Style
(Describe grading fairness, curves, extra credit, and how grades are determined)

##  Best For
(What type of student would succeed with this professor?)

##   Watch Out For
(Important warnings or things students should be aware of)

## <¯ Bottom Line
(Your final verdict: should students take this professor? Under what conditions?)

${userQuestion ? `\n## S Your Question: "${userQuestion}"\n(Provide a specific answer to the user's question based on the reviews)\n` : ""}

Keep your tone friendly, honest, and student-focused. Use specific examples from reviews when possible. Be balanced but don't sugarcoat significant issues.`;

  return prompt;
}

/**
 * Analyzes professor reviews using Claude AI
 *
 * @param reviews - Array of reviews to analyze
 * @param profInfo - Professor metadata
 * @param userQuestion - Optional specific question from the user
 * @returns AI-generated markdown summary
 */
export async function analyzeWithAI(
  reviews: Review[],
  profInfo: ProfessorInfo,
  userQuestion?: string
): Promise<string> {
  console.log("> Starting AI analysis with Claude...");

  try {
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Format the prompt
    const prompt = formatReviewsForPrompt(reviews, profInfo, userQuestion);
    console.log(`=Ý Analyzing ${reviews.length} reviews...`);

    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract the text response
    const response = message.content[0];
    if (response.type !== "text") {
      throw new Error("Unexpected response type from Claude API");
    }

    const summary = response.text;
    console.log(" AI analysis completed successfully");
    console.log(`=Ê Generated ${summary.length} characters of analysis`);

    return summary;
  } catch (error) {
    console.error("L Error during AI analysis:", error);
    throw new Error(
      `Failed to analyze reviews with AI: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
