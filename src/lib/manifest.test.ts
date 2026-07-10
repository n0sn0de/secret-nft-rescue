import { describe, expect, it } from 'vitest'
import {
  collectionFromForm,
  mergeCollections,
  parseManifestImport,
  parseTokenIds,
  validateCollectionForm,
} from './manifest'

const contractAddress = 'secret1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'

describe('manifest helpers', () => {
  it('parses token IDs from loose text', () => {
    expect(parseTokenIds('1, 2\n3 2')).toEqual(['1', '2', '3'])
  })

  it('validates Secret contract addresses', () => {
    expect(
      validateCollectionForm({
        name: '',
        contractAddress,
        codeHash: '',
        tokenIds: '',
        notes: '',
      }),
    ).toBeUndefined()

    expect(
      validateCollectionForm({
        name: '',
        contractAddress: 'cosmos1bad',
        codeHash: '',
        tokenIds: '',
        notes: '',
      }),
    ).toBe('Enter a Secret contract address.')
  })

  it('normalizes a collection form', () => {
    const collection = collectionFromForm({
      name: '  Test Collection ',
      contractAddress,
      codeHash:
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      tokenIds: 'alpha beta',
      notes: ' keeper ',
    })

    expect(collection).toMatchObject({
      id: contractAddress,
      name: 'Test Collection',
      codeHash:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      tokenIds: ['alpha', 'beta'],
      notes: 'keeper',
    })
  })

  it('imports and merges collection manifests', () => {
    const imported = parseManifestImport({
      collections: [
        {
          name: 'Imported',
          contractAddress,
          tokenIds: ['7'],
        },
      ],
    })

    const merged = mergeCollections(
      [
        {
          id: contractAddress,
          name: 'Existing',
          contractAddress,
          tokenIds: ['1'],
          addedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      imported,
    )

    expect(merged).toHaveLength(1)
    expect(merged[0].tokenIds).toEqual(['1', '7'])
    expect(merged[0].name).toBe('Imported')
  })
})
