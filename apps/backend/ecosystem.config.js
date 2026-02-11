module.exports = {
  apps: [
    {
      name: 'silkyway-mainnet',
      script: 'dist/main.js',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
        SOLANA_CLUSTER: 'mainnet-beta',
        RPC_URL: 'https://api.mainnet-beta.solana.com',
        USDC_MINT_ADDRESS: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        // DATABASE_HOST, DATABASE_NAME, etc. — set per deployment
      },
    },
    {
      name: 'silkyway-devnet',
      script: 'dist/main.js',
      env: {
        PORT: 3001,
        NODE_ENV: 'production',
        SOLANA_CLUSTER: 'devnet',
        RPC_URL: 'https://api.devnet.solana.com',
        USDC_MINT_ADDRESS: '', // from setup-devnet.ts
        // DATABASE_HOST, DATABASE_NAME, etc. — set per deployment
      },
    },
  ],
};
