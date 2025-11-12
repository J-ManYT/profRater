// Browser context evaluation functions - pure JavaScript, no TypeScript
// These are used by page.evaluate() and must be self-contained

export const extractProfessorInfo = () => {
  function safeGetText(selector) {
    const element = document.querySelector(selector);
    return element?.textContent?.trim() || "";
  }

  function safeGetNumber(selector) {
    const text = safeGetText(selector);
    const num = parseFloat(text.replace(/[^\d.]/g, ""));
    return isNaN(num) ? 0 : num;
  }

  // Try multiple selectors for overall rating
  let overallRating = 0;
  const ratingSelectors = [
    '[class*="RatingValue"]',
    '[class*="rating-value"]',
    '[class*="avgRating"]',
    'div[class*="Rating"]',
  ];

  for (const selector of ratingSelectors) {
    const val = safeGetNumber(selector);
    if (val > 0) {
      overallRating = val;
      break;
    }
  }

  // Extract total ratings count
  const totalRatingsText = safeGetText('[class*="RatingValue"] + div, [class*="rating-count"]');
  const totalRatings = parseInt(totalRatingsText.replace(/[^\d]/g, "")) || 0;

  // Extract would take again percentage
  let wouldTakeAgainPercent = 0;
  const feedbackItems = Array.from(document.querySelectorAll('[class*="FeedbackItem"]'));
  for (const item of feedbackItems) {
    const text = item.textContent || "";
    if (text.toLowerCase().includes("would take again")) {
      const percent = parseFloat(text.replace(/[^\d.]/g, ""));
      if (!isNaN(percent)) {
        wouldTakeAgainPercent = percent;
        break;
      }
    }
  }

  // Extract difficulty rating
  let difficultyRating = 0;
  for (const item of feedbackItems) {
    const text = item.textContent || "";
    if (text.toLowerCase().includes("difficulty")) {
      const rating = parseFloat(text.replace(/[^\d.]/g, ""));
      if (!isNaN(rating)) {
        difficultyRating = rating;
        break;
      }
    }
  }

  // Extract department
  const department =
    safeGetText('[class*="TeacherDepartment"]') ||
    safeGetText('[class*="department"]') ||
    "Unknown";

  return {
    overallRating,
    totalRatings,
    wouldTakeAgainPercent,
    difficultyRating,
    department,
  };
};

export const extractReviews = () => {
  function safeCardText(card, selector) {
    const element = card.querySelector(selector);
    return element?.textContent?.trim() || "";
  }

  function safeCardNumber(card, selector) {
    const text = safeCardText(card, selector);
    const num = parseFloat(text.replace(/[^\d.]/g, ""));
    return isNaN(num) ? 0 : num;
  }

  // Find all review cards - try multiple selectors
  const reviewSelectors = [
    '[class*="Rating__StyledRating"]',
    '[class*="rating-card"]',
    '[class*="RatingCard"]',
    '[class*="Review"]',
  ];

  let reviewCards = [];
  for (const selector of reviewSelectors) {
    reviewCards = Array.from(document.querySelectorAll(selector));
    if (reviewCards.length > 0) break;
  }

  return reviewCards.map((card) => {
    // Extract rating
    let rating = 0;
    const ratingSelectors = ['[class*="CardNumRating"]', '[class*="quality"]', '[class*="Rating"]'];
    for (const selector of ratingSelectors) {
      const val = safeCardNumber(card, selector);
      if (val > 0) {
        rating = val;
        break;
      }
    }

    // Extract difficulty
    let difficulty = 0;
    const difficultySelectors = ['[class*="Difficulty"]', '[class*="difficulty"]'];
    for (const selector of difficultySelectors) {
      const val = safeCardNumber(card, selector);
      if (val > 0) {
        difficulty = val;
        break;
      }
    }

    // Extract course
    const courseSelectors = ['[class*="RatingHeader__StyledClass"]', '[class*="course"]', '[class*="Class"]'];
    let course = "N/A";
    for (const selector of courseSelectors) {
      const val = safeCardText(card, selector);
      if (val) {
        course = val;
        break;
      }
    }

    // Extract date
    const dateSelectors = ['[class*="TimeStamp"]', '[class*="date"]', '[class*="Date"]'];
    let date = "Unknown";
    for (const selector of dateSelectors) {
      const val = safeCardText(card, selector);
      if (val) {
        date = val;
        break;
      }
    }

    // Extract comment
    const commentSelectors = ['[class*="Comments"]', '[class*="comment"]', '[class*="Comment"]'];
    let comment = "";
    for (const selector of commentSelectors) {
      const val = safeCardText(card, selector);
      if (val) {
        comment = val;
        break;
      }
    }

    // Extract tags
    const tagElements = Array.from(card.querySelectorAll('[class*="Tag"], [class*="tag"]'));
    const tags = tagElements
      .map((tag) => tag.textContent?.trim() || "")
      .filter((t) => t.length > 0);

    // Extract thumbs up/down
    const thumbsUpText = safeCardText(card, '[class*="thumbs-up"], [class*="helpful"]');
    const thumbsUp = parseInt(thumbsUpText.replace(/[^\d]/g, "")) || 0;

    const thumbsDownText = safeCardText(card, '[class*="thumbs-down"], [class*="unhelpful"]');
    const thumbsDown = parseInt(thumbsDownText.replace(/[^\d]/g, "")) || 0;

    return {
      rating,
      difficulty,
      course,
      date,
      comment,
      tags,
      thumbsUp,
      thumbsDown,
    };
  });
};
