# Secret NFT Rescue

Self-hosted recovery console for Secret Network SNIP-721 NFTs.

This is built for the window before the proposed September 1, 2026 SCRT migration/support cutoff. It helps owners connect a Secret wallet, scan a persisted collection registry, sign a local query permit, pull owned token IDs/private dossiers where contracts allow it, cache the recovered result, and export a local JSON archive.

## Why This Exists

Stashh was the main user surface for Secret NFTs. With the Cosmos-based Secret L1 losing official support, NFT owners need a direct way to access their own SNIP-721 data without relying on a marketplace backend.

Secret NFTs are private by design, so this app does not pretend to be a magic global wallet indexer. It needs a registry of SNIP-721 collection contracts to query. The app now keeps that registry in SQLite, learns missing code hashes during scans, and restores cached scan results after restarts.

## Current MVP

- Secret mainnet `secret-4`
- Keplr-compatible wallet connection
- Leap wallet connection
- LCD endpoint selector and health check
- SQLite-backed SNIP-721 collection registry
- Seeded Stashh community registry with 2,001 verified collection contracts
- Manual/imported SNIP-721 collection manifests
- Automatic code-hash lookup and registry persistence
- Query permit signing for `owner` permission
- Owned token query with `with_permit -> tokens`
- Token metadata query with `with_permit -> nft_dossier`
- `all_nft_info` fallback
- IPFS/HTTP `token_uri` metadata fetch
- Art preview, description, attributes, source links, and raw metadata JSON display
- Cached wallet scan restore from local SQLite
- Local JSON recovery archive export

## Run Locally

```bash
npm install
npm run dev
```

`npm run dev` starts two local services:

- API: `http://127.0.0.1:8787`
- Web: `http://0.0.0.0:5173`, with `/api` proxied to the API server

SQLite data is stored at `.data/secret-nft-rescue.sqlite` by default. Override it with:

```bash
SECRET_NFT_RESCUE_DB=/path/to/rescue.sqlite npm run dev
```

For production-style local hosting:

```bash
npm run build
npm run start
```

To expose that built server on the LAN:

```bash
API_HOST=0.0.0.0 PORT=5173 npm run start
```

## Verify

```bash
npm run typecheck
npm run test
npm run lint
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

`data/community-collections.json` is the seed file for a community registry. It currently contains a Stashh-heavy seed of 2,001 SNIP-721 collection contracts verified from Secret chain state.

Rebuild it with:

```bash
npm run registry:build -- --output data/community-collections.json
```

Source notes and trust boundaries are in [SNIP-721 Registry Sources](docs/SNIP721_REGISTRY_SOURCES.md).

## Docs

- [Research](docs/RESEARCH.md)
- [Plan](docs/PLAN.md)
- [Security](docs/SECURITY.md)
