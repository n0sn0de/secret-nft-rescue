import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseManifestImport } from '../src/lib/manifest'

const registry = JSON.parse(readFileSync('data/community-collections.json', 'utf8'))

describe('community SNIP-721 registry seed', () => {
  it('contains the verified Stashh code-id seed set', () => {
    expect(registry.provenance.chainId).toBe('secret-4')
    expect(registry.provenance.codeIds).toEqual(['618', '1279'])
    expect(registry.provenance.totalCollections).toBe(2001)
    expect(registry.collections).toHaveLength(2001)
  })

  it('is importable by the rescue app manifest parser', () => {
    const imported = parseManifestImport(registry)
    expect(imported).toHaveLength(2001)

    const byCodeHash = new Map()
    for (const collection of imported) {
      expect(collection.contractAddress).toMatch(/^secret1[0-9a-z]{38,64}$/)
      expect(collection.codeHash).toMatch(/^[0-9a-f]{64}$/)
      expect(collection.tokenIds).toEqual([])
      byCodeHash.set(collection.codeHash, (byCodeHash.get(collection.codeHash) ?? 0) + 1)
    }

    expect(byCodeHash.get('4dd433b8d9c234c33f27bcd14f3348bc57d96440a92b77cee7d0c925b8eed58e')).toBe(685)
    expect(byCodeHash.get('5783910afb89189caf0ef246e40fef5f00541bfb33eb576bd3ebaf87ae3a8d4f')).toBe(1316)
  })
})
