# ProfRater Next.js Frontend

AI-powered professor insights from RateMyProfessor reviews.

## Architecture

This Next.js frontend uses a worker/polling architecture:

1. **Frontend** (Next.js 14 with App Router)
   - Search form for professor lookup
   - Polling mechanism to check job status
   - Beautiful UI with Tailwind CSS

2. **API Routes**
   - `/api/start-scrape` - Creates job in Redis and triggers worker
   - `/api/check-job` - Checks job status from Redis

3. **Worker** (External service at Render.com)
   - Processes long-running scraping jobs
   - Updates job status in Redis
   - Stores results when complete

4. **Redis** (Upstash)
   - Job queue state management
   - Shared between frontend and worker

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your credentials:
   ```env
   REDIS_URL=redis://default:password@host:port
   WORKER_URL=https://profrater-worker.onrender.com
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

## Features

- 🔍 **Smart Search** - Search professors by name and university
- 🤖 **AI Analysis** - Get AI-powered insights from reviews
- ⏱️ **Real-time Updates** - Live polling shows scraping progress
- 📊 **Rich Stats** - Overall rating, difficulty, would take again %
- 💬 **Full Reviews** - Expandable list of all reviews with tags
- 🎨 **Beautiful UI** - Dark theme with glassmorphism effects
- 📱 **Responsive** - Works on all devices

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Database**: Redis (ioredis)
- **Markdown**: react-markdown

## How It Works

1. User enters professor name and university
2. Frontend creates job in Redis with status "queued"
3. Frontend triggers worker via POST /run-job
4. Frontend polls `/api/check-job` every 1.5 seconds
5. Worker scrapes RateMyProfessor (1-5 minutes)
6. Worker updates job status: queued → running → complete
7. Frontend displays results when status = "complete"

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

Compatible with any platform that supports Next.js:
- Netlify
- Railway
- Render
- AWS Amplify

## Project Structure

```
profrater-next/
├── app/
│   ├── api/
│   │   ├── start-scrape/
│   │   │   └── route.ts      # Create job and trigger worker
│   │   └── check-job/
│   │       └── route.ts      # Check job status
│   ├── page.tsx              # Main UI with search and results
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── lib/
│   ├── types.ts              # TypeScript interfaces
│   └── redis.ts              # Redis connection utility
├── .env.local                # Environment variables
└── package.json              # Dependencies
```

## Development

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start

# Lint
npm run lint
```

## License

MIT
