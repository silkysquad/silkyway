import { createHttpClient } from '@silkyway/sdk/dist/client.js';

// In production, require explicit API URL configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_API_URL environment variable is required in production. ' +
      'Please set it in your deployment configuration.'
    );
  }
  // Development fallback
  return 'http://localhost:3000';
})();

export const api = createHttpClient({ baseUrl: API_URL });
