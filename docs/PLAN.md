# Secret NFT Rescue Plan

## Goal

Build and self-host a recovery app that helps Secret Network NFT owners recover enough SNIP-721 data to preserve access before the proposed September 1, 2026 SCRT migration/support cutoff.

## Product Shape

The app should be a recovery console, not a custodial marketplace.

- Lightweight local backend for registry/cache persistence.
- No wallet recovery phrase entry.
- No permit persistence.
- No private metadata sent to third-party servers by default.
- Wallet queries still happen client-side through the user wallet.
- Public endpoints are selectable because shared LCD nodes can degrade.
- Collection discovery is registry-based because private ownership prevents reliable global wallet crawling. The current community seed contains 2,001 Stashh-labeled contracts verified from Secret chain state; see `docs/SNIP721_REGISTRY_SOURCES.md`.

## MVP

1. Wallet connection
   - Keplr-compatible wallets first.
   - Leap support through its injected API.
   - Use `secret-4`.
   - Use Amino signer for query permits.

2. Endpoint controls
   - Default to Lavender.Five LCD because it passed browser `fetch` during local verification.
   - Let users switch to Lavender.Five, 1RPC, 01node, or Stakewolle.
   - Health check selected LCD endpoint.

3. Collection manifest manager
   - Add a contract address manually.
   - Optional code hash.
   - Optional token ID hints.
   - Import/export collection manifest JSON.
   - Persist collection list in SQLite, mirrored to localStorage as a fallback.

4. Recovery query
   - Resolve code hash by contract when missing.
   - Save resolved code hashes back into the registry DB.
   - Sign one SNIP-721 query permit for selected collections.
   - Query owned token IDs with `with_permit -> tokens`.
   - Query each token with `with_permit -> nft_dossier`.
   - Fall back to `all_nft_info` where dossier is unavailable.
   - Fetch `token_uri` JSON from HTTP/IPFS/Arweave where available.
   - Render art/media, descriptions, attributes, source links, and metadata JSON.

5. Export
   - Download JSON archive.
   - Include app version, generated timestamp, owner address, endpoint, collections, token IDs, metadata/dossier payloads, resolved token URI payloads, media URLs, and errors.
   - Exclude query permit signatures.

6. Cache
   - Store latest wallet scan archive in local SQLite.
   - Restore cached scan results after app restart and wallet reconnect.
   - Treat the cache as sensitive self-hosted data, not a public index.

## Near-Term Iterations

1. Add ZIP export with downloaded media where CORS allows it.
2. Maintain trustworthy Stashh/community collection registry ingestion and review flow.
3. Add viewing-key fallback for contracts without permit support.
4. Add transfer helper for moving NFTs to a fresh wallet while the chain is live.
5. Add collection-specific adapters for contracts that drift from the reference SNIP-721 shape.
6. Add endpoint rate limiting and retry/backoff controls.
7. Add integration tests against a known testnet SNIP-721 contract.

## Open Questions

- Which Stashh collections matter most and can we source a trustworthy contract manifest?
- Do any major Stashh-era contracts lack permit support?
- Should the public hosted version disable media fetching by default and keep metadata-only export as the safest baseline?
- Does Jason want this hosted under an existing app domain or as its own service?
- Should shared deployments require sign-in before exposing cached wallet recovery data?
