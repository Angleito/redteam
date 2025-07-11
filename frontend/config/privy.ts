import { defineChain } from 'viem'
import { 
  getPrivyWalletListForChain, 
  getPrivyLoginMethodsForChain, 
  shouldDisableEmbeddedWalletsForChain 
} from '../utils/walletCompatibility'
import { envConfig } from '../utils/envValidation'

// Sei Network chain configuration
export const seiMainnet = defineChain({
  id: 1329,
  name: 'Sei Network',
  network: 'sei',
  nativeCurrency: {
    decimals: 18,
    name: 'SEI',
    symbol: 'SEI',
  },
  rpcUrls: {
    default: { http: ['https://evm-rpc.sei-apis.com'] },
    public: { http: ['https://evm-rpc.sei-apis.com'] },
  },
  blockExplorers: {
    default: { name: 'SeiScan', url: 'https://seitrace.com' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
})

// Privy configuration using environment validation
const appId = envConfig.privyAppId
const clientId = envConfig.privyClientId

// Debug logging with safe fallbacks
console.log('🔐 Privy Configuration Status:');
console.log('- App ID present:', !!appId);
console.log('- App ID length:', appId?.length || 0);
console.log('- Environment:', import.meta.env.MODE);
console.log('- Client ID present:', !!clientId);
console.log('- Configuration valid:', envConfig.isValid.privy);

// Warn if missing in production
if (import.meta.env.PROD && !envConfig.isValid.privy) {
  console.warn('⚠️ Privy not properly configured in production environment');
}

// Get compatible wallets and login methods for Sei Network
const seiChainId = seiMainnet.id
const supportedWallets = getPrivyWalletListForChain(seiChainId)
const supportedLoginMethods = getPrivyLoginMethodsForChain(seiChainId)
const shouldDisableEmbedded = shouldDisableEmbeddedWalletsForChain(seiChainId)

console.log('🔗 Wallet Compatibility for Sei Network:')
console.log('- Supported wallets:', supportedWallets)
console.log('- Supported login methods:', supportedLoginMethods)
console.log('- Embedded wallets disabled:', shouldDisableEmbedded)
console.log('- Coinbase Smart Wallet excluded:', !supportedWallets.includes('coinbase_smart_wallet'))

// Ensure config is always defined with proper structure
const defaultConfig = {
  appearance: {
    theme: 'dark' as const,
    accentColor: '#ef4444' as const, // Red accent color for UI consistency
    logo: undefined, // No logo needed
    showWalletLoginFirst: true,
  },
  // Use compatible login methods (excludes email if embedded wallets are disabled)
  loginMethods: supportedLoginMethods as ('email' | 'wallet' | 'google' | 'discord' | 'twitter')[],
  // Wallet configuration - only include supported wallets (explicitly exclude Coinbase Smart Wallet)
  wallets: {
    walletList: supportedWallets.filter(wallet => 
      wallet !== 'coinbase_smart_wallet' && 
      wallet !== 'coinbase_wallet' && 
      wallet !== 'coinbase'
    ),
    showWalletLoginFirst: true,
  },
  // Embedded wallet configuration - disable if not supported
  embeddedWallets: shouldDisableEmbedded ? {
    createOnLogin: 'off' as const,
    requireUserPasswordOnCreate: false,
    noPromptOnSignature: true,
  } : {
    createOnLogin: 'users-without-wallets' as const,
    requireUserPasswordOnCreate: true,
    noPromptOnSignature: false,
  },
  // Chain configuration
  defaultChain: seiMainnet,
  supportedChains: [seiMainnet],
  // Advanced options
  clientAnalyticsEnabled: true,
  // Custom text
  customText: {
    connectButton: 'Power Up Wallet',
    connectModalTitle: 'Connect Your Wallet',
    connectModalSubtitle: 'Connect your wallet to manage your DeFi portfolio',
  },
};

// Export with guaranteed structure
export const privyConfig = {
  appId: appId || '',
  clientId: clientId || '',
  config: defaultConfig,
}

// Fail-safe getter
export const getPrivyConfig = () => {
  try {
    return privyConfig;
  } catch (error) {
    console.error('Error accessing privyConfig:', error);
    return {
      appId: '',
      clientId: '',
      config: defaultConfig,
    };
  }
};