use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{debug_msg, constants::*, errors::*, state::*};

pub fn init_drift_user(
    ctx: Context<InitDriftUser>,
    sub_account_id: u16,
    name: [u8; 32],
    market_index: u16,
) -> Result<()> {
    let account = &mut ctx.accounts.silk_account;

    // Guard: drift user not already initialized
    require!(
        account.drift_user.is_none(),
        SilkysigError::DriftUserAlreadyInitialized
    );

    // Build signer seeds for silk_account PDA
    let owner_key = account.owner;
    let account_seeds = &[
        ACCOUNT_SEED,
        owner_key.as_ref(),
        &[account.bump],
    ];
    let signer_seeds = &[&account_seeds[..]];

    // CPI 1: Initialize user stats
    drift_cpi::cpi::initialize_user_stats(
        CpiContext::new_with_signer(
            ctx.accounts.drift_program.to_account_info(),
            drift_cpi::cpi::accounts::InitializeUserStats {
                authority: account.to_account_info(),
                payer: ctx.accounts.owner.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                state: ctx.accounts.drift_state.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                user_stats: ctx.accounts.drift_user_stats.to_account_info(),
            },
            signer_seeds,
        ),
    )?;

    // CPI 2: Initialize user
    drift_cpi::cpi::initialize_user(
        CpiContext::new_with_signer(
            ctx.accounts.drift_program.to_account_info(),
            drift_cpi::cpi::accounts::InitializeUser {
                user: ctx.accounts.drift_user.to_account_info(),
                user_stats: ctx.accounts.drift_user_stats.to_account_info(),
                authority: account.to_account_info(),
                payer: ctx.accounts.owner.to_account_info(),
                state: ctx.accounts.drift_state.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
            },
            signer_seeds,
        ),
        sub_account_id,
        name,
    )?;

    // Bootstrap: if ATA has existing balance, deposit into Drift
    let existing_balance = ctx.accounts.account_token_account.amount;
    if existing_balance > 0 {
        let deposit_accounts = drift_cpi::cpi::accounts::Deposit {
            state: ctx.accounts.drift_state.to_account_info(),
            user: ctx.accounts.drift_user.to_account_info(),
            user_stats: ctx.accounts.drift_user_stats.to_account_info(),
            authority: account.to_account_info(),
            spot_market_vault: ctx.accounts.drift_spot_market_vault.to_account_info(),
            user_token_account: ctx.accounts.account_token_account.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };

        let drift_remaining = vec![
            ctx.accounts.drift_oracle.to_account_info(),
            ctx.accounts.drift_spot_market.to_account_info(),
        ];

        let deposit_ctx = CpiContext::new_with_signer(
            ctx.accounts.drift_program.to_account_info(),
            deposit_accounts,
            signer_seeds,
        )
        .with_remaining_accounts(drift_remaining);

        match drift_cpi::cpi::deposit(deposit_ctx, market_index, existing_balance, false) {
            Ok(_) => {}
            Err(_e) => {
                debug_msg!("Drift bootstrap deposit failed: {:?}", _e);
                return Err(SilkysigError::DriftDepositFailed.into());
            }
        }
    }

    // Set drift state on silk account.
    // principal_balance is NOT modified here — the deposit instruction already
    // tracked the funds. The bootstrap just moves them from ATA to Drift.
    account.drift_user = Some(ctx.accounts.drift_user.key());
    account.drift_market_index = Some(market_index);

    emit!(DriftUserInitialized {
        account: account.key(),
        owner: account.owner,
        drift_user: ctx.accounts.drift_user.key(),
        market_index,
        bootstrap_amount: existing_balance,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(sub_account_id: u16, name: [u8; 32], market_index: u16)]
pub struct InitDriftUser<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [ACCOUNT_SEED, owner.key().as_ref()],
        bump = silk_account.bump,
        has_one = owner,
    )]
    pub silk_account: Box<Account<'info, SilkAccount>>,

    #[account(
        constraint = mint.key() == silk_account.mint
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// Account PDA's token account
    #[account(
        mut,
        associated_token::mint = silk_account.mint,
        associated_token::authority = silk_account,
        associated_token::token_program = token_program
    )]
    pub account_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: Drift program validates this account
    #[account(mut)]
    pub drift_user: AccountInfo<'info>,

    /// CHECK: Drift program validates this account
    #[account(mut)]
    pub drift_user_stats: AccountInfo<'info>,

    /// CHECK: Drift program validates this account
    #[account(mut)]
    pub drift_state: AccountInfo<'info>,

    /// CHECK: Drift spot market vault
    #[account(mut)]
    pub drift_spot_market_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: Drift spot market
    #[account(mut)]
    pub drift_spot_market: AccountInfo<'info>,

    /// CHECK: Drift oracle
    pub drift_oracle: AccountInfo<'info>,

    /// CHECK: Verified by address constraint
    #[account(address = drift_cpi::ID)]
    pub drift_program: AccountInfo<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct DriftUserInitialized {
    pub account: Pubkey,
    pub owner: Pubkey,
    pub drift_user: Pubkey,
    pub market_index: u16,
    pub bootstrap_amount: u64,
}
