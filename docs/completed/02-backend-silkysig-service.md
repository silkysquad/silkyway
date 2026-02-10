# Chunk 1: Backend — Silkysig Client + Account API

## Context

The Silkysig smart contract is built and tested (`anchor/programs/silkysig/`). The backend has no integration with it yet. This chunk adds the Silkysig client and Account API endpoints to the NestJS backend, following the exact same patterns used by the Handshake integration. These endpoints become the foundation for both the SDK (Chunk 2) and the frontend setup page (Chunk 3).

**Program ID:** `8MDFar9moBycSXb6gdZgqkiSEGRBRkzxa7JPLddqYcKs`
**PDA seed:** `["account", owner_pubkey]`

---

## Task 1: Rebuild Silkysig and copy IDL

The program directory was renamed from `templar` to `silkysig` but the IDL hasn't been rebuilt.

1. Run `anchor build` from `/anchor` to regenerate the IDL as `anchor/target/idl/silkysig.json`
2. Copy `anchor/target/idl/silkysig.json` → `apps/backend/src/solana/silkysig-idl.json`
3. Also copy `anchor/target/types/silkysig.ts` if generated (for TypeScript types)

Verify: `silkysig-idl.json` exists in the backend solana directory and contains the 3 instructions (`create_account`, `deposit`, `transfer_from_account`).

---

## Task 2: Create `silkysig-client.ts`

**New file:** `apps/backend/src/solana/silkysig-client.ts`

Follow the `handshake-client.ts` pattern (same file, ~170 lines). Wraps the Anchor `Program` instance for Silkysig.

### Interface: `SilkAccountData`
Mirrors the on-chain `SilkAccount` struct:
```ts
interface SilkAccountData {
  version: number;
  bump: number;
  owner: PublicKey;
  mint: PublicKey;
  isPaused: boolean;
  operatorCount: number;
  operators: OperatorSlotData[];
}

interface OperatorSlotData {
  pubkey: PublicKey;
  perTxLimit: BN;
  dailyLimit: BN;
  dailySpent: BN;
  lastReset: BN;
}
```

### Methods:

**`findAccountPda(owner: PublicKey): [PublicKey, number]`**
- Seeds: `[Buffer.from("account"), owner.toBuffer()]`

**`fetchAccount(pda: PublicKey): Promise<SilkAccountData | null>`**
- Calls `this.program.account.silkAccount.fetch(pda)`
- Returns null on AccountNotFound

**`findAccountsByOperator(operatorPubkey: PublicKey): Promise<Array<{ pda: PublicKey; account: SilkAccountData; balance: number; mintDecimals: number }>>`**
- Uses `this.connection.getProgramAccounts(programId, { filters: [...] })`
- Does 3 `getProgramAccounts` calls (one per operator slot offset), deduplicates by PDA
- Returns **all** matching accounts (an operator wallet could be on multiple accounts)
- For each match, fetches the token balance from the account's ATA and reads the mint decimals
- Operator pubkey offsets in account data:
  - Discriminator: 8 bytes
  - version: 1, bump: 1, owner: 32, mint: 32, is_paused: 1, operator_count: 1 = **76 bytes before operators array**
  - Slot 0 pubkey: offset 76
  - Slot 1 pubkey: offset 76 + 64 = 140
  - Slot 2 pubkey: offset 76 + 128 = 204
- Runs all 3 offset queries, collects results, deduplicates by PDA string

**`buildCreateAccountTx(owner, mint, operator?, perTxLimit?): Promise<{ transaction: string }>`**
- Builds `create_account` instruction via Anchor
- Derives PDA, derives ATA for account
- Sets `recentBlockhash`, `feePayer = owner`
- Returns base64-encoded unsigned `Transaction`
- Does NOT sign (human/agent signs client-side)

**`buildDepositTx(depositor, accountPda, amount): Promise<{ transaction: string }>`**
- Fetches account to get owner + mint
- Builds `deposit` instruction
- Returns base64-encoded unsigned `Transaction`

**`buildTransferFromAccountTx(signer, accountPda, recipient, amount): Promise<{ transaction: string }>`**
- Fetches account to get owner + mint
- Builds `transfer_from_account` instruction
- Returns base64-encoded unsigned `Transaction`

**Reference pattern:** Follow how `handshake-client.ts` builds TXs — derive PDAs, construct accounts object, call `program.methods.xxx().accounts({...}).transaction()`, serialize to base64.

---

## Task 3: Initialize Silkysig in `SolanaService`

**Modify:** `apps/backend/src/solana/solana.service.ts`

In `onModuleInit()`, after Handshake initialization, add:

```ts
import { SilkysigClient } from './silkysig-client';
import * as silkysigIdl from './silkysig-idl.json';

// In onModuleInit:
const silkysigProgramId = this.configService.get<string>(
  'SILKYSIG_PROGRAM_ID',
  '8MDFar9moBycSXb6gdZgqkiSEGRBRkzxa7JPLddqYcKs',
);
const silkysigProgram = new Program(silkysigIdl as any, provider);
this.silkysigClient = new SilkysigClient(silkysigProgram);
this.logger.log(`Silkysig program ${silkysigProgramId}`);
```

Add:
- Private field: `private silkysigClient: SilkysigClient`
- Public accessor: `getSilkysigClient(): SilkysigClient`

---

## Task 4: Create `AccountService`

**New file:** `apps/backend/src/api/service/account.service.ts`

Thin service layer that calls `SilkysigClient` methods. This keeps the controller clean.

### Methods:

**`getAccountsByOperator(operatorPubkey: string)`**
- Calls `silkysigClient.findAccountsByOperator(new PublicKey(operatorPubkey))`
- Returns the full array of matches (each with pda, account data, balance, mintDecimals)
- Returns empty array if none found

**`getAccount(pda: string)`**
- Calls `silkysigClient.fetchAccount(new PublicKey(pda))`
- Fetches token balance from ATA
- Returns combined state

**`buildCreateAccountTx(params: { owner, mint, operator?, perTxLimit? })`**
- Validates pubkeys
- Calls `silkysigClient.buildCreateAccountTx(...)`
- Returns `{ transaction: base64string, accountPda: string }`

**`buildDepositTx(params: { depositor, accountPda, amount })`**
- Calls `silkysigClient.buildDepositTx(...)`
- Returns `{ transaction: base64string }`

**`buildTransferFromAccountTx(params: { signer, accountPda, recipient, amount })`**
- Calls `silkysigClient.buildTransferFromAccountTx(...)`
- Returns `{ transaction: base64string }`

---

## Task 5: Create `AccountController`

**New file:** `apps/backend/src/api/controller/account.controller.ts`

Follow the `TxController` pattern — validation + delegation to service.

### Endpoints:

**`GET /api/account/by-operator/:pubkey`**
- Validates pubkey format
- Calls `accountService.getAccountsByOperator(pubkey)`
- Returns `{ ok: true, data: { accounts: [...] } }` — always an array (empty if none found)
- Each account in the array:
  ```json
  {
    "pda": "9aE5kBqR...",
    "owner": "7xKXz...",
    "mint": "EPjFWdd5...",
    "mintDecimals": 6,
    "isPaused": false,
    "balance": 5000000,
    "operatorSlot": {
      "index": 0,
      "perTxLimit": 5000000,
      "dailyLimit": 0
    }
  }
  ```
- `operatorSlot` contains only the slot matching the queried operator pubkey

**`GET /api/account/:pda`**
- Validates PDA format
- Calls `accountService.getAccount(pda)`
- Returns `{ ok: true, data: { ... } }` or 404

**`POST /api/account/create`**
- Body: `{ owner: string, mint: string, operator?: string, perTxLimit?: number }`
- Validates pubkeys, perTxLimit >= 0
- Calls `accountService.buildCreateAccountTx(body)`
- Returns `{ ok: true, data: { transaction, accountPda } }`

**`POST /api/account/deposit`**
- Body: `{ depositor: string, accountPda: string, amount: number }`
- Validates pubkeys, amount > 0
- Calls `accountService.buildDepositTx(body)`
- Returns `{ ok: true, data: { transaction } }`

**`POST /api/account/transfer`**
- Body: `{ signer: string, accountPda: string, recipient: string, amount: number }`
- Validates pubkeys, amount > 0
- Calls `accountService.buildTransferFromAccountTx(body)`
- Returns `{ ok: true, data: { transaction } }`

TX submission uses the existing `POST /api/tx/submit` endpoint — no changes needed there.

---

## Task 6: Register in modules

**Modify:** `apps/backend/src/api/api.module.ts`

Add imports and register:
```ts
import { AccountController } from './controller/account.controller';
import { AccountService } from './service/account.service';

// In @Module:
controllers: [...existing, AccountController],
providers: [...existing, AccountService],
```

No changes to `solana.module.ts` — `SolanaService` is already global and exported.

---

## Verification

1. `cd apps/backend && npm run build` — compiles without errors
2. `npm run start:dev` — server starts, logs show both Handshake and Silkysig program initialized
3. Test with curl:
   - `POST /api/account/create` with valid params → returns base64 transaction
   - `GET /api/account/by-operator/:pubkey` → returns `{ accounts: [] }` (no accounts yet, but endpoint works)
   - Existing Handshake endpoints still work (no regressions)

---

## Files Summary

| Action | File |
|--------|------|
| New | `apps/backend/src/solana/silkysig-idl.json` |
| New | `apps/backend/src/solana/silkysig-client.ts` |
| New | `apps/backend/src/api/service/account.service.ts` |
| New | `apps/backend/src/api/controller/account.controller.ts` |
| Modify | `apps/backend/src/solana/solana.service.ts` |
| Modify | `apps/backend/src/api/api.module.ts` |
