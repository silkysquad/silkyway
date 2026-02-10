use anchor_lang::prelude::*;
use crate::{state::*, errors::*, constants::*};

pub fn remove_operator(ctx: Context<RemoveOperator>, operator: Pubkey) -> Result<()> {
    let account = &mut ctx.accounts.silk_account;

    let idx = account.find_operator(&operator)
        .ok_or(SilkysigError::OperatorNotFound)?;

    let last = (account.operator_count - 1) as usize;
    if idx != last {
        account.operators[idx] = account.operators[last];
    }
    account.operators[last] = OperatorSlot::default();
    account.operator_count -= 1;

    emit!(OperatorRemoved {
        account: account.key(),
        owner: account.owner,
        operator,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RemoveOperator<'info> {
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
pub struct OperatorRemoved {
    pub account: Pubkey,
    pub owner: Pubkey,
    pub operator: Pubkey,
}
