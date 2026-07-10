import { describe, expect, it } from 'vitest'
import {
  buildRegistry,
  normalizeCollectionName,
  parseStashhLabel,
} from './build-community-registry.mjs'

const codeSources = {
  '618': {
    codeHash: '4dd433b8d9c234c33f27bcd14f3348bc57d96440a92b77cee7d0c925b8eed58e',
    source: 'test-source-618',
  },
  '1279': {
    codeHash: '5783910afb89189caf0ef246e40fef5f00541bfb33eb576bd3ebaf87ae3a8d4f',
    source: 'test-source-1279',
  },
}

describe('Stashh community registry builder', () => {
  it('parses canonical Stashh collection labels', () => {
    expect(parseStashhLabel('Stashh  Circus Clash - CIR | 1691584061514')).toEqual({
      name: 'Circus Clash',
      symbol: 'CIR',
      labelTimestampMs: 1691584061514,
    })
  })

  it('parses Stashh labels without symbol delimiters', () => {
    expect(parseStashhLabel('Stashh Gallery 1697064977148')).toEqual({
      name: 'Gallery',
      symbol: undefined,
      labelTimestampMs: 1697064977148,
    })
  })

  it('falls back to a readable name for unusual labels', () => {
    expect(normalizeCollectionName('Non-suspicious Images', 'secret1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toBe(
      'Non-suspicious Images',
    )
    expect(normalizeCollectionName('', 'secret1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toBe(
      'secret1qqq...qqqqqq',
    )
  })

  it('builds a deduplicated manifest with code hashes and provenance notes', () => {
    const manifest = buildRegistry({
      generatedAt: '2026-07-10T00:00:00.000Z',
      codeSources,
      contractFiles: [
        {
          codeId: '618',
          contractInfos: [
            {
              contract_address: 'secret1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              contract_info: {
                code_id: '618',
                creator: 'secret1creatoraaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                label: 'Stashh  Circus Clash - CIR | 1691584061514',
                admin: '',
              },
            },
          ],
        },
        {
          codeId: '1279',
          contractInfos: [
            {
              contract_address: 'secret1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              contract_info: {
                code_id: '1279',
                creator: 'secret1creatorbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                label: 'Stashh Duplicate 1697064977148',
                admin: '',
              },
            },
            {
              contract_address: 'secret1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
              contract_info: {
                code_id: '1279',
                creator: 'secret1creatorcccccccccccccccccccccccccccccc',
                label: 'Stashh Gallery 1697064977148',
                admin: '',
              },
            },
            {
              contract_address: 'secret1ccccccccccccccccccccccccccccccccccccccc',
              contract_info: {
                code_id: '1279',
                creator: 'secret1creatordddddddddddddddddddddddddddddd',
                label: 'Not Stashh',
                admin: '',
              },
            },
          ],
        },
      ],
    })

    expect(manifest.collections).toHaveLength(2)
    expect(manifest.collections[0]).toMatchObject({
      name: 'Circus Clash',
      contractAddress: 'secret1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      codeHash: codeSources['618'].codeHash,
      tokenIds: [],
      source: 'Stashh static app + Secret chain /compute/v1beta1/contracts/618',
      addedAt: '2023-08-09T12:27:41.514Z',
    })
    expect(manifest.collections[0].notes).toContain('symbol=CIR')
    expect(manifest.collections[1]).toMatchObject({
      name: 'Gallery',
      contractAddress: 'secret1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      codeHash: codeSources['1279'].codeHash,
    })
    expect(manifest.provenance.totalCollections).toBe(2)
    expect(manifest.provenance.codeIds).toEqual(['618', '1279'])
  })
})
