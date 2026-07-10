import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

const SECRET_ADDRESS_PATTERN = /^secret1[0-9a-z]{38,64}$/
const CODE_HASH_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const dbPath =
  process.env.SECRET_NFT_RESCUE_DB ??
  join(projectRoot, '.data', 'secret-nft-rescue.sqlite')

mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  create table if not exists collections (
    id text primary key,
    name text not null,
    contract_address text not null unique,
    code_hash text,
    token_ids_json text not null,
    notes text,
    source text,
    added_at text not null,
    updated_at text not null
  );

  create table if not exists scan_results (
    owner text primary key,
    archive_json text not null,
    created_at text not null,
    updated_at text not null
  );
`)

type CollectionRow = {
  id: string
  name: string
  contract_address: string
  code_hash: string | null
  token_ids_json: string
  notes: string | null
  source: string | null
  added_at: string
  updated_at: string
}

type ScanRow = {
  owner: string
  archive_json: string
  created_at: string
  updated_at: string
}

type CollectionManifest = {
  id: string
  name: string
  contractAddress: string
  codeHash?: string
  tokenIds: string[]
  notes?: string
  source?: string
  addedAt: string
}

type RecoveryArchive = {
  owner: string
  [key: string]: unknown
}

type CachedScan = {
  owner: string
  archive: RecoveryArchive
  createdAt: string
  updatedAt: string
}

export function getDbPath() {
  return dbPath
}

export function listCollections(): CollectionManifest[] {
  const rows = db
    .prepare<[], CollectionRow>(
      'select * from collections order by lower(name), contract_address',
    )
    .all()

  return rows.map(collectionFromRow)
}

export function upsertCollection(input: unknown): CollectionManifest {
  const normalized = normalizeCollection(input)
  const existing = getCollection(normalized.id)
  const now = new Date().toISOString()
  const merged: CollectionManifest = existing
    ? {
        ...existing,
        ...normalized,
        codeHash: normalized.codeHash ?? existing.codeHash,
        tokenIds: unique([...existing.tokenIds, ...normalized.tokenIds]),
        addedAt: existing.addedAt,
      }
    : normalized

  db.prepare(`
    insert into collections (
      id, name, contract_address, code_hash, token_ids_json, notes, source, added_at, updated_at
    ) values (
      @id, @name, @contractAddress, @codeHash, @tokenIdsJson, @notes, @source, @addedAt, @updatedAt
    )
    on conflict(id) do update set
      name = excluded.name,
      contract_address = excluded.contract_address,
      code_hash = excluded.code_hash,
      token_ids_json = excluded.token_ids_json,
      notes = excluded.notes,
      source = excluded.source,
      updated_at = excluded.updated_at
  `).run({
    id: merged.id,
    name: merged.name,
    contractAddress: merged.contractAddress,
    codeHash: merged.codeHash ?? null,
    tokenIdsJson: JSON.stringify(merged.tokenIds),
    notes: merged.notes ?? null,
    source: merged.source ?? null,
    addedAt: merged.addedAt,
    updatedAt: now,
  })

  return { ...merged, addedAt: merged.addedAt || now }
}

export function importCollections(input: unknown): CollectionManifest[] {
  const rawCollections = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.collections)
      ? input.collections
      : []

  const imported: CollectionManifest[] = []

  for (const item of rawCollections) {
    try {
      imported.push(upsertCollection(item))
    } catch {
      // Community manifests are allowed to contain bad rows; keep the good ones.
    }
  }

  return imported
}

export function deleteCollection(id: string) {
  const result = db.prepare('delete from collections where id = ?').run(id)
  return result.changes > 0
}

export function saveScan(owner: string, archive: unknown): CachedScan {
  if (!isRecord(archive) || archive.owner !== owner) {
    throw new Error('Scan archive owner does not match wallet.')
  }

  const now = new Date().toISOString()
  const existing = getScan(owner)
  const createdAt = existing?.createdAt ?? now

  db.prepare(`
    insert into scan_results (owner, archive_json, created_at, updated_at)
    values (?, ?, ?, ?)
    on conflict(owner) do update set
      archive_json = excluded.archive_json,
      updated_at = excluded.updated_at
  `).run(owner, JSON.stringify(archive), createdAt, now)

  return {
    owner,
    archive: archive as RecoveryArchive,
    createdAt,
    updatedAt: now,
  }
}

export function getScan(owner: string): CachedScan | undefined {
  const row = db
    .prepare<[string], ScanRow>('select * from scan_results where owner = ?')
    .get(owner)

  if (!row) return undefined

  return {
    owner: row.owner,
    archive: JSON.parse(row.archive_json) as RecoveryArchive,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getStats() {
  const collectionCount = db
    .prepare<[], { count: number }>('select count(*) as count from collections')
    .get()?.count ?? 0
  const scanCount = db
    .prepare<[], { count: number }>('select count(*) as count from scan_results')
    .get()?.count ?? 0

  return {
    collections: collectionCount,
    scans: scanCount,
  }
}

export function seedCollectionsFromFile() {
  const seedPath = join(projectRoot, 'data', 'community-collections.json')
  if (!existsSync(seedPath) || listCollections().length > 0) return 0

  const imported = importCollections(JSON.parse(readFileSync(seedPath, 'utf8')))
  return imported.length
}

function getCollection(id: string): CollectionManifest | undefined {
  const row = db
    .prepare<[string], CollectionRow>('select * from collections where id = ?')
    .get(id)

  return row ? collectionFromRow(row) : undefined
}

function collectionFromRow(row: CollectionRow): CollectionManifest {
  return {
    id: row.id,
    name: row.name,
    contractAddress: row.contract_address,
    codeHash: row.code_hash ?? undefined,
    tokenIds: parseTokenIdsJson(row.token_ids_json),
    notes: row.notes ?? undefined,
    source: row.source ?? undefined,
    addedAt: row.added_at,
  }
}

function normalizeCollection(input: unknown): CollectionManifest {
  if (!isRecord(input)) throw new Error('Collection must be an object.')

  const contractAddress = String(input.contractAddress ?? input.contract_address ?? '').trim()
  if (!SECRET_ADDRESS_PATTERN.test(contractAddress)) {
    throw new Error('Collection has an invalid Secret contract address.')
  }

  const codeHashInput = String(input.codeHash ?? input.code_hash ?? '').trim()
  const codeHash = codeHashInput
    ? codeHashInput.replace(/^0x/i, '').toLowerCase()
    : undefined

  if (codeHash && !CODE_HASH_PATTERN.test(codeHash)) {
    throw new Error('Collection has an invalid code hash.')
  }

  const tokenIds = Array.isArray(input.tokenIds)
    ? input.tokenIds.map(String)
    : parseTokenIds(String(input.tokenIds ?? ''))
  const name = String(input.name ?? shortAddress(contractAddress)).trim()
  const addedAt = String(input.addedAt ?? input.added_at ?? new Date().toISOString())

  return {
    id: contractAddress,
    name: name || shortAddress(contractAddress),
    contractAddress,
    codeHash,
    tokenIds: unique(tokenIds),
    notes: input.notes ? String(input.notes) : undefined,
    source: input.source ? String(input.source) : undefined,
    addedAt,
  }
}

function parseTokenIds(value: string) {
  return value
    .split(/[\s,]+/)
    .map((tokenId) => tokenId.trim())
    .filter(Boolean)
}

function parseTokenIdsJson(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function shortAddress(address: string) {
  if (address.length <= 16) return address
  return `${address.slice(0, 10)}...${address.slice(-6)}`
}

function unique(values: string[]) {
  return values.filter((value, index, all) => value && all.indexOf(value) === index)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
