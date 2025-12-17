/**
 * ProfRater Worker Service
 *
 * Long-running worker that processes scraping jobs for Vercel serverless functions.
 * Uses Redis for job queue state management.
 *
 * Architecture:
 * - Next.js (Vercel) creates jobs and polls for results
 * - Redis (Upstash) stores job state and results
 * - Worker (Render) executes long-running scraping tasks
 *
 * Endpoints:
 * - POST /run-job: Process a scraping job from the queue
 * - GET /health: Health check for monitoring
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { scrapeProfessor } from './scraper';
import { analyzeWithAI } from './analyzer';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ============================================================
// REDIS CONNECTION
// ============================================================

// Parse Redis URL to detect if SSL/TLS is needed
const redisUrl = process.env.REDIS_URL!;
const usesTLS = redisUrl.startsWith('rediss://');

// Configure Redis with conditional TLS
const redis = new Redis(redisUrl, {
  tls: usesTLS ? { rejectUnauthorized: false } : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: false,
  enableOfflineQueue: false
});

// Add this log right after creating redis:
console.log(`🔗 Connecting to Redis (${usesTLS ? 'with TLS' : 'without TLS'})...`);

// Redis connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis client connected');
});

redis.on('ready', () => {
  console.log('✅ Redis client ready to accept commands');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

redis.on('close', () => {
  console.log('⚠️  Redis connection closed');
});

// ============================================================
// MIDDLEWARE
// ============================================================

// Enable CORS for Next.js frontend
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://*.vercel.app',
    /https:\/\/.*\.vercel\.app$/
  ],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// JOB INTERFACE
// ============================================================

interface Job {
  status: 'pending' | 'running' | 'complete' | 'error';
  professorName: string;
  university: string;
  userQuestion?: string;
  result?: {
    reviews: any[];
    professorInfo: any;
    aiSummary: string;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// ENDPOINTS
// ============================================================

/**
 * POST /run-job
 *
 * Processes a scraping job from the queue:
 * 1. Retrieves job from Redis
 * 2. Updates status to "running"
 * 3. Scrapes professor reviews
 * 4. Generates AI analysis
 * 5. Stores results in Redis
 *
 * Request body: { jobId: string }
 * Response: { success: boolean, message: string }
 */
app.post('/run-job', async (req, res) => {
  const startTime = Date.now();
  const { jobId } = req.body;

  console.log('\n' + '='.repeat(70));
  console.log(`📋 NEW JOB REQUEST`);
  console.log('='.repeat(70));
  console.log(`Job ID: ${jobId}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(70) + '\n');

  // Validate request
  if (!jobId) {
    console.error('❌ ERROR: Missing jobId in request body');
    return res.status(400).json({
      success: false,
      message: 'Missing jobId in request body'
    });
  }

  try {
    // ============================================================
    // STEP 1: RETRIEVE JOB FROM REDIS
    // ============================================================
    console.log('📥 STEP 1: Retrieving job from Redis...');
    console.log(`   Redis URL: ${process.env.REDIS_URL?.substring(0, 30)}...`);

    const jobStr = await redis.get(jobId);
    const job = jobStr ? JSON.parse(jobStr) as Job : null;

    if (!job) {
      console.error(`❌ ERROR: Job ${jobId} not found in Redis store`);
      return res.status(404).json({
        success: false,
        message: `Job ${jobId} not found`
      });
    }

    console.log(`✅ Job retrieved successfully`);
    console.log(`   Professor: ${job.professorName}`);
    console.log(`   University: ${job.university}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Created: ${job.createdAt}`);

    // ============================================================
    // STEP 2: UPDATE STATUS TO RUNNING
    // ============================================================
    console.log('\n📝 STEP 2: Updating job status to "running"...');

    const updatedJob: Job = {
      ...job,
      status: 'running',
      updatedAt: new Date().toISOString()
    };

    await redis.set(jobId, JSON.stringify(updatedJob));
    console.log('✅ Job status updated to "running"');

    // ============================================================
    // STEP 3: SCRAPE PROFESSOR REVIEWS
    // ============================================================
    console.log('\n🔍 STEP 3: Starting professor scraping...');
    console.log(`   Scraping: ${job.professorName} at ${job.university}`);

    const scrapeStartTime = Date.now();
    const scraperResult = await scrapeProfessor(
      job.professorName,
      job.university
    );
    const scrapeDuration = ((Date.now() - scrapeStartTime) / 1000).toFixed(2);

    console.log(`✅ Scraping completed in ${scrapeDuration}s`);
    console.log(`   Reviews scraped: ${scraperResult.reviews.length}`);
    console.log(`   Overall rating: ${scraperResult.professorInfo.overallRating}/5`);

    // ============================================================
    // STEP 4: GENERATE AI ANALYSIS
    // ============================================================
    console.log('\n🤖 STEP 4: Generating AI analysis...');

    const aiStartTime = Date.now();
    const aiSummary = await analyzeWithAI(
      scraperResult.reviews,
      scraperResult.professorInfo,
      job.userQuestion
    );
    const aiDuration = ((Date.now() - aiStartTime) / 1000).toFixed(2);

    console.log(`✅ AI analysis completed in ${aiDuration}s`);
    console.log(`   Summary length: ${aiSummary.length} characters`);

    // ============================================================
    // STEP 5: STORE RESULTS IN REDIS
    // ============================================================
    console.log('\n💾 STEP 5: Storing results in Redis...');

    const completedJob: Job = {
      ...updatedJob,
      status: 'complete',
      result: {
        reviews: scraperResult.reviews,
        professorInfo: scraperResult.professorInfo,
        aiSummary
      },
      updatedAt: new Date().toISOString()
    };

    await redis.set(jobId, JSON.stringify(completedJob));
    console.log('✅ Results stored successfully');

    // ============================================================
    // SUCCESS SUMMARY
    // ============================================================
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 JOB COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log(`Job ID: ${jobId}`);
    console.log(`Professor: ${job.professorName} (${job.university})`);
    console.log(`Reviews: ${scraperResult.reviews.length}`);
    console.log(`Duration: ${totalDuration}s (scrape: ${scrapeDuration}s, AI: ${aiDuration}s)`);
    console.log(`Completed: ${new Date().toISOString()}`);
    console.log('='.repeat(70) + '\n');

    return res.json({
      success: true,
      message: `Job ${jobId} completed successfully`,
      duration: totalDuration,
      reviewCount: scraperResult.reviews.length
    });

  } catch (error) {
    // ============================================================
    // ERROR HANDLING
    // ============================================================
    console.error('\n' + '='.repeat(70));
    console.error('❌ JOB FAILED');
    console.error('='.repeat(70));
    console.error(`Job ID: ${jobId}`);
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('='.repeat(70) + '\n');

    // Store error in Redis
    try {
      console.log('💾 Storing error status in Redis...');

      const jobStr = await redis.get(jobId);
      const job = jobStr ? JSON.parse(jobStr) as Job : null;
      if (job) {
        const errorJob: Job = {
          ...job,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString()
        };

        await redis.set(jobId, JSON.stringify(errorJob));
        console.log('✅ Error status stored in Redis');
      }
    } catch (redisError) {
      console.error('❌ Failed to store error in Redis:', redisError);
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      jobId
    });
  }
});

/**
 * GET /health
 *
 * Health check endpoint for monitoring and uptime checks.
 * Returns server status and environment info.
 *
 * Response: { status: 'ok', timestamp: string, uptime: number, env: object }
 */
app.get('/health', (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: {
      nodeVersion: process.version,
      platform: process.platform,
      hasRedisUrl: !!process.env.REDIS_URL,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasBrowserbaseKey: !!process.env.BROWSERBASE_API_KEY,
      hasBrowserbaseProjectId: !!process.env.BROWSERBASE_PROJECT_ID,
    }
  };

  console.log(`🏥 Health check passed - Uptime: ${Math.floor(healthData.uptime)}s`);
  res.json(healthData);
});

/**
 * GET /
 *
 * Root endpoint - basic info about the worker service
 */
app.get('/', (req, res) => {
  res.json({
    name: 'ProfRater Worker Service',
    version: '1.0.0',
    description: 'Long-running worker for processing professor scraping jobs',
    endpoints: {
      'POST /run-job': 'Process a scraping job from the queue',
      'GET /health': 'Health check endpoint'
    },
    status: 'running'
  });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 PROFRATER WORKER SERVICE STARTED');
  console.log('='.repeat(70));
  console.log(`Port: ${PORT}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('\nEnvironment Check:');
  console.log(`  ✓ REDIS_URL: ${process.env.REDIS_URL ? 'Set' : '❌ Missing'}`);
  console.log(`  ✓ ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'Set' : '❌ Missing'}`);
  console.log(`  ✓ BROWSERBASE_API_KEY: ${process.env.BROWSERBASE_API_KEY ? 'Set' : '❌ Missing'}`);
  console.log(`  ✓ BROWSERBASE_PROJECT_ID: ${process.env.BROWSERBASE_PROJECT_ID ? 'Set' : '❌ Missing'}`);
  console.log(`  ✓ OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set' : '❌ Missing'}`);
  console.log('\nEndpoints:');
  console.log(`  POST http://localhost:${PORT}/run-job`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log('='.repeat(70) + '\n');
  console.log('✅ Worker is ready to process jobs!\n');
});

// ============================================================
// ERROR HANDLERS
// ============================================================

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('\n💥 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
});
