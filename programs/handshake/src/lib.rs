use anchor_lang::prelude::*;

declare_id!("HZ8paEkYZ2hKBwHoVk23doSLEad9K5duASRTGaYogmfg");

#[program]
pub mod handshake {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
