# Optional Operators + SOL Funding Design

**Date:** 2026-02-11
**Status:** Approved

## Overview

Redesign account creation and management to:
1. Make operators optional during account creation
2. Reframe messaging to emphasize automation (agents) as primary value, yield as secondary
3. Add SOL funding for operators during setup and from account page
4. Display operator SOL balances on account page

## Core Value Proposition

**Primary:** Operators (AI agents, services) enable payment automation—subscriptions, recurring payments, agent operations
**Secondary:** Deposits earn yield via Drift Protocol integration

## Account Setup Flow Redesign

### Step 1: Explainer Screen (new)

**When:** User visits `/account/setup` without `?agent=` parameter

**Hero message:** "A bank account for the onchain era."

**Subtext:** "Let AI agents handle payments on your behalf—subscriptions, transfers, anything. You set the limits. Your deposits earn yield while they work."

**Two-column info layout:**

**Left column - "Agents on Autopilot"**
- Authorize AI agents or third-party services to spend from your account
- Perfect for subscriptions, recurring payments, automated operations
- You set spending limits per transaction
- Pause or revoke access anytime—you're always in control

**Right column - "Earn While You Automate"**
- Your USDC deposits automatically earn yield via Drift Protocol
- No lock-ups, withdraw anytime
- Your money works even when you're not

**Buttons:**
- **"Create Account"** (primary) → proceeds without operator
- **"I have an agent address"** (secondary) → shows agent pubkey input, then proceeds with operator

### Step 2: Connect Wallet

- Standard wallet connection if not already connected
- Auto-advances when wallet connects

### Step 3: Configure

**If agent provided in Step 1:**
- Show owner (connected wallet)
- Show agent pubkey
- Per-transaction limit input (default: $5)
- **NEW: "Fund Your Agent (Optional)" section:**
  - Label: "Your agent needs SOL for transaction fees"
  - Input: SOL amount (default: 0.1, placeholder: "0.0")
  - Help text: "~0.1 SOL covers 1000+ transactions"
- "Create Account" button

**If NO agent provided:**
- Skip configuration entirely
- Show "Creating your account..." → creates account without operator
- Proceed to Fund Account

### Step 4: Fund Account

- Existing USDC deposit flow
- If SOL funding requested in Step 3, execute SOL transfer to agent after account creation, before USDC deposit

### Step 5: Done

**If agent was added:**
- Show account details
- Show existing "Next steps" with CLI commands

**If NO agent:**
- Show account details
- Message: "Your account is ready. Add an agent anytime from your account dashboard to enable automated payments."

## Account Page - Operators Tab Redesign

### When NO operators exist:

- Message: "No agents authorized yet."
- Info card:
  - "Agents can make payments on your behalf with spending limits you control."
  - "Perfect for subscriptions, automated transfers, and AI agent operations."
- CTA button: "Add Agent"

### When operators exist:

**Operator row format (compact inline):**

```
[Solscan link: Oper8...xyz] | $5.00/tx | ◎0.05 SOL | [Fund] [Remove]
```

**"Fund" button behavior:**
- Opens inline form below that operator row
- Form contains:
  - Input: "SOL amount" (default: 0.1)
  - Buttons: "Send SOL" and "Cancel"
- After sending, shows toast, refreshes SOL balance

**"Add Operator" section:**
- Unchanged from current design
- Operator pubkey input
- Per-tx limit input
- "Add Operator" button

## Technical Implementation

### SOL Balance Fetching

- On account page load and after each operator action, fetch SOL balances for all operator pubkeys
- Use `connection.getBalance()` for each operator
- Display in SOL (lamports ÷ 1e9)
- Show loading state while fetching

### SOL Transfer Implementation

- Standard SOL transfer from connected wallet to operator pubkey
- During setup: execute after account creation, before USDC deposit
- On account page: standard transfer with wallet signature
- Use existing `signAndSubmit` pattern from account actions

### Backend Changes

- None required—SOL transfers are pure client-side
- Account creation API already supports optional operator

### Frontend State Updates

- After SOL transfer, refresh operator SOL balances
- Toast notifications for success/failure

### Edge Cases

- If wallet has insufficient SOL for transfer, show error before attempting
- SOL funding is always optional (can enter 0 or leave blank)
- If SOL transfer fails during setup, don't block account creation—show warning toast but continue
