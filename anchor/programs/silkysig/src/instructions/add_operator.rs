use anchor_lang::prelude::*;
use crate::{state::*, errors::*, constants::*};

pub fn add_operator(ctx: Context<AddOperator>, operator: Pubkey, per_tx_limit: u64) -> Result<()> {
    let account = &mut ctx.accounts.silk_account;
    let count = account.operator_count as usize;

    require!(count < MAX_OPERATORS, SilkysigError::MaxOperatorsReached);
    require!(account.find_operator(&operator).is_none(), SilkysigError::OperatorAlreadyExists);

    account.operators[count] = OperatorSlot {
        pubkey: operator,
        per_tx_limit,
        daily_limit: 0,
        daily_spent: 0,
        last_reset: 0,
    };
    account.operator_count += 1;

    emit!(OperatorAdded {
        account: account.key(),
        owner: account.owner,
        operator,
        per_tx_limit,
        slot_index: count as u8,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct AddOperator<'info> {
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
pub struct OperatorAdded {
    pub account: Pubkey,
    pub owner: Pubkey,
    pub operator: Pubkey,
    pub per_tx_limit: u64,
    pub slot_index: u8,
}
