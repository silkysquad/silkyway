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
