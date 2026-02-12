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
