use anchor_lang::prelude::*;

#[error_code]
pub enum SilkysigError {
    #[msg("Unauthorized: signer is not owner or operator")]
    Unauthorized,

    #[msg("Transfer exceeds operator per-transaction limit")]
    ExceedsPerTxLimit,

    #[msg("Account is paused")]
    AccountPaused,

    #[msg("Maximum operators reached")]
    MaxOperatorsReached,

    #[msg("Operator not found")]
    OperatorNotFound,

    #[msg("Operator slot already occupied")]
    OperatorAlreadyExists,

    #[msg("Mathematical overflow")]
    MathOverflow,

    #[msg("Amount must be greater than zero")]
    AmountMustBePositive,

    #[msg("Drift user already initialized for this account")]
    DriftUserAlreadyInitialized,

    #[msg("Drift deposit failed")]
    DriftDepositFailed,

    #[msg("Drift withdraw failed")]
    DriftWithdrawFailed,

    #[msg("Invalid Drift user account")]
    InvalidDriftUser,

    #[msg("Missing required Drift accounts")]
    MissingDriftAccounts,

    #[msg("Invalid Drift program")]
    InvalidDriftProgram,

    #[msg("Failed to delete Drift user account")]
    DriftDeleteUserFailed,
}
