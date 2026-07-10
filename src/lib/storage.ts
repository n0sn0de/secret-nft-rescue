import { STORAGE_KEY } from '../constants'
import type { CollectionManifest } from '../types'
import { parseManifestImport } from './manifest'

export function loadCollections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return parseManifestImport(JSON.parse(raw))
  } catch {
    return []
  }
}

export function saveCollections(collections: CollectionManifest[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ collections, savedAt: new Date().toISOString() }),
  )
}
