# Basic Escrow Flow

> Complete example: create, claim, and cancel an escrow payment.

<!-- last-updated: 2026-02-07 -->
<!-- relates-to: skills/payments.md, docs/instructions.md -->

## Setup

```typescript
import { LokiClient } from '@rebelfi/loki-sdk';

const loki = new LokiClient({ network: 'devnet' });
const sender = loki.createWallet();
const recipient = loki.createWallet();

// Fund sender
await loki.requestFunds(sender.publicKey);
```

## Create Transfer

```typescript
const { txid, transferPda } = await loki.sendPayment({
  recipient: recipient.publicKey,
  amount: 10.00,
  memo: 'Test payment',
  claimableAfter: Math.floor(Date.now() / 1000) + 60, // 1 minute
});

console.log('Transfer created:', transferPda);
```

## Check Status

```typescript
const transfer = await loki.getTransfer(transferPda);
console.log('Status:', transfer.status); // "ACTIVE"
```

## Claim (as recipient, after time lock)

```typescript
await loki.claimPayment(transferPda);
```

## Cancel (as sender, before claim)

```typescript
await loki.cancelPayment(transferPda);
```
