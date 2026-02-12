use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, TransferChecked, Mint, TokenAccount, TokenInterface,
};
use crate::{debug_msg, state::*, errors::*, constants::*};

pub fn deposit<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, Deposit<'info>>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, SilkysigError::AmountMustBePositive);

    // SPL transfer from depositor to account ATA
    let transfer_accounts = TransferChecked {
        from: ctx.accounts.depositor_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.account_token_account.to_account_info(),
        authority: ctx.accounts.depositor.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
    );
    transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    // If Drift is initialized, forward tokens into Drift
    let account = &mut ctx.accounts.silk_account;
    if account.drift_user.is_some() {
        let remaining = &ctx.remaining_accounts;
        require!(remaining.len() >= 7, SilkysigError::MissingDriftAccounts);

        let drift_state = &remaining[0];
        let drift_user = &remaining[1];
        let drift_user_stats = &remaining[2];
        let drift_spot_market_vault = &remaining[3];
        let drift_program = &remaining[4];
        let drift_oracle = &remaining[5];
        let drift_spot_market = &remaining[6];

        // Validate drift program address
        require!(
            drift_program.key() == drift_cpi::ID,
            SilkysigError::InvalidDriftProgram
        );

        // Validate drift user matches account's stored key
        require!(
            drift_user.key() == account.drift_user.unwrap(),
            SilkysigError::InvalidDriftUser
        );

        let market_index = account.drift_market_index.unwrap();

        let owner_key = account.owner;
        let account_seeds = &[
            ACCOUNT_SEED,
            owner_key.as_ref(),
            &[account.bump],
        ];
        let signer_seeds = &[&account_seeds[..]];

        let deposit_accounts = drift_cpi::cpi::accounts::Deposit {
            state: drift_state.to_account_info(),
            user: drift_user.to_account_info(),
            user_stats: drift_user_stats.to_account_info(),
            authority: account.to_account_info(),
            spot_market_vault: drift_spot_market_vault.to_account_info(),
            user_token_account: ctx.accounts.account_token_account.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };

        let drift_remaining = vec![
            drift_oracle.to_account_info(),
            drift_spot_market.to_account_info(),
        ];

        let deposit_ctx = CpiContext::new_with_signer(
            drift_program.to_account_info(),
            deposit_accounts,
            signer_seeds,
        )
        .with_remaining_accounts(drift_remaining);

        match drift_cpi::cpi::deposit(deposit_ctx, market_index, amount, false) {
            Ok(_) => {}
            Err(_e) => {
                debug_msg!("Drift deposit failed: {:?}", _e);
                return Err(SilkysigError::DriftDepositFailed.into());
            }
        }
    }

    // Update principal balance
    account.principal_balance = account
        .principal_balance
        .checked_add(amount)
        .ok_or(SilkysigError::MathOverflow)?;

    emit!(Deposited {
        account: ctx.accounts.silk_account.key(),
        depositor: ctx.accounts.depositor.key(),
        mint: ctx.accounts.mint.key(),
        amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// The Silk account receiving the deposit
    #[account(
        mut,
        seeds = [ACCOUNT_SEED, silk_account.owner.as_ref()],
        bump = silk_account.bump,
    )]
    pub silk_account: Box<Account<'info, SilkAccount>>,

    /// Mint must match the account's mint
    #[account(
        constraint = mint.key() == silk_account.mint
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// Account PDA's token account (destination)
    #[account(
        mut,
        associated_token::mint = silk_account.mint,
        associated_token::authority = silk_account,
        associated_token::token_program = token_program
    )]
    pub account_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Depositor's token account (source)
    #[account(
        mut,
        associated_token::mint = silk_account.mint,
        associated_token::authority = depositor,
        associated_token::token_program = token_program
    )]
    pub depositor_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[event]
pub struct Deposited {
    pub account: Pubkey,
    pub depositor: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}
