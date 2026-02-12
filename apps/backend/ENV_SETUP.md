# Environment Configuration

## Quick Start (Local Development)

1. Copy the sample environment file:
   ```bash
   cp .env.sample .env
   ```

2. Configure your local database credentials in `.env`:
   ```bash
   DATABASE_USER=your_postgres_user
   DATABASE_PASSWORD=your_postgres_password
   ```

3. Start the development server:
   ```bash
   yarn start:dev
   ```

## Production Deployment

### Required Environment Variables

Production deployments require explicit configuration:

```bash
# Server
PORT=3000
NODE_ENV=production

# CORS - Comma-separated list of allowed frontend origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database
DATABASE_HOST=your-db-host
DATABASE_PORT=5432
DATABASE_NAME=handshake
DATABASE_USER=your_db_user
DATABASE_PASSWORD=your_db_password

# Solana
RPC_URL=https://api.mainnet-beta.solana.com
HANDSHAKE_PROGRAM_ID=HANDu9uNdnraNbcueGfXhd3UPu6BXfQroKAsSxFhPXEQ
SILKYSIG_PROGRAM_ID=SiLKos3MCFggwLsjSeuRiCdcs2MLoJNwq59XwTvEwcS

# System wallet
SYSTEM_SIGNER_PRIVATE_KEY=/path/to/keypair.json

# USDC config
USDC_MINT_ADDRESS=your_mint_address
HANDSHAKE_POOL_NAME=usdc-mainnet
```

## Environment Variables Reference

| Variable | Required | Description | Development Default | Production Example |
|----------|----------|-------------|-------------------|-------------------|
| `PORT` | No | Server port | `3000` | `3000` |
| `NODE_ENV` | Yes | Environment | `development` | `production` |
| `ALLOWED_ORIGINS` | Production only | CORS allowed origins (comma-separated) | Empty (allows all) | `https://app.example.com` |
| `DATABASE_HOST` | Yes | PostgreSQL host | `localhost` | `db.example.com` |
| `DATABASE_PORT` | No | PostgreSQL port | `5432` | `5432` |
| `DATABASE_NAME` | Yes | Database name | `handshake` | `handshake` |
| `DATABASE_USER` | Yes | Database user | - | - |
| `DATABASE_PASSWORD` | Yes | Database password | - | - |
| `RPC_URL` | Yes | Solana RPC endpoint | `https://api.devnet.solana.com` | `https://api.mainnet-beta.solana.com` |
| `HANDSHAKE_PROGRAM_ID` | Yes | Handshake program address | `HZ8p...gmfg` | `HZ8p...gmfg` |
| `SYSTEM_SIGNER_PRIVATE_KEY` | No | Path to system wallet keypair | `~/.config/solana/id.json` | `/secrets/keypair.json` |
| `USDC_MINT_ADDRESS` | Yes | USDC mint address | Set by setup script | - |
| `HANDSHAKE_POOL_NAME` | Yes | Pool name | `usdc-devnet` | `usdc-mainnet` |

## Security Best Practices

1. **Never commit `.env` files to version control**
   - Only `.env.sample` should be committed
   - `.env` is ignored by git

2. **Use environment-specific configurations**
   - Development: Allow all CORS origins (empty `ALLOWED_ORIGINS`)
   - Production: Explicitly list allowed frontend domains

3. **Secure your database credentials**
   - Use strong passwords
   - Rotate credentials regularly
   - Use connection pooling and SSL in production

4. **Protect your Solana keypair**
   - Store `SYSTEM_SIGNER_PRIVATE_KEY` securely
   - Never commit keypairs to version control
   - Use secrets management in production (AWS Secrets Manager, etc.)
