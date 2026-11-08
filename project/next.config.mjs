import path from 'path';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js configuration
  // Note: Use port 3001 (via npm scripts) to avoid conflict with SpacetimeDB on port 3000
  outputFileTracingRoot: __dirname,
};

// Keep dev hot-reload files separate from production build output.
export default (phase) => ({
  ...nextConfig,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});
