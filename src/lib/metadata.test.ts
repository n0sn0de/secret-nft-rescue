import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractMetadataDisplay,
  hydrateTokenMetadata,
  mergeDisplay,
  normalizeResourceUrl,
} from './metadata'
import type { TokenDossier } from '../types'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('metadata helpers', () => {
  it('normalizes IPFS and Arweave resource URLs', () => {
    expect(normalizeResourceUrl('ipfs://bafybeihash/art.png')).toBe(
      'https://ipfs.io/ipfs/bafybeihash/art.png',
    )
    expect(normalizeResourceUrl('ipfs://ipfs/bafybeihash/meta.json')).toBe(
      'https://ipfs.io/ipfs/bafybeihash/meta.json',
    )
    expect(normalizeResourceUrl('ar://abc123')).toBe('https://arweave.net/abc123')
  })

  it('extracts ERC-style metadata from SNIP extension records', () => {
    const display = extractMetadataDisplay({
      token_uri: 'ipfs://meta',
      extension: {
        name: 'Private One',
        description: 'Hidden art',
        image: 'ipfs://image',
        attributes: [{ trait_type: 'Mood', value: 'Recovered' }],
      },
    })

    expect(display).toMatchObject({
      name: 'Private One',
      description: 'Hidden art',
      image: 'ipfs://image',
      tokenUri: 'ipfs://meta',
      attributes: [{ traitType: 'Mood', value: 'Recovered' }],
    })
  })

  it('merges resolved metadata over on-chain placeholders', () => {
    const token: TokenDossier = {
      tokenId: '7',
      name: '7',
      image: 'https://old.example/art.png',
      attributes: [],
      raw: {},
      query: 'nft_dossier',
    }

    expect(
      mergeDisplay(token, {
        name: 'Resolved',
        image: 'ipfs://new-art',
        attributes: [{ traitType: 'Layer', value: 'IPFS' }],
      }),
    ).toMatchObject({
      name: 'Resolved',
      image: 'https://ipfs.io/ipfs/new-art',
      attributes: [{ traitType: 'Layer', value: 'IPFS' }],
    })
  })

  it('hydrates token_uri JSON metadata into display fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            name: 'Fetched Art',
            description: 'Loaded from token_uri',
            image: 'ipfs://art-cid/image.png',
            attributes: [{ trait_type: 'Source', value: 'IPFS' }],
          }),
          { headers: { 'content-length': '150' } },
        ),
      ),
    )

    const hydrated = await hydrateTokenMetadata({
      tokenId: '9',
      name: '9',
      tokenUri: 'ipfs://metadata-cid/9.json',
      attributes: [],
      raw: {},
      query: 'nft_dossier',
    })

    expect(hydrated).toMatchObject({
      name: 'Fetched Art',
      description: 'Loaded from token_uri',
      image: 'https://ipfs.io/ipfs/art-cid/image.png',
      attributes: [{ traitType: 'Source', value: 'IPFS' }],
      resolvedMetadata: {
        uri: 'ipfs://metadata-cid/9.json',
        gatewayUrl: 'https://ipfs.io/ipfs/metadata-cid/9.json',
      },
    })
  })
})
