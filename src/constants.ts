import type { Endpoint } from './types'

export const APP_NAME = 'Secret NFT Rescue'
export const APP_VERSION = '0.1.0'
export const CHAIN_ID = 'secret-4'
export const SNAPSHOT_LABEL = 'Sep 1, 2026'
export const STORAGE_KEY = 'secret-nft-rescue.collections.v1'

export const DEFAULT_ENDPOINTS: Endpoint[] = [
  {
    id: 'lavender-five',
    label: 'Lavender.Five',
    lcdUrl: 'https://secretnetwork-api.lavenderfive.com:443',
    source: 'Secret docs',
  },
  {
    id: 'secret-saturn',
    label: 'Secret Saturn',
    lcdUrl: 'https://lcd.mainnet.secretsaturn.net',
    source: 'Secret docs',
  },
  {
    id: 'one-rpc',
    label: '1RPC',
    lcdUrl: 'https://1rpc.io/scrt-lcd',
    source: 'Secret docs',
  },
  {
    id: 'node-01',
    label: '01node',
    lcdUrl: 'https://rest-secret.01node.com',
    source: 'Secret docs',
  },
  {
    id: 'stakewolle',
    label: 'Stakewolle',
    lcdUrl: 'https://public.stakewolle.com/cosmos/secretnetwork/rest',
    source: 'chain-registry',
  },
]

export const EMPTY_COLLECTION_FORM = {
  name: '',
  contractAddress: '',
  codeHash: '',
  tokenIds: '',
  notes: '',
}
