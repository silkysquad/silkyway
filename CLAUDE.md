# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing:
1. **Handshake** — A Solana program built with Anchor (v0.32.1), located in `/anchor`
2. **Backend** — A NestJS agent-native website, located in `/apps/backend`
3. **SDK** — `@silkyway/sdk` — TypeScript SDK + CLI for agent payments on Solana, located in `/packages/sdk`

## Solana Program (`/anchor`)

**Program ID:** `HZ8paEkYZ2hKBwHoVk23doSLEad9K5duASRTGaYogmfg`

### Commands (run from `/anchor`)

```bash
cd anchor
anchor build          # Build the Solana program
anchor test           # Run all tests (requires local validator)
yarn run ts-mocha -p ./tsconfig.json -t 1000000 "tests/handshake.ts"  # Single test file
```

### Architecture

- **`anchor/programs/handshake/src/lib.rs`** — On-chain program. All instruction handlers and account structs.
- **`anchor/tests/`** — TypeScript integration tests (ts-mocha + chai).
- **`anchor/Anchor.toml`** — Anchor workspace config. Cluster is `localnet`; package manager is `yarn`.

### Toolchain

- Rust `1.89.0` (pinned in `anchor/rust-toolchain.toml`)
- Anchor CLI `0.32.1`
- **Agave (Solana) CLI v3.0.x stable** — Install with:
  ```
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
  ```
  Then: `export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"`

### Build Notes

- If `Cargo.lock` has `version = 4` and fails with "lock file version 4 requires `-Znext-lockfile-bump`", delete it and let `anchor build` regenerate.
- If crate version errors mention rustc mismatch, upgrade Agave CLI to stable.

## Silkyway SDK (`/packages/sdk`)

**Package:** `@silkyway/sdk` v0.1.0 — Agent payments on Solana via the Silkyway protocol.

Provides both a **TypeScript client library** and a **CLI** (`silk`).

### Commands (run from `/packages/sdk`)

```bash
cd packages/sdk
npm run build         # Compile TypeScript
npm run dev           # Watch mode
npm run clean         # Remove dist/
```

### Architecture

- **`packages/sdk/src/client.ts`** — HTTP client that talks to the Silkyway backend API.
- **`packages/sdk/src/cli.ts`** — CLI entry point (Commander-based, exposed as `silk` bin).
- **`packages/sdk/src/commands/`** — CLI subcommands: `wallet`, `balance`, `pay`, `claim`, `cancel`, `payments`.
- **`packages/sdk/src/config.ts`** — Wallet/config management (`~/.config/silk/config.json`).
- **`packages/sdk/SKILL.md`** — Agent-facing skill file shipped with the package (included in `files`).

### Toolchain

- Node.js 18+
- TypeScript 5.7, targeting ES2022 with `NodeNext` module resolution
- Dependencies: `@solana/web3.js`, `axios`, `bs58`, `commander`

## Backend (`/apps/backend`)

NestJS agent-native website for agents to interact with the Silkyway protocol.

### Commands (run from `/apps/backend`)

```bash
cd apps/backend
npm install            # Install dependencies
npm run build          # Build (nest build --builder swc)
npm run start:dev      # Dev mode with watch
npm run start:prod     # Production mode (node dist/main)
```

### Architecture

- **`apps/backend/src/main.ts`** — NestJS entry point.
- **`apps/backend/src/app.module.ts`** — Root module.
- **`apps/backend/src/api/`** — Controllers and services for REST API.
- **`apps/backend/src/db/`** — MikroORM config and entity models.
- **`apps/backend/src/solana/`** — Solana/Handshake client integration.
- **`apps/backend/src/content/`** — Content rendering (landing page, docs).
- **`apps/backend/migrations/`** — MikroORM database migrations.
- **`apps/backend/content/`** — Markdown content files served by the site.

### Toolchain

- Node.js 18+, TypeScript 5.7
- NestJS 11, MikroORM (PostgreSQL), SWC builder
- Dependencies: `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`
