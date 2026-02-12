use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        transfer_checked, TransferChecked, Mint, TokenAccount, TokenInterface,
    },
};
use crate::{debug_msg, state::*, errors::*, constants::*};

pub fn transfer_from_account<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, TransferFromAccount<'info>>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, SilkysigError::AmountMustBePositive);

    let account = &mut ctx.accounts.silk_account;
    let signer_key = ctx.accounts.signer.key();

    // Determine signer role for access control and event enrichment
    let is_owner = signer_key == account.owner;

    if is_owner {
        // Owner: no policy checks
    } else if let Some(idx) = account.find_operator(&signer_key) {
        // Operator: enforce policies
        require!(!account.is_paused, SilkysigError::AccountPaused);

        let operator = &account.operators[idx];
        // per_tx_limit == 0 means unlimited
        if operator.per_tx_limit > 0 {
            require!(amount <= operator.per_tx_limit, SilkysigError::ExceedsPerTxLimit);
        }
    } else {
        return Err(SilkysigError::Unauthorized.into());
    }

    // If Drift is initialized, withdraw tokens from Drift first
    if account.drift_user.is_some() {
        let remaining = &ctx.remaining_accounts;
        require!(remaining.len() >= 8, SilkysigError::MissingDriftAccounts);

        let drift_state = &remaining[0];
        let drift_user = &remaining[1];
        let drift_user_stats = &remaining[2];
        let drift_spot_market_vault = &remaining[3];
        let drift_signer = &remaining[4];
        let drift_program = &remaining[5];
        let drift_oracle = &remaining[6];
        let drift_spot_market = &remaining[7];

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
        let pda_signer_seeds = &[&account_seeds[..]];

        let withdraw_accounts = drift_cpi::cpi::accounts::Withdraw {
            state: drift_state.to_account_info(),
            user: drift_user.to_account_info(),
            user_stats: drift_user_stats.to_account_info(),
            authority: account.to_account_info(),
            spot_market_vault: drift_spot_market_vault.to_account_info(),
            drift_signer: drift_signer.to_account_info(),
            user_token_account: ctx.accounts.account_token_account.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };

        let drift_remaining = vec![
            drift_oracle.to_account_info(),
            drift_spot_market.to_account_info(),
        ];

        let withdraw_ctx = CpiContext::new_with_signer(
            drift_program.to_account_info(),
            withdraw_accounts,
            pda_signer_seeds,
        )
        .with_remaining_accounts(drift_remaining);

        match drift_cpi::cpi::withdraw(withdraw_ctx, market_index, amount, false) {
            Ok(_) => {}
            Err(_e) => {
                debug_msg!("Drift withdraw failed: {:?}", _e);
                return Err(SilkysigError::DriftWithdrawFailed.into());
            }
        }
    }

    // Transfer tokens from account PDA's ATA to recipient's ATA
    let owner_key = account.owner;
    let account_seeds = &[
        ACCOUNT_SEED,
        owner_key.as_ref(),
        &[account.bump],
    ];
    let signer_seeds = &[&account_seeds[..]];

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.account_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: account.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
        signer_seeds,
    );
    transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    // Update principal balance (checked to surface accounting bugs)
    account.principal_balance = account
        .principal_balance
        .checked_sub(amount)
        .ok_or(SilkysigError::MathOverflow)?;

    emit!(TransferExecuted {
        account: ctx.accounts.silk_account.key(),
        signer: signer_key,
        recipient: ctx.accounts.recipient.key(),
        mint: ctx.accounts.mint.key(),
        amount,
        is_owner,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct TransferFromAccount<'info> {
    /// Owner or operator — pays for recipient ATA init if needed
    #[account(mut)]
    pub signer: Signer<'info>,

    /// The Silk account to transfer from
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

    /// Account PDA's token account (source)
    #[account(
        mut,
        associated_token::mint = silk_account.mint,
        associated_token::authority = silk_account,
        associated_token::token_program = token_program
    )]
    pub account_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: Recipient address — only used as ATA derivation authority
    pub recipient: AccountInfo<'info>,

    /// Recipient's token account — initialized if needed, signer pays rent
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program
    )]
    pub recipient_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct TransferExecuted {
    pub account: Pubkey,
    pub signer: Pubkey,
    pub recipient: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub is_owner: bool,
}
