use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        transfer_checked, close_account as spl_close_account,
        TransferChecked, CloseAccount as SplCloseAccount,
        Mint, TokenAccount, TokenInterface,
    },
};
use crate::{debug_msg, state::*, errors::*, constants::*};

pub fn close_account<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, CloseAccount<'info>>,
) -> Result<()> {
    let account = &ctx.accounts.silk_account;
    let owner_key = account.owner;
    let account_seeds = &[
        ACCOUNT_SEED,
        owner_key.as_ref(),
        &[account.bump],
    ];
    let signer_seeds = &[&account_seeds[..]];

    // If Drift is initialized, withdraw everything and clean up Drift accounts
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

        // Withdraw all funds from Drift. u64::MAX + reduce_only=true tells Drift
        // to withdraw the full balance without risking InsufficientCollateral errors.
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
            signer_seeds,
        )
        .with_remaining_accounts(drift_remaining);

        match drift_cpi::cpi::withdraw(withdraw_ctx, market_index, u64::MAX, true) {
            Ok(_) => {}
            Err(_e) => {
                debug_msg!("Drift withdraw failed: {:?}", _e);
                return Err(SilkysigError::DriftWithdrawFailed.into());
            }
        }

        // Refresh token account balance after Drift withdrawal
        ctx.accounts.account_token_account.reload()?;

        // Drift requires the user account to be "idle" for ~13 days
        // (~1,123,200 slots) before delete_user is allowed (error 6152:
        // UserCantBeDeleted). After the withdrawal above the Drift user has
        // zero balance but cannot be deleted yet. A dedicated
        // `cleanup_drift_user` instruction can be added later to reclaim the
        // rent once the idle period has elapsed.
        //
        // let delete_user_accounts = drift_cpi::cpi::accounts::DeleteUser {
        //     user: drift_user.to_account_info(),
        //     user_stats: drift_user_stats.to_account_info(),
        //     state: drift_state.to_account_info(),
        //     authority: account.to_account_info(),
        // };
        // drift_cpi::cpi::delete_user(
        //     CpiContext::new_with_signer(
        //         drift_program.to_account_info(),
        //         delete_user_accounts,
        //         signer_seeds,
        //     ),
        // )?;
    }

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

    // 2. Close the PDA's ATA (rent lamports -> owner)
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
