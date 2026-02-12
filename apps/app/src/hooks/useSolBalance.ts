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
        setBalances((prev) => ({ ...prev, ...balanceMap }));
        return balanceMap;
      } finally {
        setLoading(false);
      }
    },
    [fetchBalance],
  );

  return { balances, loading, fetchBalance, fetchMultipleBalances };
}
