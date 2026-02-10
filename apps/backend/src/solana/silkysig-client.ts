import { Program, web3, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Idl } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  getMint,
} from '@solana/spl-token';

export const ACCOUNT_SEED = 'account';

export interface OperatorSlotData {
  pubkey: PublicKey;
  perTxLimit: BN;
  dailyLimit: BN;
  dailySpent: BN;
  lastReset: BN;
}

export interface SilkAccountData {
  version: number;
  bump: number;
  owner: PublicKey;
  mint: PublicKey;
  isPaused: boolean;
  operatorCount: number;
  operators: OperatorSlotData[];
}

export class SilkysigClient {
  private program: Program<Idl>;
  private connection: Connection;

  constructor(program: any) {
    this.program = program;
    this.connection = program.provider.connection;
  }

  findAccountPda(owner: PublicKey): [PublicKey, number] {
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from(ACCOUNT_SEED), owner.toBuffer()],
      this.program.programId,
    );
  }

  async fetchAccount(pda: PublicKey): Promise<SilkAccountData | null> {
    try {
      return (await (this.program.account as any).silkAccount.fetch(pda)) as SilkAccountData;
    } catch {
      return null;
    }
  }

  async findAccountsByOperator(
    operatorPubkey: PublicKey,
  ): Promise<Array<{ pda: PublicKey; account: SilkAccountData; balance: number; mintDecimals: number }>> {
    const programId = this.program.programId;
    const operatorBytes = operatorPubkey.toBuffer();

    // Operator pubkey offsets in account data:
    // Discriminator: 8, version: 1, bump: 1, owner: 32, mint: 32, is_paused: 1, operator_count: 1 = 76 bytes
    // Each OperatorSlot: pubkey(32) + per_tx_limit(8) + daily_limit(8) + daily_spent(8) + last_reset(8) = 64 bytes
    const baseOffset = 76;
    const slotSize = 64;
    const offsets = [baseOffset, baseOffset + slotSize, baseOffset + slotSize * 2];

    const allResults = await Promise.all(
      offsets.map((offset) =>
        this.connection.getProgramAccounts(programId, {
          filters: [{ memcmp: { offset, bytes: operatorPubkey.toBase58() } }],
        }),
      ),
    );

    // Deduplicate by PDA
    const seen = new Set<string>();
    const unique: Array<{ pda: PublicKey; raw: Buffer }> = [];
    for (const results of allResults) {
      for (const r of results) {
        const pdaStr = r.pubkey.toBase58();
        if (!seen.has(pdaStr)) {
          seen.add(pdaStr);
          unique.push({ pda: r.pubkey, raw: r.account.data as Buffer });
        }
      }
    }

    // Decode each account and fetch balance
    const out: Array<{ pda: PublicKey; account: SilkAccountData; balance: number; mintDecimals: number }> = [];
    for (const { pda } of unique) {
      const account = await this.fetchAccount(pda);
      if (!account) continue;

      const ata = getAssociatedTokenAddressSync(account.mint, pda, true);
      let balance = 0;
      let mintDecimals = 0;
      try {
        const tokenBalance = await this.connection.getTokenAccountBalance(ata);
        balance = Number(tokenBalance.value.amount);
        mintDecimals = tokenBalance.value.decimals;
      } catch {
        // ATA may not exist yet
        try {
          const mintInfo = await getMint(this.connection, account.mint);
          mintDecimals = mintInfo.decimals;
        } catch {
          // mint fetch failed, leave as 0
        }
      }

      out.push({ pda, account, balance, mintDecimals });
    }

    return out;
  }

  async buildCreateAccountTx(
    owner: PublicKey,
    mint: PublicKey,
    operator?: PublicKey,
    perTxLimit?: BN,
  ): Promise<{ transaction: string; accountPda: string }> {
    const [silkAccountPda] = this.findAccountPda(owner);
    const accountTokenAccount = getAssociatedTokenAddressSync(mint, silkAccountPda, true);

    const ix = await (this.program.methods as any)
      .createAccount(operator ?? null, perTxLimit ?? null)
      .accounts({
        owner,
        mint,
        silkAccount: silkAccountPda,
        accountTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = owner;
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
    return { transaction: serialized, accountPda: silkAccountPda.toBase58() };
  }

  async buildDepositTx(
    depositor: PublicKey,
    accountPda: PublicKey,
    amount: BN,
  ): Promise<{ transaction: string }> {
    const account = await this.fetchAccount(accountPda);
    if (!account) throw new Error('ACCOUNT_NOT_FOUND');

    const mint = account.mint;
    const accountTokenAccount = getAssociatedTokenAddressSync(mint, accountPda, true);
    const depositorTokenAccount = getAssociatedTokenAddressSync(mint, depositor, true);

    const ix = await (this.program.methods as any)
      .deposit(amount)
      .accounts({
        depositor,
        silkAccount: accountPda,
        mint,
        accountTokenAccount,
        depositorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = depositor;
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
    return { transaction: serialized };
  }

  async buildTransferFromAccountTx(
    signer: PublicKey,
    accountPda: PublicKey,
    recipient: PublicKey,
    amount: BN,
  ): Promise<{ transaction: string }> {
    const account = await this.fetchAccount(accountPda);
    if (!account) throw new Error('ACCOUNT_NOT_FOUND');

    const mint = account.mint;
    const accountTokenAccount = getAssociatedTokenAddressSync(mint, accountPda, true);
    const recipientTokenAccount = getAssociatedTokenAddressSync(mint, recipient, true);

    const ix = await (this.program.methods as any)
      .transferFromAccount(amount)
      .accounts({
        signer,
        silkAccount: accountPda,
        mint,
        accountTokenAccount,
        recipient,
        recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = signer;
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
    return { transaction: serialized };
  }

  async buildTogglePauseTx(
    owner: PublicKey,
    accountPda: PublicKey,
  ): Promise<{ transaction: string }> {
    const ix = await (this.program.methods as any)
      .togglePause()
      .accounts({
        owner,
        silkAccount: accountPda,
      })
      .instruction();

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = owner;
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
    return { transaction: serialized };
  }

  async buildAddOperatorTx(
    owner: PublicKey,
    accountPda: PublicKey,
    operator: PublicKey,
    perTxLimit: BN,
  ): Promise<{ transaction: string }> {
    const ix = await (this.program.methods as any)
      .addOperator(operator, perTxLimit)
      .accounts({
        owner,
        silkAccount: accountPda,
      })
      .instruction();

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = owner;
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
    return { transaction: serialized };
  }

  async buildRemoveOperatorTx(
    owner: PublicKey,
    accountPda: PublicKey,
    operator: PublicKey,
  ): Promise<{ transaction: string }> {
    const ix = await (this.program.methods as any)
      .removeOperator(operator)
      .accounts({
        owner,
        silkAccount: accountPda,
      })
      .instruction();

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = owner;
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
    return { transaction: serialized };
  }

  async buildCloseAccountTx(
    owner: PublicKey,
    accountPda: PublicKey,
  ): Promise<{ transaction: string }> {
    const account = await this.fetchAccount(accountPda);
    if (!account) throw new Error('ACCOUNT_NOT_FOUND');

    const mint = account.mint;
    const accountTokenAccount = getAssociatedTokenAddressSync(mint, accountPda, true);
    const ownerTokenAccount = getAssociatedTokenAddressSync(mint, owner, true);

    const ix = await (this.program.methods as any)
      .closeAccount()
      .accounts({
        owner,
        silkAccount: accountPda,
        mint,
        accountTokenAccount,
        ownerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = owner;
    tx.add(ix);

    const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');
    return { transaction: serialized };
  }
}
