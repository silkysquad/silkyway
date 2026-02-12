use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::{state::*, constants::*};

pub fn create_account(
    ctx: Context<CreateAccount>,
) -> Result<()> {
    let account = &mut ctx.accounts.silk_account;

    account.version = 1;
    account.bump = ctx.bumps.silk_account;
    account.owner = ctx.accounts.owner.key();
    account.mint = ctx.accounts.mint.key();
    account.is_paused = false;
    account.operator_count = 0;
    account.operators = [OperatorSlot::default(); MAX_OPERATORS];
    account.drift_user = None;
    account.drift_market_index = None;
    account.principal_balance = 0;
    account._reserved = [0u8; 64];

    emit!(AccountCreated {
        account: account.key(),
        owner: account.owner,
        mint: account.mint,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// The token mint this account will hold
    pub mint: InterfaceAccount<'info, Mint>,

    /// Account PDA — one per owner
    #[account(
        init,
        payer = owner,
        space = SilkAccount::SPACE,
        seeds = [ACCOUNT_SEED, owner.key().as_ref()],
        bump
    )]
    pub silk_account: Box<Account<'info, SilkAccount>>,

    /// Account's token account — initialized eagerly so direct SPL transfers work immediately
    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = silk_account,
        associated_token::token_program = token_program
    )]
    pub account_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct AccountCreated {
    pub account: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
}
