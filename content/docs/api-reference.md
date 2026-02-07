# API Reference

> REST endpoints for transaction building and queries.

<!-- last-updated: 2026-02-07 -->
<!-- relates-to: skills/payments.md, skills/queries.md -->

## Transaction Building

### POST /api/tx/create-transfer

Build an unsigned create_transfer transaction.

```json
{
  "sender": "<pubkey>",
  "recipient": "<pubkey>",
  "amount": 10.00,
  "mint": "<token-mint>",
  "memo": "Payment for service",
  "claimableAfter": 1738900000
}
```

### POST /api/tx/claim-transfer

Build an unsigned claim_transfer transaction.

```json
{
  "transferPda": "<pda>",
  "claimer": "<pubkey>"
}
```

### POST /api/tx/cancel-transfer

Build an unsigned cancel_transfer transaction.

```json
{
  "transferPda": "<pda>",
  "canceller": "<pubkey>"
}
```

### POST /api/tx/submit

Submit a signed transaction to Solana.

```json
{
  "signedTx": "<base64-encoded-signed-transaction>"
}
```

## Queries

### GET /api/transfers/:pda

Get details for a single transfer.

### GET /api/transfers?wallet=\<pubkey\>

List all transfers where the wallet is sender or recipient.

## Faucet

### POST /api/faucet

Airdrop testnet SOL and USDC.

```json
{
  "wallet": "<pubkey>"
}
```

## Response Format

All responses follow:

```json
{
  "ok": true,
  "data": { ... }
}
```

Errors:

```json
{
  "ok": false,
  "error": "ERROR_CODE",
  "message": "Description"
}
```
