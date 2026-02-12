# Optional Operators + SOL Funding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable optional operators during account creation, add SOL funding for operators, and reframe messaging to emphasize automation.

**Architecture:** Frontend-only changes. Add explainer screen before setup flow, support operator-less account creation, implement SOL transfer/balance utilities, redesign operators tab with SOL funding.

**Tech Stack:** Next.js 15, React 19, TypeScript, @solana/web3.js, Jotai

---

## Task 1: Create Solana Connection Hook

**Files:**
- Create: `apps/app/src/hooks/useConnection.ts`

**Step 1: Write the hook**

Create a hook that provides access to the Solana connection using the cluster RPC URL.

```typescript
'use client';

import { useMemo } from 'react';
import { Connection } from '@solana/web3.js';
import { useCluster } from '@/contexts/ClusterContext';

export function useConnection() {
  const { rpcUrl } = useCluster();

  const connection = useMemo(() => {
    return new Connection(rpcUrl, 'confirmed');
  }, [rpcUrl]);

  return { connection };
}
```

**Step 2: Commit**

```bash
git add apps/app/src/hooks/useConnection.ts
git commit -m "feat: add useConnection hook for Solana RPC access

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add SOL Transfer Action

**Files:**
- Modify: `apps/app/src/_jotai/account/account.actions.ts:94`

**Step 1: Add import for SOL transfer utilities**

```typescript
import { useCallback } from 'react';
import { VersionedTransaction, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '@/lib/api';
import { useConnection } from '@/hooks/useConnection';
```

**Step 2: Add transferSol action in useAccountActions**

After the `closeAccount` function (before the return statement at line 83), add:

```typescript
  const { connection } = useConnection();

  const transferSol = useCallback(
    async (params: { from: string; to: string; amountSol: number }): Promise<string> => {
      if (!signTransaction) throw new Error('Wallet does not support signing');

      const fromPubkey = new PublicKey(params.from);
      const toPubkey = new PublicKey(params.to);
      const lamports = Math.floor(params.amountSol * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const signed = await signTransaction(transaction);
      const txid = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txid);

      return txid;
    },
    [signTransaction, connection],
  );
```

**Step 3: Export transferSol in return statement**

Update the return statement to include `transferSol`:

```typescript
  return {
    createAccount,
    depositToAccount,
    transferFromAccount,
    fetchAccount,
    signAndSubmit,
    togglePause,
    addOperator,
    removeOperator,
    closeAccount,
    transferSol,
  };
```

**Step 4: Commit**

```bash
git add apps/app/src/_jotai/account/account.actions.ts
git commit -m "feat: add SOL transfer action for funding operators

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create SOL Balance Utilities Hook

**Files:**
- Create: `apps/app/src/hooks/useSolBalance.ts`

**Step 1: Write the hook**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection } from './useConnection';

export function useSolBalance() {
  const { connection } = useConnection();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(
    async (pubkey: string): Promise<number> => {
      try {
        const balance = await connection.getBalance(new PublicKey(pubkey));
        const solBalance = balance / LAMPORTS_PER_SOL;
        setBalances((prev) => ({ ...prev, [pubkey]: solBalance }));
        return solBalance;
      } catch {
        return 0;
      }
    },
    [connection],
  );

  const fetchMultipleBalances = useCallback(
    async (pubkeys: string[]): Promise<Record<string, number>> => {
      setLoading(true);
      try {
        const results = await Promise.all(
          pubkeys.map(async (pubkey) => {
            const balance = await fetchBalance(pubkey);
            return [pubkey, balance] as const;
          }),
        );
        const balanceMap = Object.fromEntries(results);
        setBalances(balanceMap);
        return balanceMap;
      } finally {
        setLoading(false);
      }
    },
    [fetchBalance],
  );

  return { balances, loading, fetchBalance, fetchMultipleBalances };
}
```

**Step 2: Commit**

```bash
git add apps/app/src/hooks/useSolBalance.ts
git commit -m "feat: add useSolBalance hook for fetching operator SOL balances

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create Explainer Screen Component

**Files:**
- Create: `apps/app/src/components/AccountExplainer.tsx`

**Step 1: Write the component**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';

export function AccountExplainer() {
  const router = useRouter();
  const [showAgentInput, setShowAgentInput] = useState(false);
  const [agentPubkey, setAgentPubkey] = useState('');
  const [error, setError] = useState('');

  const handleCreateWithoutAgent = () => {
    router.push('/account/setup');
  };

  const handleContinueWithAgent = () => {
    setError('');
    try {
      new PublicKey(agentPubkey.trim());
      router.push(`/account/setup?agent=${agentPubkey.trim()}`);
    } catch {
      setError('Invalid Solana public key. Please check and try again.');
    }
  };

  if (showAgentInput) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-10">
        <div className="mb-8">
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-nebula-purple/60">
            Account Setup
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-star-white">
            Add Your Agent
          </h1>
        </div>

        <div
          className="gradient-border-top border border-nebula-purple/20 p-6"
          style={{ background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.04) 0%, rgba(12, 0, 21, 0.8) 100%)' }}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="agentPubkey" className="block text-[0.7rem] uppercase tracking-[0.15em] text-star-white/50">
                Agent public key
              </label>
              <input
                id="agentPubkey"
                type="text"
                value={agentPubkey}
                onChange={(e) => { setAgentPubkey(e.target.value); setError(''); }}
                placeholder="e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                className="w-full border border-nebula-purple/20 bg-deep-space/80 px-3 py-2.5 text-[0.8rem] text-star-white placeholder:text-star-white/15 transition-colors focus:border-solar-gold/30 focus:outline-none"
              />
              {error && (
                <p className="text-[0.75rem] text-red-400">{error}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAgentInput(false)}
                className="h-10 flex-1 border border-nebula-purple/20 bg-transparent text-[0.8rem] font-medium uppercase tracking-[0.15em] text-star-white/50 transition-all hover:border-nebula-purple/40 hover:text-star-white/70"
              >
                Back
              </button>
              <button
                onClick={handleContinueWithAgent}
                disabled={!agentPubkey.trim()}
                className="h-10 flex-1 border border-solar-gold/30 bg-solar-gold/10 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-solar-gold transition-all hover:border-solar-gold/50 hover:bg-solar-gold/18 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)] disabled:opacity-30 disabled:hover:shadow-none"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <div className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-wide text-star-white">
          A bank account for the onchain era.
        </h1>
        <p className="mt-4 text-[0.95rem] text-star-white/60">
          Let AI agents handle payments on your behalf—subscriptions, transfers, anything. You set the limits. Your deposits earn yield while they work.
        </p>
      </div>

      <div
        className="gradient-border-top border border-nebula-purple/20 p-6"
        style={{ background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.04) 0%, rgba(12, 0, 21, 0.8) 100%)' }}
      >
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left column */}
          <div className="space-y-3">
            <h2 className="text-[0.9rem] font-medium uppercase tracking-[0.15em] text-solar-gold">
              Agents on Autopilot
            </h2>
            <ul className="space-y-2 text-[0.8rem] text-star-white/60">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-solar-gold">•</span>
                <span>Authorize AI agents or third-party services to spend from your account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-solar-gold">•</span>
                <span>Perfect for subscriptions, recurring payments, automated operations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-solar-gold">•</span>
                <span>You set spending limits per transaction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-solar-gold">•</span>
                <span>Pause or revoke access anytime—you&apos;re always in control</span>
              </li>
            </ul>
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <h2 className="text-[0.9rem] font-medium uppercase tracking-[0.15em] text-nebula-purple">
              Earn While You Automate
            </h2>
            <ul className="space-y-2 text-[0.8rem] text-star-white/60">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-nebula-purple">•</span>
                <span>Your USDC deposits automatically earn yield via Drift Protocol</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-nebula-purple">•</span>
                <span>No lock-ups, withdraw anytime</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-nebula-purple">•</span>
                <span>Your money works even when you&apos;re not</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleCreateWithoutAgent}
            className="h-11 flex-1 border border-solar-gold/30 bg-solar-gold/10 text-[0.85rem] font-medium uppercase tracking-[0.15em] text-solar-gold transition-all hover:border-solar-gold/50 hover:bg-solar-gold/18 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]"
          >
            Create Account
          </button>
          <button
            onClick={() => setShowAgentInput(true)}
            className="h-11 flex-1 border border-nebula-purple/30 bg-nebula-purple/10 text-[0.85rem] font-medium uppercase tracking-[0.15em] text-nebula-purple transition-all hover:border-nebula-purple/50 hover:bg-nebula-purple/18"
          >
            I have an agent address
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/app/src/components/AccountExplainer.tsx
git commit -m "feat: add account explainer screen with optional agent flow

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Update Setup Flow - Optional Operator Support

**Files:**
- Modify: `apps/app/src/app/account/setup/page.tsx:30-458`

**Step 1: Remove AgentAddressPrompt component**

Delete lines 390-456 (the entire `AgentAddressPrompt` function).

**Step 2: Update imports and add AccountExplainer**

At the top of the file, add import:

```typescript
import { AccountExplainer } from '@/components/AccountExplainer';
```

**Step 3: Update AccountSetupContent logic for optional agent**

Replace lines 30-77 with:

```typescript
function AccountSetupContent() {
  const searchParams = useSearchParams();
  const agentParam = searchParams.get('agent');
  const { publicKey, isConnected } = useConnectedWallet();
  const { createAccount, depositToAccount, signAndSubmit, transferSol } = useAccountActions();
  const { requestFaucet } = useTransferActions();
  const { cluster } = useCluster();

  const [step, setStep] = useState<Step>('connect');
  const [perTxLimit, setPerTxLimit] = useState('5');
  const [solFundingAmount, setSolFundingAmount] = useState('0.1');
  const [depositAmount, setDepositAmount] = useState('5');
  const [accountPda, setAccountPda] = useState('');
  const [usdcMint, setUsdcMint] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isFundingSol, setIsFundingSol] = useState(false);
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [isFauceting, setIsFauceting] = useState(false);

  // Validate agent param if provided
  const agentValid = (() => {
    if (!agentParam) return true; // No agent is valid
    try {
      new PublicKey(agentParam);
      return true;
    } catch {
      return false;
    }
  })();

  // Fetch USDC mint from tokens endpoint
  useEffect(() => {
    api.get('/api/tokens').then((res) => {
      const tokens = res.data.data.tokens;
      const usdc = tokens.find((t: { symbol: string }) => t.symbol === 'USDC');
      if (usdc) setUsdcMint(usdc.mint);
    }).catch(() => {});
  }, []);

  // Auto-advance from connect to configure when wallet connects
  useEffect(() => {
    if (step === 'connect' && isConnected) {
      if (agentParam) {
        setStep('configure');
      } else {
        // No agent - skip configure and create account immediately
        handleCreateWithoutAgent();
      }
    }
  }, [step, isConnected, agentParam]);

  if (!agentValid) {
    return <AccountExplainer />;
  }
```

**Step 4: Add handleCreateWithoutAgent function**

After the useEffect hooks, add:

```typescript
  const walletAddress = publicKey?.toBase58() ?? '';
  const limitNum = parseFloat(perTxLimit) || 0;
  const depositNum = parseFloat(depositAmount) || 0;
  const solFundingNum = parseFloat(solFundingAmount) || 0;

  const handleCreateWithoutAgent = async () => {
    if (!walletAddress || !usdcMint) return;
    setIsCreating(true);
    try {
      const { transaction, accountPda: pda } = await createAccount({
        owner: walletAddress,
        mint: usdcMint,
      });
      toast.info('Please approve the transaction in your wallet...');
      const txid = await signAndSubmit(transaction);
      toast.success(
        <span>Account created! TX: <a href={solscanUrl(txid, 'tx')} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-solar-gold">{txid.slice(0, 8)}...</a></span>,
      );
      setAccountPda(pda);
      setStep('fund');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      toast.error(message);
      setStep('configure'); // Reset to configure on error
    } finally {
      setIsCreating(false);
    }
  };
```

**Step 5: Update handleCreate to support SOL funding**

Replace the existing `handleCreate` function (lines 83-106) with:

```typescript
  const handleCreate = async () => {
    if (!walletAddress || !usdcMint || !agentParam) return;
    setIsCreating(true);
    try {
      // 1. Create account
      const { transaction, accountPda: pda } = await createAccount({
        owner: walletAddress,
        mint: usdcMint,
        operator: agentParam,
        perTxLimit: limitNum * 1e6,
      });
      toast.info('Please approve the transaction in your wallet...');
      const txid = await signAndSubmit(transaction);
      toast.success(
        <span>Account created! TX: <a href={solscanUrl(txid, 'tx')} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-solar-gold">{txid.slice(0, 8)}...</a></span>,
      );
      setAccountPda(pda);

      // 2. Fund agent with SOL if requested
      if (solFundingNum > 0) {
        setIsFundingSol(true);
        try {
          const solTxid = await transferSol({
            from: walletAddress,
            to: agentParam,
            amountSol: solFundingNum,
          });
          toast.success(
            <span>Agent funded with ◎{solFundingNum} SOL! TX: <a href={solscanUrl(solTxid, 'tx')} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-solar-gold">{solTxid.slice(0, 8)}...</a></span>,
          );
        } catch (solErr: unknown) {
          const solErrMsg = solErr instanceof Error ? solErr.message : 'SOL transfer failed';
          toast.warn(`Account created but SOL funding failed: ${solErrMsg}`);
        } finally {
          setIsFundingSol(false);
        }
      }

      setStep('fund');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };
```

**Step 6: Update configure step UI to include SOL funding**

Replace the configure step section (lines 209-262) with:

```typescript
        {/* Step 2: Configure & Create */}
        {step === 'configure' && agentParam && (
          <div className="space-y-5">
            <h2 className="mb-5 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-solar-gold">
              Configure Policy
            </h2>

            <div className="space-y-1.5">
              <div className="text-[0.7rem] uppercase tracking-[0.15em] text-star-white/50">Owner</div>
              <div className="border border-nebula-purple/15 bg-deep-space/80 px-3 py-2.5">
                <p className="text-[0.75rem] text-star-white/50">{walletAddress}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[0.7rem] uppercase tracking-[0.15em] text-star-white/50">Operator (Agent)</div>
              <div className="border border-nebula-purple/15 bg-deep-space/80 px-3 py-2.5">
                <p className="text-[0.75rem] text-star-white/50">{agentParam}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="perTxLimit" className="block text-[0.7rem] uppercase tracking-[0.15em] text-star-white/50">
                Per-transaction limit
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-star-white/30">$</span>
                <input
                  id="perTxLimit"
                  type="number"
                  step="any"
                  min="0"
                  value={perTxLimit}
                  onChange={(e) => setPerTxLimit(e.target.value)}
                  className="w-full border border-nebula-purple/20 bg-deep-space/80 py-2.5 pl-7 pr-3 text-[0.8rem] text-star-white placeholder:text-star-white/15 transition-colors focus:border-solar-gold/30 focus:outline-none"
                />
              </div>
            </div>

            <div className="border-t border-nebula-purple/15 pt-4">
              <div className="mb-3">
                <label className="block text-[0.7rem] uppercase tracking-[0.15em] text-star-white/50">
                  Fund Your Agent (Optional)
                </label>
                <p className="mt-1 text-[0.7rem] text-star-white/30">
                  Your agent needs SOL for transaction fees
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-star-white/30">◎</span>
                  <input
                    id="solFunding"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.0"
                    value={solFundingAmount}
                    onChange={(e) => setSolFundingAmount(e.target.value)}
                    className="w-full border border-nebula-purple/20 bg-deep-space/80 py-2.5 pl-7 pr-3 text-[0.8rem] text-star-white placeholder:text-star-white/15 transition-colors focus:border-solar-gold/30 focus:outline-none"
                  />
                </div>
                <p className="text-[0.7rem] text-star-white/30">
                  ~0.1 SOL covers 1000+ transactions
                </p>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={isCreating || isFundingSol || !usdcMint || limitNum <= 0}
              className="h-10 w-full border border-solar-gold/30 bg-solar-gold/10 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-solar-gold transition-all hover:border-solar-gold/50 hover:bg-solar-gold/18 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)] disabled:opacity-30 disabled:hover:shadow-none"
            >
              {isCreating ? 'Creating...' : isFundingSol ? 'Funding Agent...' : 'Create Account'}
            </button>
          </div>
        )}
```

**Step 7: Update done step to handle no-agent case**

Replace the done step section (lines 334-384) with:

```typescript
        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="space-y-5">
            <h2 className="mb-5 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-solar-gold">
              Account Created & Funded
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-[0.8rem]">
                <span className="text-star-white/50">Account</span>
                <SolscanLink address={accountPda} type="account" />
              </div>
              <div className="flex justify-between text-[0.8rem]">
                <span className="text-star-white/50">Owner</span>
                <SolscanLink address={walletAddress} type="account" />
              </div>
              {agentParam && (
                <>
                  <div className="flex justify-between text-[0.8rem]">
                    <span className="text-star-white/50">Operator</span>
                    <SolscanLink address={agentParam} type="account" />
                  </div>
                  <div className="flex justify-between text-[0.8rem]">
                    <span className="text-star-white/50">Policy</span>
                    <span className="text-star-white/70">max ${limitNum.toFixed(2)} per transaction</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-[0.8rem]">
                <span className="text-star-white/50">Balance</span>
                <span className="text-star-white/70">${depositNum.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-[0.8rem]">
                <span className="text-star-white/50">Network</span>
                <span className="text-star-white/70">{cluster === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}</span>
              </div>
            </div>

            {agentParam ? (
              <div className="border-l-2 border-solar-gold bg-solar-gold/[0.04] p-4">
                <p className="mb-3 text-[0.85rem] font-medium text-solar-gold">Next steps — tell your agent:</p>
                <div className="space-y-2 font-mono text-[0.75rem] text-star-white/60">
                  <p>1. Run: <span className="text-star-white">silk account sync</span></p>
                  <p>2. Then try: <span className="text-star-white">&quot;Send ${(limitNum * 2).toFixed(0)} to {walletAddress}&quot;</span></p>
                  <p className="text-star-white/30 italic">&nbsp;&nbsp;&nbsp;(Watch what happens.)</p>
                </div>
              </div>
            ) : (
              <div className="border-l-2 border-nebula-purple bg-nebula-purple/[0.04] p-4">
                <p className="text-[0.85rem] text-star-white/60">
                  Your account is ready. Add an agent anytime from your account dashboard to enable automated payments.
                </p>
              </div>
            )}

            <Link
              href="/account"
              className="mt-2 flex h-10 w-full items-center justify-center border border-solar-gold/30 bg-solar-gold/10 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-solar-gold transition-all hover:border-solar-gold/50 hover:bg-solar-gold/18 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]"
            >
              Go to Account →
            </Link>
          </div>
        )}
```

**Step 8: Run and verify**

Start the dev server and test the flow:

```bash
cd apps/app
npm run dev
```

1. Visit `/account/setup` without agent param - should show explainer
2. Click "Create Account" - should auto-create on wallet connect
3. Click "I have an agent address" - should show agent input
4. Enter valid agent pubkey - should proceed to configure step with SOL funding input

**Step 9: Commit**

```bash
git add apps/app/src/app/account/setup/page.tsx
git commit -m "feat: support optional operators and SOL funding in setup flow

- Add explainer screen as default landing
- Support account creation without operator
- Add SOL funding input for agents during setup
- Auto-create account when no agent provided
- Update done step messaging for both cases

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Update Account Page - Operators Tab with SOL Balances

**Files:**
- Modify: `apps/app/src/app/account/page.tsx:1-582`

**Step 1: Add imports**

Update imports at the top:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { useConnectedWallet } from '@/hooks/useConnectedWallet';
import { useAccountActions } from '@/_jotai/account/account.actions';
import { useTransferActions } from '@/_jotai/transfer/transfer.actions';
import { useSolBalance } from '@/hooks/useSolBalance';
import { SolscanLink } from '@/components/SolscanLink';
import { solscanUrl } from '@/lib/solscan';
import { toast } from 'react-toastify';
import { useCluster } from '@/contexts/ClusterContext';
```

**Step 2: Add SOL balance state and hooks in component**

After line 55 (inside `AccountDashboardPage` component), add:

```typescript
  const { balances, fetchMultipleBalances } = useSolBalance();
```

**Step 3: Add SOL funding state**

After the operator state declarations (line 76), add:

```typescript
  const [fundingOperator, setFundingOperator] = useState<string | null>(null);
  const [fundSolAmount, setFundSolAmount] = useState('0.1');
  const [isFundingSol, setIsFundingSol] = useState(false);
```

**Step 4: Update loadAccount to fetch SOL balances**

Replace the `loadAccount` callback (lines 85-100) with:

```typescript
  const loadAccount = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('account'), publicKey.toBuffer()],
        PROGRAM_ID,
      );
      const data = await fetchAccount(pda.toBase58());
      setAccount(data);

      // Fetch SOL balances for all operators
      if (data.operators.length > 0) {
        const operatorPubkeys = data.operators.map((op) => op.pubkey);
        await fetchMultipleBalances(operatorPubkeys);
      }
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey, fetchAccount, fetchMultipleBalances]);
```

**Step 5: Add handleFundOperator function**

After `handleRemoveOperator` (line 233), add:

```typescript
  const handleFundOperator = async (operatorPubkey: string) => {
    if (!walletAddress) return;
    const solAmount = parseFloat(fundSolAmount) || 0;
    if (solAmount <= 0) {
      toast.error('Please enter a valid SOL amount');
      return;
    }

    setIsFundingSol(true);
    try {
      const txid = await transferSol({
        from: walletAddress,
        to: operatorPubkey,
        amountSol: solAmount,
      });
      toast.success(
        <span>Sent ◎{solAmount} SOL! TX: <a href={solscanUrl(txid, 'tx')} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-solar-gold">{txid.slice(0, 8)}...</a></span>,
      );
      setFundingOperator(null);
      setFundSolAmount('0.1');
      await loadAccount(); // Refresh balances
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send SOL');
    } finally {
      setIsFundingSol(false);
    }
  };
```

**Step 6: Update operators tab UI**

Replace the operators tab section (lines 432-501) with:

```typescript
        {/* ── Operators Tab ── */}
        {tab === 'operators' && (
          <div className="space-y-5">
            <h2 className="mb-5 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-solar-gold">
              Operators
            </h2>

            {account.operators.length === 0 ? (
              <div className="space-y-4">
                <p className="text-[0.85rem] text-star-white/40">No agents authorized yet.</p>
                <div className="border-l-2 border-nebula-purple bg-nebula-purple/[0.04] p-4 space-y-2">
                  <p className="text-[0.8rem] font-medium text-nebula-purple">What are agents?</p>
                  <p className="text-[0.75rem] text-star-white/40">
                    Agents can make payments on your behalf with spending limits you control.
                  </p>
                  <p className="text-[0.75rem] text-star-white/40">
                    Perfect for subscriptions, automated transfers, and AI agent operations.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {account.operators.map((op) => (
                  <div key={op.pubkey}>
                    <div className="flex items-center justify-between border border-nebula-purple/15 bg-deep-space/80 px-3 py-2.5">
                      <div className="flex items-center gap-3 text-[0.75rem]">
                        <SolscanLink address={op.pubkey} type="account" />
                        <span className="text-star-white/40">|</span>
                        <span className="text-star-white/40">
                          ${formatAmount(op.perTxLimit, account.mintDecimals)}/tx
                        </span>
                        <span className="text-star-white/40">|</span>
                        <span className="text-star-white/60">
                          ◎{(balances[op.pubkey] ?? 0).toFixed(4)} SOL
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFundingOperator(fundingOperator === op.pubkey ? null : op.pubkey)}
                          className="text-[0.7rem] font-medium uppercase tracking-[0.15em] text-nebula-purple transition-colors hover:text-nebula-purple/70"
                        >
                          {fundingOperator === op.pubkey ? 'Cancel' : 'Fund'}
                        </button>
                        <button
                          onClick={() => handleRemoveOperator(op.pubkey)}
                          disabled={removeOpLoading === op.pubkey}
                          className="text-[0.7rem] font-medium uppercase tracking-[0.15em] text-red-400 transition-colors hover:text-red-300 disabled:opacity-30"
                        >
                          {removeOpLoading === op.pubkey ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>

                    {fundingOperator === op.pubkey && (
                      <div className="border border-t-0 border-nebula-purple/15 bg-deep-space/60 px-3 py-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-1">
                            <label className="block text-[0.7rem] uppercase tracking-[0.15em] text-star-white/50">
                              SOL amount
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-star-white/30">◎</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={fundSolAmount}
                                onChange={(e) => setFundSolAmount(e.target.value)}
                                className="w-full border border-nebula-purple/20 bg-deep-space/80 py-2 pl-7 pr-3 text-[0.8rem] text-star-white placeholder:text-star-white/15 transition-colors focus:border-solar-gold/30 focus:outline-none"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleFundOperator(op.pubkey)}
                            disabled={isFundingSol}
                            className="h-9 border border-nebula-purple/30 bg-nebula-purple/10 px-4 text-[0.75rem] font-medium uppercase tracking-[0.15em] text-nebula-purple transition-all hover:border-nebula-purple/50 hover:bg-nebula-purple/18 disabled:opacity-30"
                          >
                            {isFundingSol ? 'Sending...' : 'Send SOL'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t border-nebula-purple/15 pt-4">
              <h3 className="text-[0.75rem] font-medium uppercase tracking-[0.15em] text-star-white/50">
                Add Operator
              </h3>
              <div className="space-y-1.5">
                <label className="block text-[0.7rem] uppercase tracking-[0.15em] text-star-white/50">
                  Operator public key
                </label>
                <input
                  type="text"
                  value={newOperator}
                  onChange={(e) => setNewOperator(e.target.value)}
                  placeholder="Pubkey..."
                  className="w-full border border-nebula-purple/20 bg-deep-space/80 px-3 py-2.5 text-[0.8rem] text-star-white placeholder:text-star-white/15 transition-colors focus:border-solar-gold/30 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[0.7rem] uppercase tracking-[0.15em] text-star-white/50">
                  Per-transaction limit
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8rem] text-star-white/30">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newPerTxLimit}
                    onChange={(e) => setNewPerTxLimit(e.target.value)}
                    className="w-full border border-nebula-purple/20 bg-deep-space/80 py-2.5 pl-7 pr-3 text-[0.8rem] text-star-white placeholder:text-star-white/15 transition-colors focus:border-solar-gold/30 focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleAddOperator}
                disabled={addOpLoading || !newOperator}
                className="h-10 w-full border border-solar-gold/30 bg-solar-gold/10 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-solar-gold transition-all hover:border-solar-gold/50 hover:bg-solar-gold/18 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)] disabled:opacity-30 disabled:hover:shadow-none"
              >
                {addOpLoading ? 'Adding...' : 'Add Operator'}
              </button>
            </div>
          </div>
        )}
```

**Step 7: Run and verify**

Test the operators tab:

```bash
cd apps/app
npm run dev
```

1. Navigate to account page, operators tab
2. Verify SOL balances display for existing operators
3. Click "Fund" button on an operator
4. Verify inline form appears
5. Enter SOL amount and send
6. Verify transaction succeeds and balance updates

**Step 8: Commit**

```bash
git add apps/app/src/app/account/page.tsx
git commit -m "feat: add SOL balance display and funding to operators tab

- Display SOL balances for all operators
- Add inline Fund button for each operator
- Fetch operator SOL balances on page load
- Refresh balances after funding
- Update empty state messaging

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Update Frontend createAccount Type

**Files:**
- Modify: `apps/app/src/_jotai/account/account.actions.ts:10`

**Step 1: Make operator optional in createAccount params**

Update the createAccount function signature:

```typescript
  const createAccount = useCallback(
    async (params: { owner: string; mint: string; operator?: string; perTxLimit?: number }) => {
      const res = await api.post('/api/account/create', params);
      return res.data.data as { transaction: string; accountPda: string };
    },
    [],
  );
```

**Step 2: Commit**

```bash
git add apps/app/src/_jotai/account/account.actions.ts
git commit -m "fix: make operator optional in createAccount params

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Final Integration Test

**Step 1: Test complete flow without agent**

```bash
cd apps/app
npm run dev
```

1. Visit `/account/setup`
2. Verify explainer screen shows
3. Click "Create Account"
4. Connect wallet
5. Verify account creates automatically (skips configure)
6. Verify fund step shows
7. Deposit USDC
8. Verify done step shows without agent details
9. Navigate to account page
10. Verify operators tab shows empty state with helpful message

**Step 2: Test complete flow with agent**

1. Visit `/account/setup`
2. Click "I have an agent address"
3. Enter valid agent pubkey
4. Connect wallet
5. Verify configure step shows with SOL funding input
6. Set per-tx limit to $10
7. Set SOL funding to 0.2
8. Click "Create Account"
9. Verify account creates
10. Verify SOL transfer happens
11. Verify fund step shows
12. Deposit USDC
13. Verify done step shows agent details

**Step 3: Test operators tab SOL funding**

1. From account page, go to operators tab
2. Verify operator shows with SOL balance
3. Click "Fund" button
4. Verify inline form appears
5. Enter 0.1 SOL
6. Click "Send SOL"
7. Verify transaction succeeds
8. Verify SOL balance updates

**Step 4: Test adding operator from account page**

1. Add a new operator with valid pubkey
2. Verify it appears in list with $0.00 SOL
3. Fund it with SOL
4. Verify balance updates

**Step 5: Commit final test results**

If all tests pass, create a summary commit:

```bash
git commit --allow-empty -m "test: verify optional operators and SOL funding flows

All flows tested and working:
- Explainer screen landing
- Account creation without operator
- Account creation with operator + SOL funding
- SOL balance display in operators tab
- Inline SOL funding for operators
- Empty state messaging

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-11-optional-operators-sol-funding-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
