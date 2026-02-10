use anchor_lang::prelude::*;
use crate::{state::*, constants::*};

pub fn toggle_pause(ctx: Context<TogglePause>) -> Result<()> {
    let account = &mut ctx.accounts.silk_account;
    account.is_paused = !account.is_paused;

    emit!(AccountPauseToggled {
        account: account.key(),
        owner: account.owner,
        is_paused: account.is_paused,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct TogglePause<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [ACCOUNT_SEED, owner.key().as_ref()],
        bump = silk_account.bump,
        has_one = owner,
    )]
    pub silk_account: Box<Account<'info, SilkAccount>>,
}

#[event]
pub struct AccountPauseToggled {
    pub account: Pubkey,
    pub owner: Pubkey,
    pub is_paused: bool,
}
