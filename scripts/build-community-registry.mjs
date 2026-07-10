#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_REST = 'https://rest.lavenderfive.com:443/secretnetwork'
const DEFAULT_OUTPUT = 'data/community-collections.json'
const DEFAULT_GENERATED_AT = new Date().toISOString()

export const DEFAULT_CODE_SOURCES = {
  '618': {
    codeHash: '4dd433b8d9c234c33f27bcd14f3348bc57d96440a92b77cee7d0c925b8eed58e',
    source: 'Stashh static app known Circus collection + Secret chain code hash lookup',
  },
  '1279': {
    codeHash: '5783910afb89189caf0ef246e40fef5f00541bfb33eb576bd3ebaf87ae3a8d4f',
    source: 'Stashh static app REACT_APP_DEFAULT_CODE_ID + Secret chain code hash lookup',
  },
}

export function parseStashhLabel(label) {
  const raw = String(label ?? '').trim()
  if (!raw.toLowerCase().startsWith('stashh')) return undefined

  let body = raw.replace(/^stashh\s*/i, '').trim()
  let labelTimestampMs

  const pipeTimestamp = body.match(/\|\s*(\d{10,})\s*$/)
  if (pipeTimestamp) {
    labelTimestampMs = Number(pipeTimestamp[1])
    body = body.slice(0, pipeTimestamp.index).trim()
  } else {
    const spaceTimestamp = body.match(/\s+(\d{10,})\s*$/)
    if (spaceTimestamp) {
      labelTimestampMs = Number(spaceTimestamp[1])
      body = body.slice(0, spaceTimestamp.index).trim()
    }
  }

  let name = body.trim()
  let symbol
  const symbolMatch = body.match(/^(.*?)\s+-\s+([^-]+)$/)
  if (symbolMatch) {
    name = symbolMatch[1].trim()
    symbol = symbolMatch[2].trim() || undefined
  }

  return {
    name: name || undefined,
    symbol,
    labelTimestampMs: Number.isFinite(labelTimestampMs) ? labelTimestampMs : undefined,
  }
}

export function normalizeCollectionName(label, contractAddress) {
  const parsed = parseStashhLabel(label)
  if (parsed?.name) return parsed.name

  const raw = String(label ?? '').trim()
  if (raw) return raw

  return shortAddress(contractAddress)
}

export function buildRegistry({
  generatedAt = DEFAULT_GENERATED_AT,
  codeSources = DEFAULT_CODE_SOURCES,
  contractFiles,
}) {
  const byAddress = new Map()
  const codeIds = Object.keys(codeSources).sort(compareNumericStrings)

  for (const file of contractFiles) {
    const codeId = String(file.codeId)
    const codeSource = codeSources[codeId]
    if (!codeSource) continue

    for (const row of file.contractInfos ?? []) {
      const contractAddress = row.contract_address ?? row.contractAddress
      const info = row.contract_info ?? row.contractInfo ?? {}
      const label = String(info.label ?? '')
      const parsed = parseStashhLabel(label)

      if (!contractAddress || !parsed) continue
      if (byAddress.has(contractAddress)) continue

      const addedAt = parsed.labelTimestampMs
        ? new Date(parsed.labelTimestampMs).toISOString()
        : generatedAt

      const notes = [
        'Verified Stashh SNIP-721 candidate from Secret chain contracts-by-code query.',
        `source_tier=A`,
        `code_id=${codeId}`,
        `label=${label}`,
        `creator=${info.creator ?? 'unknown'}`,
        `admin=${info.admin || 'none'}`,
        parsed.symbol ? `symbol=${parsed.symbol}` : undefined,
        parsed.labelTimestampMs ? `label_timestamp_ms=${parsed.labelTimestampMs}` : undefined,
      ].filter(Boolean).join('; ')

      byAddress.set(contractAddress, {
        id: contractAddress,
        name: normalizeCollectionName(label, contractAddress),
        contractAddress,
        codeHash: codeSource.codeHash,
        tokenIds: [],
        notes,
        source: `Stashh static app + Secret chain /compute/v1beta1/contracts/${codeId}`,
        addedAt,
      })
    }
  }

  const collections = [...byAddress.values()].sort((a, b) => {
    const codeA = codeIdFromNotes(a.notes)
    const codeB = codeIdFromNotes(b.notes)
    const codeCompare = compareNumericStrings(codeA, codeB)
    if (codeCompare) return codeCompare
    return a.name.localeCompare(b.name) || a.contractAddress.localeCompare(b.contractAddress)
  })

  return {
    provenance: {
      generatedAt,
      chainId: 'secret-4',
      registryPurpose: 'Seed SNIP-721 collection contracts for wallet-authenticated Secret NFT recovery scans.',
      trustBoundary: 'This registry discovers contracts to query. It does not prove a wallet owns any NFT and cannot bypass SNIP-721 privacy.',
      methodology: [
        'Read Stashh static app public configuration for collection code IDs / known collection evidence.',
        'Confirmed code hashes and instantiated contracts through Secret Network REST compute endpoints.',
        'Included only contracts with Stashh collection labels from verified SNIP-721 collection code IDs.',
      ],
      codeIds,
      codeSources,
      totalCollections: collections.length,
    },
    collections,
  }
}

export async function fetchContractsByCode({ rest = DEFAULT_REST, codeId, pageLimit = 1000 }) {
  const contractInfos = []
  let nextKey = ''

  while (true) {
    const params = new URLSearchParams({ 'pagination.limit': String(pageLimit) })
    if (nextKey) params.set('pagination.key', nextKey)
    const url = `${rest}/compute/v1beta1/contracts/${codeId}?${params}`
    const data = await fetchJsonWithRetry(url)
    contractInfos.push(...(data.contract_infos ?? []))
    nextKey = data.pagination?.next_key ?? ''
    if (!nextKey) break
  }

  return { codeId: String(codeId), contractInfos }
}

export async function loadContractFile(inputDir, codeId) {
  const path = resolve(inputDir, `contracts-code-${codeId}.json`)
  const data = JSON.parse(await readFile(path, 'utf8'))
  return {
    codeId: String(codeId),
    contractInfos: data.contract_infos ?? [],
  }
}

async function fetchJsonWithRetry(url, attempts = 5) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'secret-nft-rescue-registry-builder' },
      })
      if (response.status === 429) {
        throw new RetryableHttpError(response.status, await response.text())
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${await response.text()}`)
      }
      return await response.json()
    } catch (error) {
      lastError = error
      if (!(error instanceof RetryableHttpError) || attempt === attempts) break
      await wait(1000 * attempt)
    }
  }
  throw lastError
}

class RetryableHttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`)
    this.status = status
  }
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms))
}

function compareNumericStrings(a, b) {
  return Number(a) - Number(b)
}

function codeIdFromNotes(notes) {
  return notes?.match(/code_id=(\d+)/)?.[1] ?? '0'
}

function shortAddress(address) {
  if (!address || address.length <= 16) return address || 'unknown collection'
  return `${address.slice(0, 10)}...${address.slice(-6)}`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const codeIds = args.codeIds.length ? args.codeIds : Object.keys(DEFAULT_CODE_SOURCES)
  const generatedAt = args.generatedAt ?? new Date().toISOString()
  const contractFiles = []

  for (const codeId of codeIds.sort(compareNumericStrings)) {
    if (args.inputDir) {
      contractFiles.push(await loadContractFile(args.inputDir, codeId))
    } else {
      contractFiles.push(await fetchContractsByCode({ rest: args.rest, codeId }))
    }
  }

  const registry = buildRegistry({ generatedAt, codeSources: DEFAULT_CODE_SOURCES, contractFiles })
  const outputPath = resolve(args.output)
  await writeFile(outputPath, `${JSON.stringify(registry, null, 2)}\n`)
  console.log(`Wrote ${registry.collections.length} collections to ${outputPath}`)
}

function parseArgs(argv) {
  const args = {
    rest: DEFAULT_REST,
    output: DEFAULT_OUTPUT,
    inputDir: undefined,
    generatedAt: undefined,
    codeIds: [],
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--rest') args.rest = argv[++i]
    else if (arg === '--output') args.output = argv[++i]
    else if (arg === '--input-dir') args.inputDir = argv[++i]
    else if (arg === '--generated-at') args.generatedAt = argv[++i]
    else if (arg === '--code-id') args.codeIds.push(argv[++i])
    else if (arg === '--help') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return args
}

function printHelp() {
  console.log(`Usage:
  node scripts/build-community-registry.mjs [options]

Options:
  --input-dir DIR       Read cached contracts-code-<id>.json files instead of querying REST
  --output PATH         Output manifest path (default: ${DEFAULT_OUTPUT})
  --rest URL            Secret REST base URL (default: ${DEFAULT_REST})
  --code-id ID          Include a code ID; may be repeated. Defaults to 618 and 1279
  --generated-at ISO    Fixed timestamp for reproducible output
`)
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isCli && existsSync(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
