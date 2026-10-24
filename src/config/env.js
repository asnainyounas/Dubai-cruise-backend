const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env at project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Helper to exit with error message
function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

// Required variables
const MONGODB_URI = process.env.MONGODB_URI && process.env.MONGODB_URI.trim();
const CLIENT_URL = process.env.CLIENT_URL && process.env.CLIENT_URL.trim();

if (!MONGODB_URI) {
  exitWithError('Error: MONGODB_URI is required but not set or is empty.');
}

if (!CLIENT_URL) {
  exitWithError('Error: CLIENT_URL is required but not set or is empty.');
}

// JWT_SECRET is required and must be at least 32 characters
const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.trim();
if (!JWT_SECRET) {
  exitWithError('Error: JWT_SECRET is required but not set or is empty.');
}
if (JWT_SECRET.length < 32) {
  exitWithError(
    `Error: JWT_SECRET is too short (${JWT_SECRET.length} chars). ` +
    'It must be at least 32 characters long.'
  );
}

// Optional variables with defaults
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN && process.env.JWT_EXPIRES_IN.trim()) || '8h';

// Parse comma‑separated origins into an array
const clientOrigins = CLIENT_URL.split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const PORT = parseInt(process.env.PORT, 10) || 5000;
const NODE_ENV = process.env.NODE_ENV ? process.env.NODE_ENV.trim() : 'development';

module.exports = {
  MONGODB_URI,
  CLIENT_URL: clientOrigins,
  PORT,
  NODE_ENV,
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
