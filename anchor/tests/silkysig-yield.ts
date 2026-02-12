import * as anchor from "@coral-xyz/anchor";
import { BN, Program, web3 } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import { Silkysig } from "../target/types/silkysig";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ACCOUNT_SEED = Buffer.from("account");

// Drift program (same on devnet and mainnet)
const DRIFT_PROGRAM = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
const DRIFT_STATE = new PublicKey("5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN");

// Devnet fake USDC
const USDC_MINT = new PublicKey("8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2");
const USDC_MARKET_INDEX = 0;
// Oracle resolved at runtime from the on-chain spot market account
let USDC_ORACLE: PublicKey;

// ─── Drift PDA Helpers ──────────────────────────────────────────────────────────

function getDriftUserStatsPDA(authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_stats"), authority.toBuffer()],
    DRIFT_PROGRAM
  )[0];
}

function getDriftUserPDA(authority: PublicKey, subAccountId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user"), authority.toBuffer(), new BN(subAccountId).toArrayLike(Buffer, "le", 2)],
    DRIFT_PROGRAM
  )[0];
}

function getDriftSpotMarketVaultPDA(marketIndex: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("spot_market_vault"), new BN(marketIndex).toArrayLike(Buffer, "le", 2)],
    DRIFT_PROGRAM
  )[0];
}

function getDriftSpotMarketPDA(marketIndex: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("spot_market"), new BN(marketIndex).toArrayLike(Buffer, "le", 2)],
    DRIFT_PROGRAM
  )[0];
}

function getDriftSignerPDA(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("drift_signer")],
    DRIFT_PROGRAM
  )[0];
}

// ─── Silkysig Helpers ───────────────────────────────────────────────────────────

function findAccountPda(programId: PublicKey, owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ACCOUNT_SEED, owner.toBuffer()],
    programId
  );
}

function getAta(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true);
}

async function getTokenBalance(connection: web3.Connection, ata: PublicKey): Promise<BN> {
  const info = await connection.getTokenAccountBalance(ata);
  return new BN(info.value.amount);
}

function stringToBytes32(s: string): number[] {
  const bytes = Buffer.alloc(32, 0);
  Buffer.from(s).copy(bytes);
  return Array.from(bytes);
}

// ─── Drift Account Helpers ───────────────────────────────────────────────────────

async function fetchSpotMarketOracle(connection: web3.Connection, marketIndex: number): Promise<PublicKey> {
  const spotMarketPda = getDriftSpotMarketPDA(marketIndex);
  const accountInfo = await connection.getAccountInfo(spotMarketPda);
  if (!accountInfo) throw new Error(`Spot market account not found: ${spotMarketPda.toString()}`);
  // SpotMarket layout: 8 (discriminator) + 32 (pubkey) + 32 (oracle)
  const oracleBytes = accountInfo.data.subarray(40, 72);
  return new PublicKey(oracleBytes);
}

// ─── Remaining Accounts Builders ────────────────────────────────────────────────

// Deposit: 7 remaining accounts
// [drift_state, drift_user, drift_user_stats, drift_spot_market_vault, drift_program, drift_oracle, drift_spot_market]
function buildDepositRemainingAccounts(silkAccountPda: PublicKey): web3.AccountMeta[] {
  return [
    { pubkey: DRIFT_STATE, isSigner: false, isWritable: true },
    { pubkey: getDriftUserPDA(silkAccountPda, 0), isSigner: false, isWritable: true },
    { pubkey: getDriftUserStatsPDA(silkAccountPda), isSigner: false, isWritable: true },
    { pubkey: getDriftSpotMarketVaultPDA(USDC_MARKET_INDEX), isSigner: false, isWritable: true },
    { pubkey: DRIFT_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: USDC_ORACLE, isSigner: false, isWritable: false },
    { pubkey: getDriftSpotMarketPDA(USDC_MARKET_INDEX), isSigner: false, isWritable: true },
  ];
}

// Withdraw: 8 remaining accounts
// [drift_state, drift_user, drift_user_stats, drift_spot_market_vault, drift_signer, drift_program, drift_oracle, drift_spot_market]
function buildWithdrawRemainingAccounts(silkAccountPda: PublicKey): web3.AccountMeta[] {
  return [
    { pubkey: DRIFT_STATE, isSigner: false, isWritable: true },
    { pubkey: getDriftUserPDA(silkAccountPda, 0), isSigner: false, isWritable: true },
    { pubkey: getDriftUserStatsPDA(silkAccountPda), isSigner: false, isWritable: true },
    { pubkey: getDriftSpotMarketVaultPDA(USDC_MARKET_INDEX), isSigner: false, isWritable: true },
    { pubkey: getDriftSignerPDA(), isSigner: false, isWritable: false },
    { pubkey: DRIFT_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: USDC_ORACLE, isSigner: false, isWritable: false },
    { pubkey: getDriftSpotMarketPDA(USDC_MARKET_INDEX), isSigner: false, isWritable: true },
  ];
}

// ─── Test Suite ─────────────────────────────────────────────────────────────────

describe("silkysig-yield (devnet)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.silkysig as Program<Silkysig>;
  const programId = program.programId;
  const { connection } = provider;
  const payer = provider.wallet.publicKey;
  const payerKeypair = (provider.wallet as any).payer as Keypair;

  // Test owner — fresh keypair per run
  let owner: Keypair;
  let accountPda: PublicKey;
  let accountAta: PublicKey;
  let ownerAta: PublicKey;

  // Drift accounts derived from the silk account PDA
  let driftUser: PublicKey;
  let driftUserStats: PublicKey;

  const DEPOSIT_AMOUNT = 5_000_000; // 5 USDC (6 decimals)
  const TRANSFER_AMOUNT = 2_000_000; // 2 USDC

  before(async () => {
    console.log("\n=== SETUP ===");
    console.log(`Program: ${programId.toString()}`);
    console.log(`Payer: ${payer.toString()}`);
    console.log(`USDC Mint: ${USDC_MINT.toString()}`);

    // Resolve oracle from on-chain spot market
    USDC_ORACLE = await fetchSpotMarketOracle(connection, USDC_MARKET_INDEX);
    console.log(`USDC Oracle (from on-chain spot market): ${USDC_ORACLE.toString()}`);

    // Create fresh owner
    owner = Keypair.generate();
    console.log(`Owner: ${owner.publicKey.toString()}`);

    // Derive PDAs
    [accountPda] = findAccountPda(programId, owner.publicKey);
    accountAta = getAta(USDC_MINT, accountPda);
    ownerAta = getAta(USDC_MINT, owner.publicKey);
    driftUser = getDriftUserPDA(accountPda, 0);
    driftUserStats = getDriftUserStatsPDA(accountPda);

    console.log(`Silk Account PDA: ${accountPda.toString()}`);
    console.log(`Account ATA: ${accountAta.toString()}`);
    console.log(`Drift User: ${driftUser.toString()}`);
    console.log(`Drift User Stats: ${driftUserStats.toString()}`);

    // Fund owner with SOL
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: owner.publicKey,
        lamports: 0.1 * web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(fundTx);
    console.log(`Funded owner with 0.1 SOL`);

    // Create owner's USDC ATA and fund it from payer
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      payer,
      ownerAta,
      owner.publicKey,
      USDC_MINT
    );
    const payerUsdcAta = getAta(USDC_MINT, payer);
    const transferIx = createTransferInstruction(
      payerUsdcAta,
      ownerAta,
      payer,
      20_000_000, // 20 USDC (enough for all tests)
    );
    const setupTx = new Transaction().add(createAtaIx, transferIx);
    await provider.sendAndConfirm(setupTx);

    const ownerBal = await getTokenBalance(connection, ownerAta);
    console.log(`Owner USDC balance: ${ownerBal.toString()} (${ownerBal.toNumber() / 1e6} USDC)`);
  });

  it("Y1. create_account — initializes silk account for USDC", async () => {
    await program.methods
      .createAccount()
      .accounts({
        owner: owner.publicKey,
        mint: USDC_MINT,
        silkAccount: accountPda,
        accountTokenAccount: accountAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const acct = await program.account.silkAccount.fetch(accountPda);
    assert.isNull(acct.driftUser, "drift_user should be None before init");
    assert.isNull(acct.driftMarketIndex, "drift_market_index should be None before init");
    assert.equal(acct.principalBalance.toNumber(), 0);
    console.log("Silk account created");
  });

  it("Y2. deposit — deposits USDC before Drift init (no remaining accounts)", async () => {
    await program.methods
      .deposit(new BN(DEPOSIT_AMOUNT))
      .accounts({
        depositor: owner.publicKey,
        silkAccount: accountPda,
        mint: USDC_MINT,
        accountTokenAccount: accountAta,
        depositorTokenAccount: ownerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();

    const ataBalance = await getTokenBalance(connection, accountAta);
    assert.equal(ataBalance.toNumber(), DEPOSIT_AMOUNT);

    const acct = await program.account.silkAccount.fetch(accountPda);
    assert.equal(acct.principalBalance.toNumber(), DEPOSIT_AMOUNT);
    console.log(`Deposited ${DEPOSIT_AMOUNT / 1e6} USDC, principal: ${acct.principalBalance.toNumber()}`);
  });

  it("Y3. init_drift_user — activates Drift, bootstraps existing balance", async () => {
    const balBefore = await getTokenBalance(connection, accountAta);
    console.log(`ATA balance before init_drift_user: ${balBefore.toNumber()}`);

    const ownerSolBal = await connection.getBalance(owner.publicKey);
    console.log(`Owner SOL balance: ${ownerSolBal / web3.LAMPORTS_PER_SOL}`);

    console.log(`Drift accounts:`);
    console.log(`  driftUser: ${driftUser.toString()}`);
    console.log(`  driftUserStats: ${driftUserStats.toString()}`);
    console.log(`  driftState: ${DRIFT_STATE.toString()}`);
    console.log(`  driftSpotMarketVault: ${getDriftSpotMarketVaultPDA(USDC_MARKET_INDEX).toString()}`);
    console.log(`  driftSpotMarket: ${getDriftSpotMarketPDA(USDC_MARKET_INDEX).toString()}`);
    console.log(`  driftOracle: ${USDC_ORACLE.toString()}`);

    // Build and send tx manually to capture signature + logs on failure
    const ix = await program.methods
      .initDriftUser(0, stringToBytes32("silkysig-test"), USDC_MARKET_INDEX)
      .accounts({
        owner: owner.publicKey,
        silkAccount: accountPda,
        mint: USDC_MINT,
        accountTokenAccount: accountAta,
        driftUser: driftUser,
        driftUserStats: driftUserStats,
        driftState: DRIFT_STATE,
        driftSpotMarketVault: getDriftSpotMarketVaultPDA(USDC_MARKET_INDEX),
        driftSpotMarket: getDriftSpotMarketPDA(USDC_MARKET_INDEX),
        driftOracle: USDC_ORACLE,
        driftProgram: DRIFT_PROGRAM,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = new Transaction().add(ix);
    tx.feePayer = owner.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(owner);

    // sendRawTransaction returns the signature immediately regardless of outcome
    const txSig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    console.log(`Sent init_drift_user tx: ${txSig}`);

    // Wait for confirmation
    const result = await connection.confirmTransaction(txSig, "confirmed");
    console.log(`Confirmation result: ${JSON.stringify(result.value)}`);

    // Always fetch the transaction logs
    await new Promise(r => setTimeout(r, 2000));
    const txDetails = await connection.getTransaction(txSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (txDetails?.meta?.logMessages) {
      console.log("Transaction logs:");
      txDetails.meta.logMessages.forEach((log: string) => console.log(`  ${log}`));
    }

    // If there was an error, fail with details
    if (result.value.err) {
      throw new Error(`init_drift_user failed: ${JSON.stringify(result.value.err)}`);
    }

    const acct = await program.account.silkAccount.fetch(accountPda);
    assert.isNotNull(acct.driftUser, "drift_user should be set");
    assert.deepEqual(acct.driftUser, driftUser);
    assert.equal(acct.driftMarketIndex, USDC_MARKET_INDEX);
    assert.equal(acct.principalBalance.toNumber(), DEPOSIT_AMOUNT);

    // ATA should be drained (funds moved to Drift)
    const balAfter = await getTokenBalance(connection, accountAta);
    console.log(`ATA balance after init_drift_user: ${balAfter.toNumber()}`);
    assert.equal(balAfter.toNumber(), 0, "ATA should be empty after bootstrap deposit to Drift");
    console.log(`Drift user initialized, bootstrapped ${DEPOSIT_AMOUNT / 1e6} USDC into Drift`);
  });

  it("Y4. deposit with Drift — deposits go through to Drift via remaining accounts", async () => {
    const additionalDeposit = 3_000_000; // 3 USDC

    await program.methods
      .deposit(new BN(additionalDeposit))
      .accounts({
        depositor: owner.publicKey,
        silkAccount: accountPda,
        mint: USDC_MINT,
        accountTokenAccount: accountAta,
        depositorTokenAccount: ownerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(buildDepositRemainingAccounts(accountPda))
      .signers([owner])
      .rpc({ skipPreflight: true });

    // ATA should still be 0 (tokens went to Drift)
    const ataBalance = await getTokenBalance(connection, accountAta);
    assert.equal(ataBalance.toNumber(), 0, "ATA should remain empty — tokens forwarded to Drift");

    const acct = await program.account.silkAccount.fetch(accountPda);
    assert.equal(acct.principalBalance.toNumber(), DEPOSIT_AMOUNT + additionalDeposit);
    console.log(`Deposited ${additionalDeposit / 1e6} USDC via Drift, principal: ${acct.principalBalance.toNumber() / 1e6}`);
  });

  it("Y5. transfer_from_account with Drift — withdraws from Drift, sends to recipient", async () => {
    const recipient = Keypair.generate();

    // Fund recipient with SOL for ATA creation
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: recipient.publicKey,
        lamports: 0.01 * web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(fundTx);

    const recipientAta = getAta(USDC_MINT, recipient.publicKey);

    await program.methods
      .transferFromAccount(new BN(TRANSFER_AMOUNT))
      .accounts({
        signer: owner.publicKey,
        silkAccount: accountPda,
        mint: USDC_MINT,
        accountTokenAccount: accountAta,
        recipient: recipient.publicKey,
        recipientTokenAccount: recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(buildWithdrawRemainingAccounts(accountPda))
      .signers([owner])
      .rpc({ skipPreflight: true });

    const recipientBal = await getTokenBalance(connection, recipientAta);
    assert.equal(recipientBal.toNumber(), TRANSFER_AMOUNT);

    const acct = await program.account.silkAccount.fetch(accountPda);
    const expectedPrincipal = DEPOSIT_AMOUNT + 3_000_000 - TRANSFER_AMOUNT;
    assert.equal(acct.principalBalance.toNumber(), expectedPrincipal);
    console.log(`Transferred ${TRANSFER_AMOUNT / 1e6} USDC to recipient, principal: ${acct.principalBalance.toNumber() / 1e6}`);
  });

  it("Y6. close_account with Drift — withdraws remaining from Drift, sweeps to owner", async () => {
    const acctBefore = await program.account.silkAccount.fetch(accountPda);
    const remainingPrincipal = acctBefore.principalBalance.toNumber();
    console.log(`Remaining principal before close: ${remainingPrincipal / 1e6} USDC`);

    const ownerBalBefore = await getTokenBalance(connection, ownerAta);

    // Build instruction manually — Anchor TS close constraint conflicts with remainingAccounts
    const closeIx = await program.methods
      .closeAccount()
      .accounts({
        owner: owner.publicKey,
        silkAccount: accountPda,
        mint: USDC_MINT,
        accountTokenAccount: accountAta,
        ownerTokenAccount: ownerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(buildWithdrawRemainingAccounts(accountPda))
      .instruction();

    const closeTx = new Transaction().add(closeIx);
    closeTx.feePayer = owner.publicKey;
    closeTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    closeTx.sign(owner);

    const closeSig = await connection.sendRawTransaction(closeTx.serialize(), { skipPreflight: true });
    console.log(`Sent close_account tx: ${closeSig}`);

    // Use try/catch on confirmTransaction since it throws on failure
    let closeErr: any = null;
    try {
      await connection.confirmTransaction(closeSig, "confirmed");
    } catch (e) {
      closeErr = e;
    }

    // Always fetch logs regardless of success/failure
    await new Promise(r => setTimeout(r, 2000));
    const closeTxDetails = await connection.getTransaction(closeSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (closeTxDetails?.meta?.logMessages) {
      console.log("Close transaction logs:");
      closeTxDetails.meta.logMessages.forEach((log: string) => console.log(`  ${log}`));
    }
    if (closeTxDetails?.meta?.err) {
      throw new Error(`close_account failed: ${JSON.stringify(closeTxDetails.meta.err)}`);
    }
    if (closeErr) throw closeErr;

    // Owner should have received the remaining USDC (plus any yield accrued)
    const ownerBalAfter = await getTokenBalance(connection, ownerAta);
    const received = ownerBalAfter.sub(ownerBalBefore).toNumber();
    // Allow 1 unit rounding loss from Drift's scaled balance accounting
    assert.isAtLeast(received, remainingPrincipal - 1, "Owner should receive approximately the principal");
    console.log(`Owner received ${received / 1e6} USDC on close (principal was ${remainingPrincipal / 1e6})`);

    // Silk account PDA should be gone
    const accountInfo = await connection.getAccountInfo(accountPda);
    assert.isNull(accountInfo, "Silk account should be closed");

    // ATA should be gone
    const ataInfo = await connection.getAccountInfo(accountAta);
    assert.isNull(ataInfo, "Account ATA should be closed");

    console.log("Account closed successfully");
  });
});
