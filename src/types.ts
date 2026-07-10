import type { Permit, SecretNetworkClient } from 'secretjs'

export type WalletProviderId = 'keplr' | 'leap'

export type Endpoint = {
  id: string
  label: string
  lcdUrl: string
  source: string
}

export type CollectionManifest = {
  id: string
  name: string
  contractAddress: string
  codeHash?: string
  tokenIds: string[]
  notes?: string
  source?: string
  addedAt: string
}

export type CollectionForm = {
  name: string
  contractAddress: string
  codeHash: string
  tokenIds: string
  notes: string
}

export type WalletConnection = {
  address: string
  provider: WalletProviderId
  client: SecretNetworkClient
  endpoint: Endpoint
}

export type TokenAttribute = {
  traitType: string
  value: string
  displayType?: string
}

export type ResolvedMetadata = {
  uri: string
  gatewayUrl: string
  fetchedAt?: string
  payload?: unknown
  error?: string
}

export type TokenDossier = {
  tokenId: string
  owner?: string
  name?: string
  description?: string
  image?: string
  animationUrl?: string
  externalUrl?: string
  tokenUri?: string
  attributes: TokenAttribute[]
  resolvedMetadata?: ResolvedMetadata
  publicMetadata?: unknown
  privateMetadata?: unknown
  raw: unknown
  query: 'nft_dossier' | 'all_nft_info'
  error?: string
}

export type CollectionRecovery = {
  collectionId: string
  contractAddress: string
  codeHash?: string
  status: 'queued' | 'loading' | 'complete' | 'error'
  tokenIds: string[]
  tokens: TokenDossier[]
  warnings: string[]
  error?: string
}

export type RecoveryArchive = {
  app: {
    name: string
    version: string
    generatedAt: string
  }
  chain: {
    chainId: string
    endpoint: string
  }
  owner: string
  collections: Array<{
    manifest: CollectionManifest
    recovery: CollectionRecovery
  }>
}

export type PermitBundle = {
  permit: Permit
  permitName: string
}

export type EndpointHealth = {
  state: 'idle' | 'checking' | 'online' | 'offline'
  detail: string
}
