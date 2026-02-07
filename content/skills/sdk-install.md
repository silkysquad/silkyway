---
name: loki-sdk-install
description: Install and configure the Loki SDK for agent payments
---

# SDK Installation

> Install the Loki SDK to interact with the escrow protocol.

<!-- last-updated: 2026-02-07 -->
<!-- relates-to: skills/payments.md, skills/faucet.md -->

## Install

```bash
npm install @rebelfi/loki-sdk
```

## Initialize

```typescript
import { LokiClient } from '@rebelfi/loki-sdk';

const loki = new LokiClient({
  network: 'devnet',  // or 'mainnet'
});

// Create a wallet
const wallet = loki.createWallet();
console.log(wallet.publicKey); // Your Solana address

// Fund it (testnet only)
await loki.requestFunds(wallet.publicKey);
```

## Next Steps

- [Send a payment](payments.md)
- [Check your transfers](queries.md)
