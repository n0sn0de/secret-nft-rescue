import type { OfflineAminoSigner } from '@cosmjs/amino'
import type { EncryptionUtils } from 'secretjs'

type SecretWalletApi = {
  enable: (chainId: string) => Promise<void>
  getOfflineSignerOnlyAmino?: (chainId: string) => OfflineAminoSigner
  getOfflineSigner?: (chainId: string) => OfflineAminoSigner
  getEnigmaUtils?: (chainId: string) => EncryptionUtils
  experimentalSuggestChain?: (chainInfo: unknown) => Promise<void>
}

declare global {
  interface Window {
    keplr?: SecretWalletApi
    leap?: SecretWalletApi
    getOfflineSignerOnlyAmino?: (chainId: string) => OfflineAminoSigner
    getOfflineSigner?: (chainId: string) => OfflineAminoSigner
    getEnigmaUtils?: (chainId: string) => EncryptionUtils
  }
}

export {}
