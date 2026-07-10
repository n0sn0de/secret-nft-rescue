import type { CachedScan, CollectionManifest, RecoveryArchive } from '../types'
import { parseManifestImport } from './manifest'

export async function fetchCollectionRegistry() {
  const payload = await request<unknown>('/api/collections')
  return parseManifestImport(payload)
}

export async function upsertRegistryCollection(collection: CollectionManifest) {
  const payload = await request<unknown>('/api/collections', {
    method: 'POST',
    body: JSON.stringify(collection),
  })

  return parseManifestImport(payload)
}

export async function importRegistryCollections(collections: CollectionManifest[]) {
  const payload = await request<unknown>('/api/collections/import', {
    method: 'POST',
    body: JSON.stringify({ collections }),
  })

  return parseManifestImport(payload)
}

export async function deleteRegistryCollection(id: string) {
  const payload = await request<unknown>(`/api/collections/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  return parseManifestImport(payload)
}

export async function loadCachedScan(owner: string) {
  const response = await fetch(`/api/scans/${encodeURIComponent(owner)}`)

  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(await apiError(response))

  const payload = (await response.json()) as { scan?: CachedScan }
  return payload.scan
}

export async function saveCachedScan(archive: RecoveryArchive) {
  const payload = await request<{ scan: CachedScan }>(
    `/api/scans/${encodeURIComponent(archive.owner)}`,
    {
      method: 'POST',
      body: JSON.stringify({ archive }),
    },
  )

  return payload.scan
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await apiError(response))
  }

  return (await response.json()) as T
}

async function apiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string }
    return payload.error ?? `API returned ${response.status}`
  } catch {
    return `API returned ${response.status}`
  }
}
