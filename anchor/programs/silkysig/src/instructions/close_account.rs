use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        transfer_checked, close_account as spl_close_account,
        TransferChecked, CloseAccount as SplCloseAccount,
        Mint, TokenAccount, TokenInterface,
    },
};
use crate::{state::*, constants::*};

pub fn close_account(ctx: Context<CloseAccount>) -> Result<()> {
    let account = &ctx.accounts.silk_account;
    let owner_key = account.owner;
    let account_seeds = &[
        ACCOUNT_SEED,
        owner_key.as_ref(),
        &[account.bump],
    ];
    let signer_seeds = &[&account_seeds[..]];

    let swept_amount = ctx.accounts.account_token_account.amount;

    // 1. Sweep remaining tokens to owner's ATA
    if swept_amount > 0 {
        let transfer_accounts = TransferChecked {
            from: ctx.accounts.account_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.owner_token_account.to_account_info(),
            authority: ctx.accounts.silk_account.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
            signer_seeds,
        );
        transfer_checked(cpi_ctx, swept_amount, ctx.accounts.mint.decimals)?;
    }

    // 2. Close the PDA's ATA (rent lamports → owner)
    let close_accounts = SplCloseAccount {
        account: ctx.accounts.account_token_account.to_account_info(),
        destination: ctx.accounts.owner.to_account_info(),
        authority: ctx.accounts.silk_account.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        close_accounts,
        signer_seeds,
    );
    spl_close_account(cpi_ctx)?;

    // 3. Anchor's `close = owner` constraint handles closing the SilkAccount PDA

    emit!(AccountClosed {
        account: ctx.accounts.silk_account.key(),
        owner: owner_key,
        swept_amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CloseAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [ACCOUNT_SEED, owner.key().as_ref()],
        bump = silk_account.bump,
        has_one = owner,
        close = owner,
    )]
    pub silk_account: Box<Account<'info, SilkAccount>>,

    #[account(
        constraint = mint.key() == silk_account.mint
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = silk_account.mint,
        associated_token::authority = silk_account,
        associated_token::token_program = token_program,
    )]
    pub account_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub owner_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct AccountClosed {
    pub account: Pubkey,
    pub owner: Pubkey,
    pub swept_amount: u64,
}
