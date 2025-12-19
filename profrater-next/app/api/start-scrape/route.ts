/**
 * API Route: POST /api/start-scrape
 *
 * Creates a new scraping job and triggers the worker
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { setJob } from '@/lib/redis';
import { Job, StartScrapeRequest, StartScrapeResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: StartScrapeRequest = await request.json();
    const { professorName, university, userQuestion } = body;

    // Validate input
    if (!professorName || !university) {
      return NextResponse.json(
        { error: 'professorName and university are required' },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const jobId = randomUUID();

    // Create job in Redis
    const job: Job = {
      status: 'queued',
      professorName,
      university,
      userQuestion,
      createdAt: new Date().toISOString(),
    };

    await setJob(jobId, job);

    console.log(`✅ Job created: ${jobId} - ${professorName} at ${university}`);

    // Trigger worker (fire and forget - don't wait for response)
    const workerUrl = process.env.WORKER_URL || 'https://profrater-worker.onrender.com';

    fetch(`${workerUrl}/run-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    })
      .then(async (res) => {
        if (res.ok) {
          console.log(`✅ Worker triggered for job ${jobId}`);
        } else {
          const text = await res.text();
          console.error(`❌ Worker failed for job ${jobId}:`, res.status, text);
        }
      })
      .catch((error) => {
        console.error(`❌ Error triggering worker for job ${jobId}:`, error);
      });

    // Return job ID to frontend
    const response: StartScrapeResponse = {
      jobId,
      message: 'Job created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error in /api/start-scrape:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Enable CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
