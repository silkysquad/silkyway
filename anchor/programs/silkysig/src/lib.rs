use anchor_lang::prelude::*;

mod constants;
mod errors;
mod instructions;
mod state;

use instructions::*;
use state::*;

/// Log a message only when the `debug` feature is enabled.
/// Compiles to a no-op in production, saving compute units.
#[macro_export]
macro_rules! debug_msg {
    ($($arg:tt)*) => {
        #[cfg(feature = "debug")]
        msg!($($arg)*);
    };
}

declare_id!("SiLKos3MCFggwLsjSeuRiCdcs2MLoJNwq59XwTvEwcS");

#[program]
pub mod silkysig {
    use super::*;

    pub fn create_account(
        ctx: Context<CreateAccount>,
    ) -> Result<()> {
        instructions::create_account(ctx)
    }

    pub fn deposit<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, Deposit<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::deposit(ctx, amount)
    }

    pub fn transfer_from_account<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, TransferFromAccount<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::transfer_from_account(ctx, amount)
    }

    pub fn toggle_pause(ctx: Context<TogglePause>) -> Result<()> {
        instructions::toggle_pause(ctx)
    }

    pub fn add_operator(ctx: Context<AddOperator>, operator: Pubkey, per_tx_limit: Option<u64>) -> Result<()> {
        instructions::add_operator(ctx, operator, per_tx_limit)
    }

    pub fn remove_operator(ctx: Context<RemoveOperator>, operator: Pubkey) -> Result<()> {
        instructions::remove_operator(ctx, operator)
    }

    pub fn init_drift_user(
        ctx: Context<InitDriftUser>,
        sub_account_id: u16,
        name: [u8; 32],
        market_index: u16,
    ) -> Result<()> {
        instructions::init_drift_user(ctx, sub_account_id, name, market_index)
    }

    pub fn close_account<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, CloseAccount<'info>>,
    ) -> Result<()> {
        instructions::close_account(ctx)
    }
}
