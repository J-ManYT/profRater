// Vercel serverless function entry point
import serverless from 'serverless-http';
import app from '../backend/src/server';
// Force inclusion of pino-pretty in bundle
import 'pino-pretty';

// Wrap Express app with serverless-http for proper serverless handling
export default serverless(app);
