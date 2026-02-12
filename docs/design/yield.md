# Yield Integration for Silk Accounts — Design

## Context

Silk accounts (Silkysig) hold SPL tokens in associated token accounts where they sit idle. We want these tokens to earn yield via Drift spot markets — the same mechanism Hermes uses for its payment pools. But since each Silk account is isolated (one owner, one balance), the design is dramatically simpler: no shares, no proportional distribution, no yield splitting.

---

## How It Works Today (Silkysig)

```
[Depositor] --deposit--> [Silk ATA] --transfer_from_account--> [Recipient]
                              ^
                       PDA: [b"account", owner]
                       Holds SPL tokens directly
```

- `deposit`: anyone can send tokens into the Silk account's ATA
- `transfer_from_account`: owner (unrestricted) or operator (per-tx limit enforced) sends tokens out
- Tokens sit idle in the ATA earning nothing

## How It Works With Drift Yield

```
[Depositor] --deposit--> [Silk ATA] --CPI--> [Drift Spot Market Vault]
                              ^                        |
                       PDA authority             yield accrues
                              |                        |
[Recipient] <--transfer-- [Silk ATA] <--CPI-- [Drift withdraws back]
```

- `deposit`: tokens arrive in Silk ATA, then immediately get deposited into Drift via CPI
- `transfer_from_account`: withdraw from Drift into Silk ATA, then transfer to recipient
- Yield accrues inside Drift's spot market. Yield = drift position - principal (computed off-chain)

---

## What Makes This Simpler Than Hermes

| Hermes (pools) | Silkysig (accounts) |
|---|---|
| Multiple depositors share a pool | One owner per account |
| Shares mechanism for proportional accounting | No shares needed — 100% belongs to owner |
| Yield split between sender/recipient/pool operator | Owner gets all yield |
| Pool operator yield cut (basis points) | No operator cut |
| Share price calculations with precision constants | No share price math at all |
| `update_pool_value` required for share price accuracy | No on-chain value tracking needed — Drift is source of truth |

The core simplification: **one account = one owner = one Drift position = owner gets everything**.

### Why No `update_value` / `total_value`

In Hermes, `update_pool_value` is critical because `total_value` feeds directly into `calculate_share_price()`, which runs on every deposit/withdrawal to determine proportional share issuance/redemption. Without fresh value, share prices are wrong and users get unfairly diluted or overpaid.

In Silkysig, the program never needs to know the current Drift balance to make any decision:
- **Deposit:** we know the exact amount → CPI deposit into Drift → done
- **Transfer:** we know the exact amount → CPI withdraw from Drift → transfer to recipient → done
- **Close:** withdraw everything from Drift → sweep to owner → done

If a withdrawal exceeds what Drift holds, the CPI itself fails. No on-chain balance check needed. Yield is computed off-chain by querying the Drift position and subtracting `principal_balance`.

---

## State Changes

### SilkAccount — New Fields

```rust
// Drift integration (optional per account)
pub drift_user: Option<Pubkey>,       // Drift user account for this silk account
pub drift_market_index: Option<u16>,  // Drift spot market index (e.g., 0 = USDC)

// Bookkeeping
pub principal_balance: u64,           // Running total: deposits in - transfers out
```

**`principal_balance` behavior:**
- `deposit(100)` → principal goes up by 100
- `transfer_from_account(50)` → principal goes down by min(50, principal_balance)
- Floored at 0 (if you transfer more than principal, you're spending yield — that's fine)
- Off-chain: `yield = drift_position_value - principal_balance`

**Why `Option` for Drift fields:** Yield is opt-in. Accounts created without Drift work exactly as they do today (tokens in ATA). A separate `init_drift_user` instruction activates yield.

### Account Size Impact

Current SilkAccount: 142 bytes. New fields add ~44 bytes:
- `drift_user`: 1 + 32 = 33 (Option<Pubkey>)
- `drift_market_index`: 1 + 2 = 3 (Option<u16>)
- `principal_balance`: 8
- **New total: ~186 bytes** (with alignment)

---

## New Instructions

### `init_drift_user` — Activate Yield for an Account

**Who:** Owner only
**What:** Initializes Drift user account with SilkAccount PDA as authority
**When:** After `create_account`, when owner wants yield

**Steps:**
1. Validate silk account exists, caller is owner, drift not already initialized
2. CPI: `drift::initialize_user_stats` (silk_account PDA signs)
3. CPI: `drift::initialize_user` (silk_account PDA signs)
4. Set `silk_account.drift_user = Some(drift_user_pubkey)`
5. Set `silk_account.drift_market_index = Some(market_index)`
6. If account ATA has existing balance, deposit it all into Drift
7. Set `principal_balance = existing_balance`

**Accounts (dedicated struct — not remaining accounts):**
- `silk_account` (mut) — the PDA
- `owner` (signer) — must be the owner
- `drift_user` (mut) — Drift user account (to be initialized)
- `drift_user_stats` (mut) — Drift user stats
- `drift_state` (mut) — Drift global state
- `account_token_account` (mut) — Silk account's ATA
- `drift_spot_market_vault` (mut) — Drift's vault for this market
- `drift_spot_market` — Market account
- `drift_oracle` — Price oracle
- `drift_program` — Drift program
- Standard programs (token, system, rent)

---

## Modified Instructions

### `deposit` — Now Routes to Drift

**Current:** Transfer tokens from depositor's ATA → Silk ATA
**New (yield-enabled):** Transfer tokens from depositor's ATA → Silk ATA → Drift via CPI

```
if silk_account.drift_user.is_some() {
    // 1. Transfer from depositor to silk ATA (same as before)
    // 2. CPI: deposit from silk ATA into Drift
    // 3. principal_balance += amount
} else {
    // Original behavior (no Drift)
}
```

**Additional accounts (via remaining accounts when yield-enabled):**
- `drift_user`, `drift_user_stats`, `drift_state`
- `drift_spot_market_vault`, `drift_spot_market`, `drift_oracle`
- `drift_program`

### `transfer_from_account` — Now Withdraws from Drift First

**Current:** Transfer from Silk ATA → recipient ATA
**New (yield-enabled):** Withdraw from Drift → Silk ATA, then transfer → recipient ATA

```
if silk_account.drift_user.is_some() {
    // 1. CPI: withdraw amount from Drift into silk ATA
    // 2. Transfer from silk ATA to recipient (same as before)
    // 3. principal_balance = principal_balance.saturating_sub(amount)
} else {
    // Original behavior (no Drift)
}
```

**Additional accounts (via remaining accounts), same as deposit plus:**
- `drift_signer` — Drift's program signer PDA (required for withdrawals)

**Note:** The existing `InsufficientBalance` check against ATA balance needs to be skipped for yield-enabled accounts — the balance is in Drift, not the ATA. The Drift CPI will fail naturally if insufficient.

### `close_account` — Must Fully Exit Drift

**Current:** Sweep ATA → owner, close ATA, close PDA
**New (yield-enabled):**

```
if silk_account.drift_user.is_some() {
    // 1. CPI: withdraw ALL from Drift into silk ATA
    // 2. Sweep ATA → owner (same as before)
    // 3. Close ATA
    // 4. Close PDA
}
```

---

## Decisions Made

1. **Remaining accounts for Drift in deposit/transfer/close** — non-yield calls don't pass Drift accounts at all. `init_drift_user` gets a dedicated struct since it's always a Drift operation.

2. **No `update_value` / `total_value` / staleness checks** — the program never needs to know the Drift balance. All decisions are amount-based. Yield is computed off-chain.

3. **Drift CPI crate** — copy from hermes, rebuild against anchor 0.32.1. Same IDL, different anchor version.

4. **No account migration needed** — no production accounts exist. Just add the new fields with defaults to the struct.

5. **Operator per-tx limits unchanged** — limits apply to the transfer amount, not to principal vs yield. Correct behavior.

---

## Implementation Phases

### Phase 1: State + Drift Dependency
1. Copy drift CPI program from hermes, adapt for anchor 0.32.1
2. Add drift-cpi dependency to silkysig Cargo.toml
3. Add new fields to SilkAccount (with defaults)
4. Increase account space allocation in `create_account`

### Phase 2: Init Drift User
5. Implement `init_drift_user` instruction
6. Test Drift user initialization
7. Handle bootstrap deposit of existing ATA balance

### Phase 3: Deposit with Drift
8. Modify `deposit` to CPI into Drift when yield-enabled
9. Update principal_balance tracking
10. Test deposits route to Drift

### Phase 4: Transfer with Drift
11. Modify `transfer_from_account` to withdraw from Drift first
12. Update principal tracking on withdrawals
13. Test operator transfers still respect limits
14. Test owner transfers work unrestricted

### Phase 5: Close Account with Drift
15. Modify `close_account` to exit Drift position
16. End-to-end testing

### Phase 6: SDK + Backend
17. Update SDK to pass Drift accounts when interacting with yield-enabled accounts
18. Update backend to track/display yield
19. Update CLI commands to show yield info

---

## Bookkeeping Example

```
1. Owner creates account                 → principal=0, drift_user=None
2. init_drift_user                       → drift_user=Some(...), principal=0
3. deposit(1000 USDC)                    → principal=1000
   (tokens: depositor → silk ATA → Drift)
4. Time passes, Drift earns yield...
   (off-chain query: drift position = 1050, yield = 50)
5. Operator transfers 200 to recipient   → principal=800
   (Drift withdraws 200 → silk ATA → recipient)
6. deposit(500)                          → principal=1300
   (off-chain query: drift position = 1370, yield = 70)
7. close_account                         → owner gets everything in Drift
   (Drift withdraws all → silk ATA → owner)
```
