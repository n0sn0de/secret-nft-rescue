import type { TokenAttribute, TokenDossier, ResolvedMetadata } from '../types'

type MetadataDisplay = {
  name?: string
  description?: string
  image?: string
  animationUrl?: string
  externalUrl?: string
  tokenUri?: string
  attributes: TokenAttribute[]
}

const MAX_METADATA_BYTES = 2_000_000
const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io'

export function normalizeResourceUrl(value?: string) {
  if (!value) return undefined
  const trimmed = value.trim()

  if (trimmed.startsWith('ipfs://')) {
    const path = trimmed.slice('ipfs://'.length).replace(/^ipfs\//, '')
    return `${DEFAULT_IPFS_GATEWAY}/ipfs/${path}`
  }

  if (trimmed.startsWith('ipns://')) {
    const path = trimmed.slice('ipns://'.length).replace(/^ipns\//, '')
    return `${DEFAULT_IPFS_GATEWAY}/ipns/${path}`
  }

  if (trimmed.startsWith('ar://')) {
    return `https://arweave.net/${trimmed.slice('ar://'.length)}`
  }

  return trimmed
}

export function extractMetadataDisplay(metadata: unknown): MetadataDisplay {
  const root = isRecord(metadata) ? metadata : {}
  const extension = isRecord(root.extension) ? root.extension : undefined
  const candidates = [extension, root].filter(isRecord)

  return {
    name: firstString(candidates, ['name', 'title']),
    description: firstString(candidates, ['description', 'desc']),
    image: firstString(candidates, ['image', 'image_url', 'imageUrl']),
    animationUrl: firstString(candidates, [
      'animation_url',
      'animationUrl',
      'animation',
      'media',
    ]),
    externalUrl: firstString(candidates, ['external_url', 'externalUrl', 'url']),
    tokenUri: firstString(candidates, ['token_uri', 'tokenUri', 'uri']),
    attributes: normalizeAttributes(
      firstValue(candidates, ['attributes', 'traits', 'properties']),
    ),
  }
}

export async function hydrateTokenMetadata(token: TokenDossier) {
  if (!token.tokenUri) return token

  const gatewayUrl = normalizeResourceUrl(token.tokenUri) ?? token.tokenUri

  try {
    const payload = await fetchJsonMetadata(gatewayUrl)
    const display = extractMetadataDisplay(payload)
    const resolvedMetadata: ResolvedMetadata = {
      uri: token.tokenUri,
      gatewayUrl,
      fetchedAt: new Date().toISOString(),
      payload,
    }

    return mergeDisplay(token, display, resolvedMetadata)
  } catch (error) {
    return {
      ...token,
      resolvedMetadata: {
        uri: token.tokenUri,
        gatewayUrl,
        error: errorMessage(error),
      },
    }
  }
}

export function mergeDisplay(
  token: TokenDossier,
  display: MetadataDisplay,
  resolvedMetadata?: ResolvedMetadata,
): TokenDossier {
  return {
    ...token,
    name: display.name ?? token.name,
    description: display.description ?? token.description,
    image: normalizeResourceUrl(display.image) ?? token.image,
    animationUrl: normalizeResourceUrl(display.animationUrl) ?? token.animationUrl,
    externalUrl: normalizeResourceUrl(display.externalUrl) ?? token.externalUrl,
    tokenUri: display.tokenUri ?? token.tokenUri,
    attributes: display.attributes.length > 0 ? display.attributes : token.attributes,
    resolvedMetadata,
  }
}

async function fetchJsonMetadata(url: string) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Metadata fetch returned ${response.status}`)
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > MAX_METADATA_BYTES) {
      throw new Error('Metadata response is too large.')
    }

    const text = await response.text()
    if (text.length > MAX_METADATA_BYTES) {
      throw new Error('Metadata response is too large.')
    }

    return JSON.parse(text) as unknown
  } finally {
    window.clearTimeout(timeout)
  }
}

function normalizeAttributes(value: unknown): TokenAttribute[] {
  if (Array.isArray(value)) {
    const attributes: TokenAttribute[] = []

    for (const item of value) {
      if (!isRecord(item)) continue
      const traitType = stringValue(item.trait_type ?? item.traitType ?? item.type)
      const attributeValue = stringValue(item.value)

      if (!traitType || !attributeValue) continue

      attributes.push({
        traitType,
        value: attributeValue,
        displayType: stringValue(item.display_type ?? item.displayType),
      })
    }

    return attributes
  }

  if (isRecord(value)) {
    return Object.entries(value).map(([traitType, attributeValue]) => ({
      traitType,
      value: stringValue(attributeValue) ?? '',
    }))
  }

  return []
}

function firstString(records: Record<string, unknown>[], keys: string[]) {
  const value = firstValue(records, keys)
  return stringValue(value)
}

function firstValue(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key]
    }
  }

  return undefined
}

function stringValue(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
