use anchor_lang::prelude::*;

pub const MAX_OPERATORS: usize = 3;

#[account]
pub struct SilkAccount {
    /// Version for future upgrades
    pub version: u8,

    /// PDA bump
    pub bump: u8,

    /// Account owner (human) — full control, bypasses all policies
    pub owner: Pubkey,

    /// Token mint this account holds
    pub mint: Pubkey,

    /// Circuit breaker — paused accounts block all operator transfers
    pub is_paused: bool,

    /// Number of active operators (0-3)
    pub operator_count: u8,

    /// Operator slots — each with independent policy
    pub operators: [OperatorSlot; MAX_OPERATORS],

    /// Drift user account pubkey (None = Drift not initialized)
    pub drift_user: Option<Pubkey>,

    /// Drift spot market index (None = Drift not initialized)
    pub drift_market_index: Option<u16>,

    /// Principal balance deposited (for bookkeeping, not yield calculation)
    pub principal_balance: u64,

    /// Reserved for future fields (avoids realloc migrations)
    pub _reserved: [u8; 64],
}

impl SilkAccount {
    pub const SPACE: usize = 8  // discriminator
        + 1                     // version
        + 1                     // bump
        + 32                    // owner
        + 32                    // mint
        + 1                     // is_paused
        + 1                     // operator_count
        + (MAX_OPERATORS * OperatorSlot::SPACE) // operators
        + 33                    // drift_user (Option<Pubkey>)
        + 3                     // drift_market_index (Option<u16>)
        + 8                     // principal_balance
        + 64;                   // _reserved

    /// Find the operator slot index for a given pubkey.
    /// Returns None if the pubkey is not an active operator.
    pub fn find_operator(&self, pubkey: &Pubkey) -> Option<usize> {
        for i in 0..self.operator_count as usize {
            if self.operators[i].pubkey == *pubkey {
                return Some(i);
            }
        }
        None
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct OperatorSlot {
    /// Operator public key (Pubkey::default() = empty slot)
    pub pubkey: Pubkey,

    /// Max amount per transaction in token smallest units (must be > 0; u64::MAX = effectively unlimited)
    pub per_tx_limit: u64,

    /// Reserved for future use (daily limits, etc.)
    pub _reserved: [u8; 24],
}

impl Default for OperatorSlot {
    fn default() -> Self {
        Self {
            pubkey: Pubkey::default(),
            per_tx_limit: 0,
            _reserved: [0u8; 24],
        }
    }
}

impl OperatorSlot {
    pub const SPACE: usize = 32  // pubkey
        + 8                      // per_tx_limit
        + 24;                    // _reserved
}
