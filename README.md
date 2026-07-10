# Secret NFT Rescue

Browser-only recovery console for Secret Network SNIP-721 NFTs.

This is built for the window before the proposed September 1, 2026 SCRT migration/support cutoff. It helps owners connect a Secret wallet, load collection contracts, sign a local query permit, pull owned token IDs/private dossiers where contracts allow it, and export a local JSON archive.

## Why This Exists

Stashh was the main user surface for Secret NFTs. With the Cosmos-based Secret L1 losing official support, NFT owners need a direct way to access their own SNIP-721 data without relying on a marketplace backend.

Secret NFTs are private by design, so this app does not pretend to be a full public indexer. Users bring or import collection contract manifests, then query their own wallet-authenticated data.

## Current MVP

- Secret mainnet `secret-4`
- Keplr-compatible wallet connection
- Leap wallet connection
- LCD endpoint selector and health check
- Manual/imported SNIP-721 collection manifests
- Query permit signing for `owner` permission
- Owned token query with `with_permit -> tokens`
- Token metadata query with `with_permit -> nft_dossier`
- `all_nft_info` fallback
- Local JSON recovery archive export

## Run Locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run typecheck
npm run test
npm run build
```

`npm run build` currently warns about the SecretJS browser bundle using direct `eval` and producing a large chunk. The app has been browser-tested with that bundle; see [Security](docs/SECURITY.md).

## Manifest Format

```json
{
  "collections": [
    {
      "name": "Collection Name",
      "contractAddress": "secret1...",
      "codeHash": "optional 64-char code hash",
      "tokenIds": ["optional", "fallback", "ids"],
      "notes": "optional"
    }
  ]
}
```

## Docs

- [Research](docs/RESEARCH.md)
- [Plan](docs/PLAN.md)
- [Security](docs/SECURITY.md)
