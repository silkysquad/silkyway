# Environment Configuration

## Quick Start (Local Development)

1. Copy the sample environment file:
   ```bash
   cp .env.sample .env.local
   ```

2. The `.env.local` file contains sensible defaults for local development:
   - Backend API: `http://localhost:3000`
   - Solana RPC: `https://api.devnet.solana.com`

3. Start the development server:
   ```bash
   yarn dev
   ```

## Production Deployment

### Required Environment Variables

Production builds **require** explicit configuration. Set these in your deployment platform (Vercel, Netlify, etc.):

```bash
# Backend API URL (REQUIRED in production)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Solana RPC endpoint (REQUIRED in production)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### Vercel Deployment

1. Add environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOLANA_RPC_URL`
   - Apply to Production, Preview, and Development environments as needed

2. Redeploy to apply changes

### Other Platforms

Add the environment variables according to your platform's documentation:
- **Netlify**: Site Settings → Environment Variables
- **Railway**: Project → Variables
- **Render**: Environment → Environment Variables

## Environment Variables Reference

| Variable | Description | Development Default | Production Example |
|----------|-------------|-------------------|-------------------|
| `NEXT_PUBLIC_API_URL` | Backend API endpoint | `http://localhost:3000` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` | `https://api.mainnet-beta.solana.com` |

## Troubleshooting

### "NEXT_PUBLIC_API_URL is required in production" error

This error occurs when deploying to production without setting the required environment variables. Make sure to:
1. Set `NEXT_PUBLIC_API_URL` in your deployment platform
2. Redeploy the application

### CORS errors when connecting to backend

Make sure the backend's `ALLOWED_ORIGINS` environment variable includes your frontend domain.
