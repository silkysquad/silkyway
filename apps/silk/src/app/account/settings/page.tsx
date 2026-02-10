'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { useConnectedWallet } from '@/hooks/useConnectedWallet';
import { useAccountActions } from '@/_jotai/account/account.actions';
import { toast } from 'react-toastify';

const PROGRAM_ID = new PublicKey('8MDFar9moBycSXb6gdZgqkiSEGRBRkzxa7JPLddqYcKs');

function truncate(s: string) {
  return s.length > 12 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s;
}

function formatAmount(raw: string | number, decimals: number) {
  return (Number(raw) / 10 ** decimals).toFixed(2);
}

interface AccountData {
  pda: string;
  owner: string;
  mint: string;
  mintDecimals: number;
  isPaused: boolean;
  balance: number;
  operators: Array<{
    index: number;
    pubkey: string;
    perTxLimit: string;
    dailyLimit: string;
  }>;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { publicKey, isConnected } = useConnectedWallet();
  const {
    fetchAccount,
    togglePause,
    addOperator,
    removeOperator,
    closeAccount,
    signAndSubmit,
  } = useAccountActions();

  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [addOpLoading, setAddOpLoading] = useState(false);
  const [removeOpLoading, setRemoveOpLoading] = useState<string | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const [newOperator, setNewOperator] = useState('');
  const [newPerTxLimit, setNewPerTxLimit] = useState('5');

  const walletAddress = publicKey?.toBase58() ?? '';

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
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey, fetchAccount]);

  useEffect(() => {
    if (isConnected) {
      loadAccount();
    }
  }, [isConnected, loadAccount]);

  // Redirect to setup if no account found
  useEffect(() => {
    if (!loading && !account && isConnected) {
      router.push('/account/setup');
    }
  }, [loading, account, isConnected, router]);

  if (!isConnected) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1200px] items-center justify-center px-8">
        <p className="text-[0.85rem] text-star-white/40">Connect your wallet to view account settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[1200px] items-center justify-center px-8">
        <p className="text-[0.85rem] text-star-white/40">Loading account...</p>
      </div>
    );
  }

  if (!account) return null;

  const handleTogglePause = async () => {
    setPauseLoading(true);
    try {
      const { transaction } = await togglePause({ owner: walletAddress, accountPda: account.pda });
      toast.info('Please approve the transaction in your wallet...');
      await signAndSubmit(transaction);
      toast.success(account.isPaused ? 'Account resumed' : 'Account paused');
      await loadAccount();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle pause');
    } finally {
      setPauseLoading(false);
    }
  };

  const handleAddOperator = async () => {
    const limitNum = parseFloat(newPerTxLimit) || 0;
    if (!newOperator || limitNum < 0) return;
    try {
      new PublicKey(newOperator);
    } catch {
      toast.error('Invalid operator public key');
      return;
    }
    setAddOpLoading(true);
    try {
      const { transaction } = await addOperator({
        owner: walletAddress,
        accountPda: account.pda,
        operator: newOperator,
        perTxLimit: limitNum * 10 ** account.mintDecimals,
      });
      toast.info('Please approve the transaction in your wallet...');
      await signAndSubmit(transaction);
      toast.success('Operator added');
      setNewOperator('');
      setNewPerTxLimit('5');
      await loadAccount();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add operator');
    } finally {
      setAddOpLoading(false);
    }
  };

  const handleRemoveOperator = async (operatorPubkey: string) => {
    setRemoveOpLoading(operatorPubkey);
    try {
      const { transaction } = await removeOperator({
        owner: walletAddress,
        accountPda: account.pda,
        operator: operatorPubkey,
      });
      toast.info('Please approve the transaction in your wallet...');
      await signAndSubmit(transaction);
      toast.success('Operator removed');
      await loadAccount();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove operator');
    } finally {
      setRemoveOpLoading(null);
    }
  };

  const handleCloseAccount = async () => {
    setCloseLoading(true);
    try {
      const { transaction } = await closeAccount({ owner: walletAddress, accountPda: account.pda });
      toast.info('Please approve the transaction in your wallet...');
      await signAndSubmit(transaction);
      toast.success('Account closed — tokens swept to your wallet');
      setShowCloseConfirm(false);
      setTimeout(() => router.push('/account/setup'), 1500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close account');
    } finally {
      setCloseLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-8 py-10">
      <div className="mb-8">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-nebula-purple/60">
          Account Management
        </div>
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-star-white">
          Settings
        </h1>
      </div>

      {/* Account Info */}
      <div
        className="gradient-border-top mb-6 border border-nebula-purple/20 p-6"
        style={{ background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.04) 0%, rgba(12, 0, 21, 0.8) 100%)' }}
      >
        <h2 className="mb-5 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-solar-gold">
          Account Info
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-[0.8rem]">
            <span className="text-star-white/50">PDA</span>
            <span className="font-mono text-star-white/70">{truncate(account.pda)}</span>
          </div>
          <div className="flex justify-between text-[0.8rem]">
            <span className="text-star-white/50">Owner</span>
            <span className="font-mono text-star-white/70">{truncate(account.owner)}</span>
          </div>
          <div className="flex justify-between text-[0.8rem]">
            <span className="text-star-white/50">Mint</span>
            <span className="font-mono text-star-white/70">{truncate(account.mint)}</span>
          </div>
          <div className="flex justify-between text-[0.8rem]">
            <span className="text-star-white/50">Balance</span>
            <span className="text-star-white/70">${formatAmount(account.balance, account.mintDecimals)} USDC</span>
          </div>
        </div>
      </div>

      {/* Operators */}
      <div
        className="gradient-border-top mb-6 border border-nebula-purple/20 p-6"
        style={{ background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.04) 0%, rgba(12, 0, 21, 0.8) 100%)' }}
      >
        <h2 className="mb-5 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-solar-gold">
          Operators
        </h2>

        {account.operators.length === 0 ? (
          <p className="mb-4 text-[0.8rem] text-star-white/40">No operators configured.</p>
        ) : (
          <div className="mb-4 space-y-2">
            {account.operators.map((op) => (
              <div key={op.pubkey} className="flex items-center justify-between border border-nebula-purple/15 bg-deep-space/80 px-3 py-2.5">
                <div>
                  <span className="font-mono text-[0.75rem] text-star-white/70">{truncate(op.pubkey)}</span>
                  <span className="ml-3 text-[0.7rem] text-star-white/40">
                    limit: ${formatAmount(op.perTxLimit, account.mintDecimals)}/tx
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveOperator(op.pubkey)}
                  disabled={removeOpLoading === op.pubkey}
                  className="text-[0.7rem] font-medium uppercase tracking-[0.15em] text-red-400 transition-colors hover:text-red-300 disabled:opacity-30"
                >
                  {removeOpLoading === op.pubkey ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-nebula-purple/15 pt-4">
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

      {/* Pause Toggle */}
      <div
        className="gradient-border-top mb-6 border border-nebula-purple/20 p-6"
        style={{ background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.04) 0%, rgba(12, 0, 21, 0.8) 100%)' }}
      >
        <h2 className="mb-5 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-solar-gold">
          Account Status
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[0.8rem] text-star-white/50">Status</span>
            {account.isPaused ? (
              <span className="border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-red-400">
                Paused
              </span>
            ) : (
              <span className="border border-green-400/30 bg-green-400/10 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-green-400">
                Active
              </span>
            )}
          </div>
          <button
            onClick={handleTogglePause}
            disabled={pauseLoading}
            className="h-9 border border-nebula-purple/30 bg-nebula-purple/10 px-4 text-[0.75rem] font-medium uppercase tracking-[0.15em] text-nebula-purple transition-all hover:border-nebula-purple/50 hover:bg-nebula-purple/18 disabled:opacity-30"
          >
            {pauseLoading ? 'Processing...' : account.isPaused ? 'Resume Account' : 'Pause Account'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-400/20 p-6">
        <h2 className="mb-3 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-red-400">
          Danger Zone
        </h2>
        <p className="mb-4 text-[0.8rem] text-star-white/40">
          Closing your account will sweep all remaining tokens to your wallet and permanently delete the account.
        </p>
        <button
          onClick={() => setShowCloseConfirm(true)}
          className="h-10 w-full border border-red-400/30 bg-red-400/10 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-red-400 transition-all hover:border-red-400/50 hover:bg-red-400/18"
        >
          Close Account
        </button>
      </div>

      {/* Close Confirmation Overlay */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md border border-red-400/20 bg-deep-space p-6">
            <h3 className="mb-3 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-red-400">
              Confirm Close Account
            </h3>
            <p className="mb-6 text-[0.8rem] text-star-white/50">
              This will sweep all tokens to your wallet and permanently close the account. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                disabled={closeLoading}
                className="h-10 flex-1 border border-nebula-purple/20 bg-transparent text-[0.8rem] font-medium uppercase tracking-[0.15em] text-star-white/50 transition-all hover:border-nebula-purple/40 hover:text-star-white/70"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseAccount}
                disabled={closeLoading}
                className="h-10 flex-1 border border-red-400/30 bg-red-400/10 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-red-400 transition-all hover:border-red-400/50 hover:bg-red-400/18 disabled:opacity-30"
              >
                {closeLoading ? 'Closing...' : 'Confirm Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
