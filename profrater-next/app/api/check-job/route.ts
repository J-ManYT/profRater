/**
 * API Route: GET /api/check-job?id=jobId
 *
 * Checks the status of a scraping job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/redis';
import { CheckJobResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    // Get job ID from query params
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('id');

    // Validate input
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required (query param: id)' },
        { status: 400 }
      );
    }

    // Get job from Redis
    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: `Job ${jobId} not found` },
        { status: 404 }
      );
    }

    // Return job with ID
    const response: CheckJobResponse = {
      jobId,
      ...job,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error in /api/check-job:', error);
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
