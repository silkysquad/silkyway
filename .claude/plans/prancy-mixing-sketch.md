# Remove operator from `create_account`, make `add_operator` limit optional

## Context

Two changes to simplify the silkysig instruction set:

1. **`create_account`** currently bundles optional operator setup. Remove it — `create_account` should only create accounts. `add_operator` handles operators.
2. **`add_operator`** currently requires `per_tx_limit: u64` with a `> 0` check. Make it `Option<u64>` — when omitted, defaults to `u64::MAX` (no limit).

The backend composes both instructions into a single transaction when an operator is provided at account setup, so UX stays the same (one wallet approval).

## Changes

### 1. `anchor/programs/silkysig/src/instructions/create_account.rs`
- Remove `operator` and `per_tx_limit` params from function signature
- Remove the conditional operator init block (lines 27-36)
- Remove `operator`/`per_tx_limit` from `AccountCreated` event and `emit!`

### 2. `anchor/programs/silkysig/src/instructions/add_operator.rs`
- Change `per_tx_limit: u64` → `per_tx_limit: Option<u64>`
- Remove `require!(per_tx_limit > 0, ...)` check
- Use `let limit = per_tx_limit.unwrap_or(u64::MAX);` and store `limit`
- Update `OperatorAdded` event to emit the resolved limit value

### 3. `anchor/programs/silkysig/src/lib.rs`
- `create_account`: remove both params from entry point
- `add_operator`: change `per_tx_limit: u64` → `per_tx_limit: Option<u64>`

### 4. `anchor build`
- Regenerates IDL

### 5. `apps/backend/src/solana/silkysig-client.ts`

**`buildCreateAccountTx`** — keep optional `operator?`/`perTxLimit?` params:
- Always build `createAccount()` instruction (no args)
- When `operator` is provided, also build `addOperator(operator, perTxLimit ?? null)` instruction
- Add both instructions to the same transaction

**`buildAddOperatorTx`** — make `perTxLimit` optional:
- `perTxLimit: BN` → `perTxLimit?: BN`
- Pass `perTxLimit ?? null` to the program method

### 6. `apps/backend/src/api/controller/account.controller.ts`
- `addOperator` endpoint: make `perTxLimit` optional in body type, remove/relax validation

### 7. `apps/app/src/_jotai/account/account.actions.ts`
- `addOperator`: make `perTxLimit` optional in params type

### 8. Frontend setup page — no changes needed
- API contract unchanged, continues to pass operator + perTxLimit

### 9. Tests: `anchor/tests/silkysig.ts`
- A1: `.createAccount(operator.publicKey, PER_TX_LIMIT)` → `.createAccount()` + `.addOperator(operator.publicKey, PER_TX_LIMIT)`
- A2: `.createAccount(null, null)` → `.createAccount()`
- A3: `.createAccount(null, null)` → `.createAccount()`
- C7: `.createAccount(unlimitedOperator.publicKey, null)` → `.createAccount()` + `.addOperator(unlimitedOperator.publicKey, null)` (tests the optional limit = unlimited path)
- F1, F2, F3: `.createAccount(null, null)` → `.createAccount()`

### 10. Tests: `anchor/tests/silkysig-yield.ts`
- Y1: `.createAccount(null, null)` → `.createAccount()`

### 11. Copy IDL to `apps/backend/src/solana/silkysig-idl.json`

### 12. `CLAUDE.md` — remove "Optionally adds a first operator" from `create_account` description

## Verification
1. `anchor build` compiles
2. `anchor test` — all tests pass
3. Generated IDL shows `create_account` with empty args, `add_operator` with `per_tx_limit` as `Option<u64>`
