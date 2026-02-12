import { useCallback } from 'react';
import { VersionedTransaction, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '@/lib/api';
import { useConnection } from '@/hooks/useConnection';

export function useAccountActions() {
  const { signTransaction } = useWallet();

  const createAccount = useCallback(
    async (params: { owner: string; mint: string; operator?: string; perTxLimit?: number }) => {
      const res = await api.post('/api/account/create', params);
      return res.data.data as { transaction: string; accountPda: string };
    },
    [],
  );

  const depositToAccount = useCallback(
    async (params: { depositor: string; accountPda: string; amount: number }) => {
      const res = await api.post('/api/account/deposit', params);
      return res.data.data as { transaction: string };
    },
    [],
  );

  const transferFromAccount = useCallback(
    async (params: { signer: string; accountPda: string; recipient: string; amount: number }) => {
      const res = await api.post('/api/account/transfer', params);
      return res.data.data as { transaction: string };
    },
    [],
  );

  const fetchAccount = useCallback(async (pda: string) => {
    const res = await api.get(`/api/account/${pda}`);
    return res.data.data;
  }, []);

  const signAndSubmit = useCallback(
    async (base64Tx: string): Promise<string> => {
      if (!signTransaction) throw new Error('Wallet does not support signing');
      const txBytes = Buffer.from(base64Tx, 'base64');
      const tx = VersionedTransaction.deserialize(txBytes);
      const signed = await signTransaction(tx);
      const signedBase64 = Buffer.from(signed.serialize()).toString('base64');
      const res = await api.post('/api/tx/submit', { signedTx: signedBase64 });
      return res.data.data.txid;
    },
    [signTransaction],
  );

  const togglePause = useCallback(
    async (params: { owner: string; accountPda: string }) => {
      const res = await api.post('/api/account/pause', params);
      return res.data.data as { transaction: string };
    },
    [],
  );

  const addOperator = useCallback(
    async (params: { owner: string; accountPda: string; operator: string; perTxLimit?: number }) => {
      const res = await api.post('/api/account/add-operator', params);
      return res.data.data as { transaction: string };
    },
    [],
  );

  const removeOperator = useCallback(
    async (params: { owner: string; accountPda: string; operator: string }) => {
      const res = await api.post('/api/account/remove-operator', params);
      return res.data.data as { transaction: string };
    },
    [],
  );

  const closeAccount = useCallback(
    async (params: { owner: string; accountPda: string }) => {
      const res = await api.post('/api/account/close', params);
      return res.data.data as { transaction: string };
    },
    [],
  );

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
}
