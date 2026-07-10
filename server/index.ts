import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deleteCollection,
  getDbPath,
  getScan,
  getStats,
  importCollections,
  listCollections,
  saveScan,
  seedCollectionsFromFile,
  upsertCollection,
} from './db.ts'

const require = createRequire(import.meta.url)
const express = require('express') as typeof import('express')

const app = express()
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(projectRoot, 'dist')
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 8787)
const host = process.env.API_HOST ?? '127.0.0.1'

const seeded = seedCollectionsFromFile()
if (seeded > 0) {
  console.log(`Seeded ${seeded} collection records.`)
}

app.use(express.json({ limit: '50mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    dbPath: getDbPath(),
    stats: getStats(),
  })
})

app.get('/api/collections', (_request, response) => {
  response.json({
    collections: listCollections(),
    stats: getStats(),
  })
})

app.post('/api/collections', (request, response) => {
  try {
    const collection = upsertCollection(request.body)
    response.status(201).json({
      collection,
      collections: listCollections(),
      stats: getStats(),
    })
  } catch (error) {
    response.status(400).json({ error: errorMessage(error) })
  }
})

app.post('/api/collections/import', (request, response) => {
  const imported = importCollections(request.body)
  response.json({
    imported: imported.length,
    collections: listCollections(),
    stats: getStats(),
  })
})

app.delete('/api/collections/:id', (request, response) => {
  deleteCollection(request.params.id)
  response.json({
    collections: listCollections(),
    stats: getStats(),
  })
})

app.get('/api/scans/:owner', (request, response) => {
  const scan = getScan(request.params.owner)
  if (!scan) {
    response.status(404).json({ error: 'No cached scan for this wallet.' })
    return
  }

  response.json({ scan })
})

app.post('/api/scans/:owner', (request, response) => {
  try {
    const archive = isRecord(request.body) && 'archive' in request.body
      ? request.body.archive
      : request.body
    const scan = saveScan(request.params.owner, archive)
    response.status(201).json({ scan, stats: getStats() })
  } catch (error) {
    response.status(400).json({ error: errorMessage(error) })
  }
})

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((request, response, next) => {
    if (request.method === 'GET' && !request.path.startsWith('/api')) {
      response.sendFile(join(distDir, 'index.html'))
      return
    }

    next()
  })
}

app.listen(port, host, () => {
  console.log(`Secret NFT Rescue API listening on http://${host}:${port}`)
})

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
