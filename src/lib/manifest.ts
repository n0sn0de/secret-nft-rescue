import type { CollectionForm, CollectionManifest } from '../types'

const SECRET_ADDRESS_PATTERN = /^secret1[0-9a-z]{38,64}$/
const CODE_HASH_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/

export function normalizeContractAddress(address: string) {
  return address.trim()
}

export function normalizeCodeHash(codeHash?: string) {
  const normalized = codeHash?.trim().replace(/^0x/i, '').toLowerCase()
  return normalized || undefined
}

export function parseTokenIds(value: string) {
  return value
    .split(/[\s,]+/)
    .map((tokenId) => tokenId.trim())
    .filter(Boolean)
    .filter((tokenId, index, all) => all.indexOf(tokenId) === index)
}

export function validateCollectionForm(form: CollectionForm) {
  const contractAddress = normalizeContractAddress(form.contractAddress)
  const codeHash = normalizeCodeHash(form.codeHash)

  if (!SECRET_ADDRESS_PATTERN.test(contractAddress)) {
    return 'Enter a Secret contract address.'
  }

  if (codeHash && !CODE_HASH_PATTERN.test(codeHash)) {
    return 'Code hash must be 64 hex characters.'
  }

  return undefined
}

export function collectionFromForm(form: CollectionForm): CollectionManifest {
  const contractAddress = normalizeContractAddress(form.contractAddress)
  const name = form.name.trim() || shortAddress(contractAddress)

  return {
    id: contractAddress,
    name,
    contractAddress,
    codeHash: normalizeCodeHash(form.codeHash),
    tokenIds: parseTokenIds(form.tokenIds),
    notes: form.notes.trim() || undefined,
    addedAt: new Date().toISOString(),
  }
}

export function parseManifestImport(input: unknown): CollectionManifest[] {
  const rawCollections = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.collections)
      ? input.collections
      : []

  const collections: CollectionManifest[] = []

  for (const item of rawCollections) {
    const collection = normalizeImportedCollection(item)
    if (collection) collections.push(collection)
  }

  return collections
}

export function mergeCollections(
  current: CollectionManifest[],
  incoming: CollectionManifest[],
) {
  const byId = new Map(current.map((collection) => [collection.id, collection]))

  for (const collection of incoming) {
    byId.set(collection.id, {
      ...byId.get(collection.id),
      ...collection,
      tokenIds: [
        ...(byId.get(collection.id)?.tokenIds ?? []),
        ...collection.tokenIds,
      ].filter((tokenId, index, all) => all.indexOf(tokenId) === index),
    })
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function shortAddress(address: string) {
  if (address.length <= 16) return address
  return `${address.slice(0, 10)}...${address.slice(-6)}`
}

function normalizeImportedCollection(item: unknown): CollectionManifest | undefined {
  if (!isRecord(item)) return undefined

  const contractAddress = normalizeContractAddress(String(item.contractAddress ?? ''))
  if (!SECRET_ADDRESS_PATTERN.test(contractAddress)) return undefined

  const codeHash = normalizeCodeHash(String(item.codeHash ?? ''))
  const tokenIds = Array.isArray(item.tokenIds)
    ? item.tokenIds.map(String)
    : parseTokenIds(String(item.tokenIds ?? ''))

  return {
    id: contractAddress,
    name: String(item.name ?? shortAddress(contractAddress)).trim(),
    contractAddress,
    codeHash,
    tokenIds,
    notes: item.notes ? String(item.notes) : undefined,
    source: item.source ? String(item.source) : undefined,
    addedAt: item.addedAt ? String(item.addedAt) : new Date().toISOString(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
