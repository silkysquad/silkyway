# SilkyWay

Banking infrastructure for AI agents on Solana.

Agents don't need wallets — they need bank accounts. SilkyWay gives autonomous agents managed token accounts with spending controls, operator delegation, and yield generation, plus an escrow payment protocol for coordinated commerce between agents.

Two on-chain programs power the platform:

- **Silkysig** — Managed accounts where a human owner controls the funds and authorizes agents (operators) to spend within per-transaction limits. Accounts are yield-bearing through Drift integration. Third parties can be granted operator keys for recurring payments, subscriptions, or automated services.

- **Handshake** — Escrow-based payment protocol where every transfer is claimable, cancellable, and arbitrable. Time locks, operator arbitration, and configurable fees enable agents to transact safely without prior trust.

Together: Silkysig solves the guardrails problem (how do you let an agent spend money without giving it full control?), and Handshake solves the coordination problem (how do agents pay each other for work that takes time and requires trust?).

---

## The Problem

The agent economy is emerging, but the financial infrastructure assumes agents are just users with API keys.

**The guardrails problem.** When an agent needs to spend money, today's options are all-or-nothing: either the agent holds a private key with full control over funds, or a human approves every transaction manually. Neither scales. Businesses need to authorize agents to operate within limits — spend up to $X per transaction, only from this account, pausable at any time — the same controls a company applies to employee expense cards.

**The coordination problem.** When Agent A hires Agent B to perform a task, fire-and-forget payment doesn't work. The work takes time. It might not get done. It might not be done right. You need escrow — funds held until delivery, cancellable by the sender, claimable by the recipient, with deadlines and operator arbitration for disputes. This is how real commerce works. The agent economy won't be different.

**The yield problem.** Agents managing funds on behalf of users shouldn't leave capital idle. Treasuries sitting in token accounts earning nothing is a cost. Agent-managed accounts should generate yield by default, not as an afterthought.

Existing protocols solve the simplest case — agent pays for an API call, gets a response. SilkyWay solves what comes next.

---

## How It Works

### Managed Accounts (Silkysig)

A human owner creates a Silk account — a managed token account on Solana. The owner has full control and can authorize up to three operators (agents or third-party services) with per-transaction spending limits.

- **Owner** — full control, can deposit, withdraw, pause, add/remove operators
- **Operators** — can transfer tokens within their per-tx limit, can be paused or removed at any time
- **Yield** — accounts integrate with Drift protocol, so idle funds generate yield automatically

This is the banking primitive: a human opens an account, sets the rules, and lets agents operate within those rules. A subscription service gets an operator key to pull monthly payments. A trading agent gets a key with a $100/tx limit. The owner can freeze everything with one transaction.

### Escrow Payments (Handshake)

Every payment flows through pool-based escrow:

1. Sender deposits tokens into a pool — funds are locked
2. Recipient claims the payment (fee deducted) — or —
3. Sender cancels, recipient declines, operator rejects, or the transfer expires — full refund

Pools are created by operators who set fee rates and can arbitrate disputes. This enables marketplace models — a platform connecting agents to services monetizes through pool fees.

### Build-Sign-Submit

Private keys never leave the client. The backend builds unsigned transactions (resolving PDAs, accounts, blockhashes), the agent signs locally, and submits back. The on-chain programs enforce all authorization rules.

---

## What's in This Repo

SilkyWay is a monorepo containing the on-chain programs, backend API, and frontend app.

| Path | What it is |
|---|---|
| `anchor/programs/silkysig/` | Solana program — managed token accounts with operator delegation and spending limits |
| `anchor/programs/handshake/` | Solana program — escrow-based payment protocol with pool economics |
| `anchor/tests/` | Integration tests for both programs |
| `apps/backend/` | NestJS API — transaction building, submission, and PostgreSQL indexing |
| `apps/app/` | Next.js frontend |
| `scripts/` | Devnet setup and build scripts |

The SDK/CLI has moved to a standalone repository (see below).

---

## Part of a Broader Stack

SilkyWay is the commerce layer of an agent-native stack:

- **[OpenClaw](https://openclaw.ai)** — Agent discovery and tool consumption through skills and natural language
- **[Moltbook](https://moltbook.com)** — Agent-first social network where identity and reputation emerge from participation
- **[SilkyWay](https://silkyway.trade)** — Banking infrastructure and escrow payments for agent commerce

Discovery, identity, commerce — without requiring agents to implement any protocol specification.

---

## SilkyWay SDK (Agent CLI)

The SDK has moved to a dedicated repository for easier distribution and maintenance.

**Package:** [`@silkysquad/silk`](https://www.npmjs.com/package/@silkysquad/silk)
**Repository:** [github.com/silkysquad/silk](https://github.com/silkysquad/silk)
**Skill:** [clawhub.ai/skills/silkyway](https://clawhub.ai/skills/silkyway)

```bash
# Via npm
npm install -g @silkysquad/silk

# Or via ClawHub (for OpenClaw agents)
npm install -g clawhub
clawhub install silkyway
```

```bash
silk init
silk wallet create
silk balance
silk pay <recipient> <amount>
```

See the [silk repository](https://github.com/silkysquad/silk) for full documentation.

---

## Development Setup

This repository contains the Solana programs, backend API, and frontend app. The SDK/CLI lives in its own repository (see above).

### Prerequisites

- Node.js 18+
- PostgreSQL
- Solana CLI (Agave v3.0.x stable):
  ```bash
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
  ```

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.sample .env
```

Edit `.env` and fill in your database credentials:

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=handshake
DATABASE_USER=<your-user>
DATABASE_PASSWORD=<your-password>
```

### 3. Set up a Solana wallet

If you don't already have one, generate a keypair:

```bash
solana-keygen new
```

This creates `~/.config/solana/id.json`, which the setup script uses by default. To use a different keypair, set `SYSTEM_SIGNER_PRIVATE_KEY` in `.env` to the file path.

Configure the CLI for devnet or a locally running validator:

```bash
solana config set --url https://api.devnet.solana.com | http://localhost:8899/
```

### 4. Run the devnet setup script

This creates a fake USDC mint, airdrops SOL, and initializes the Handshake pool on devnet:

```bash
npx ts-node scripts/setup-devnet.ts
```

The script will print the values you need. Add them to your `.env`:

```
USDC_MINT_ADDRESS=<printed-mint-address>
HANDSHAKE_POOL_NAME=usdc-devnet
```

### 5. Start the server

```bash
npm run start:dev
```
