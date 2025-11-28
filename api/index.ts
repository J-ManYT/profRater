// Vercel serverless function entry point
import serverless from 'serverless-http';
import app from '../backend/src/server';

// Wrap Express app with serverless-http for proper serverless handling
// basePath strips '/api' from requests so Express routes match
export default serverless(app, {
  basePath: '/api'
});
