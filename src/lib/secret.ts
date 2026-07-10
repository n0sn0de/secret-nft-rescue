import { SecretNetworkClient } from 'secretjs'
import { CHAIN_ID } from '../constants'
import {
  extractMetadataDisplay,
  hydrateTokenMetadata,
  mergeDisplay,
  normalizeResourceUrl,
} from './metadata'
import type {
  CollectionManifest,
  CollectionRecovery,
  Endpoint,
  PermitBundle,
  TokenDossier,
  WalletConnection,
  WalletProviderId,
} from '../types'

type QueryResponse = Record<string, unknown>

export async function checkEndpoint(lcdUrl: string) {
  const response = await fetch(
    `${lcdUrl.replace(/\/$/, '')}/cosmos/base/tendermint/v1beta1/node_info`,
  )

  if (!response.ok) {
    throw new Error(`LCD returned ${response.status}`)
  }

  const payload = (await response.json()) as {
    default_node_info?: { network?: string }
  }

  return payload.default_node_info?.network ?? 'unknown'
}

export async function connectWallet(
  provider: WalletProviderId,
  endpoint: Endpoint,
): Promise<WalletConnection> {
  const walletApi = provider === 'leap' ? window.leap : window.keplr

  if (!walletApi) {
    throw new Error(provider === 'leap' ? 'Leap is not available.' : 'Keplr is not available.')
  }

  await walletApi.enable(CHAIN_ID)

  const signerFactory =
    walletApi.getOfflineSignerOnlyAmino ??
    window.getOfflineSignerOnlyAmino ??
    walletApi.getOfflineSigner ??
    window.getOfflineSigner

  if (!signerFactory) {
    throw new Error('Amino signer is not available for this wallet.')
  }

  const signer = signerFactory(CHAIN_ID)
  const accounts = await signer.getAccounts()
  const address = accounts[0]?.address

  if (!address) {
    throw new Error('Wallet did not return an account.')
  }

  const encryptionUtils =
    walletApi.getEnigmaUtils?.(CHAIN_ID) ?? window.getEnigmaUtils?.(CHAIN_ID)

  const client = new SecretNetworkClient({
    url: endpoint.lcdUrl,
    chainId: CHAIN_ID,
    wallet: signer,
    walletAddress: address,
    encryptionUtils,
  })

  return {
    address,
    provider,
    client,
    endpoint,
  }
}

export async function signOwnerPermit(
  connection: WalletConnection,
  collections: CollectionManifest[],
): Promise<PermitBundle> {
  const allowedContracts = collections.map((collection) => collection.contractAddress)
  const permitName = `secret-nft-rescue-${Date.now()}`
  const useKeplrWindow = connection.provider === 'keplr'
  const permit = await connection.client.utils.accessControl.permit.sign(
    connection.address,
    CHAIN_ID,
    permitName,
    allowedContracts,
    ['owner'],
    useKeplrWindow,
  )

  return { permit, permitName }
}

export async function recoverCollection(
  connection: WalletConnection,
  collection: CollectionManifest,
  permitBundle: PermitBundle,
): Promise<CollectionRecovery> {
  const warnings: string[] = []
  const codeHash = await resolveCodeHash(connection.client, collection)
  const tokenIds = await getTokenIds(connection, collection, codeHash, permitBundle).catch(
    (error: unknown) => {
      if (collection.tokenIds.length > 0) {
        warnings.push(`Owned-token query failed: ${errorMessage(error)}`)
        return collection.tokenIds
      }

      throw error
    },
  )

  const tokens: TokenDossier[] = []

  for (const tokenId of tokenIds) {
    tokens.push(
      await queryTokenDossier(connection, collection.contractAddress, codeHash, tokenId, permitBundle),
    )
  }

  return {
    collectionId: collection.id,
    contractAddress: collection.contractAddress,
    codeHash,
    status: 'complete',
    tokenIds,
    tokens,
    warnings,
  }
}

async function resolveCodeHash(
  client: SecretNetworkClient,
  collection: CollectionManifest,
) {
  if (collection.codeHash) return collection.codeHash

  const response = await client.query.compute.codeHashByContractAddress({
    contract_address: collection.contractAddress,
  })

  if (!response.code_hash) {
    throw new Error('Unable to resolve contract code hash.')
  }

  return response.code_hash.replace(/^0x/i, '').toLowerCase()
}

async function getTokenIds(
  connection: WalletConnection,
  collection: CollectionManifest,
  codeHash: string,
  permitBundle: PermitBundle,
) {
  const pageSize = 50
  const tokenIds: string[] = []
  let startAfter: string | undefined

  for (let page = 0; page < 20; page += 1) {
    const response = await connection.client.query.compute.queryContract<
      QueryResponse,
      { token_list?: { tokens?: string[] } }
    >({
      contract_address: collection.contractAddress,
      code_hash: codeHash,
      query: {
        with_permit: {
          permit: permitBundle.permit,
          query: {
            tokens: {
              owner: connection.address,
              limit: pageSize,
              ...(startAfter ? { start_after: startAfter } : {}),
            },
          },
        },
      },
    })

    const pageTokens = response.token_list?.tokens ?? []
    tokenIds.push(...pageTokens)

    if (pageTokens.length < pageSize) break
    startAfter = pageTokens.at(-1)
  }

  return tokenIds.filter((tokenId, index, all) => all.indexOf(tokenId) === index)
}

async function queryTokenDossier(
  connection: WalletConnection,
  contractAddress: string,
  codeHash: string,
  tokenId: string,
  permitBundle: PermitBundle,
): Promise<TokenDossier> {
  try {
    const response = await connection.client.query.compute.queryContract<
      QueryResponse,
      QueryResponse
    >({
      contract_address: contractAddress,
      code_hash: codeHash,
      query: {
        with_permit: {
          permit: permitBundle.permit,
          query: {
            nft_dossier: {
              token_id: tokenId,
              include_expired: true,
            },
          },
        },
      },
    })

    return await dossierFromResponse(tokenId, response, 'nft_dossier')
  } catch (dossierError) {
    try {
      const response = await connection.client.query.snip721.GetTokenInfo({
        contract: { address: contractAddress, codeHash },
        auth: { permit: permitBundle.permit },
        token_id: tokenId,
      })

      return await dossierFromResponse(
        tokenId,
        response as unknown as QueryResponse,
        'all_nft_info',
      )
    } catch (fallbackError) {
      return {
        tokenId,
        attributes: [],
        raw: {},
        query: 'nft_dossier',
        error: `${errorMessage(dossierError)}; fallback failed: ${errorMessage(fallbackError)}`,
      }
    }
  }
}

async function dossierFromResponse(
  tokenId: string,
  response: QueryResponse,
  query: TokenDossier['query'],
): Promise<TokenDossier> {
  const dossier = (response.nft_dossier ?? response.all_nft_info ?? response) as QueryResponse
  const publicMetadata = dossier.public_metadata ?? getNested(dossier, ['info'])
  const privateMetadata = dossier.private_metadata
  const publicDisplay = extractMetadataDisplay(publicMetadata)
  const privateDisplay = extractMetadataDisplay(privateMetadata)
  const display = {
    name: privateDisplay.name ?? publicDisplay.name,
    description: privateDisplay.description ?? publicDisplay.description,
    image: privateDisplay.image ?? publicDisplay.image,
    animationUrl: privateDisplay.animationUrl ?? publicDisplay.animationUrl,
    externalUrl: privateDisplay.externalUrl ?? publicDisplay.externalUrl,
    tokenUri: privateDisplay.tokenUri ?? publicDisplay.tokenUri,
    attributes:
      privateDisplay.attributes.length > 0
        ? privateDisplay.attributes
        : publicDisplay.attributes,
  }
  const tokenUri = display.tokenUri
  const baseToken: TokenDossier = {
    tokenId,
    owner: typeof dossier.owner === 'string' ? dossier.owner : undefined,
    name: tokenId,
    attributes: [],
    publicMetadata,
    privateMetadata,
    raw: response,
    query,
  }

  return await hydrateTokenMetadata(
    mergeDisplay(baseToken, {
      ...display,
      tokenUri,
      image: normalizeResourceUrl(display.image),
      animationUrl: normalizeResourceUrl(display.animationUrl),
      externalUrl: normalizeResourceUrl(display.externalUrl),
    }),
  )
}

function getNested(value: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) return undefined
    return (current as Record<string, unknown>)[key]
  }, value)
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
