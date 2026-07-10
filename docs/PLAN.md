# Secret NFT Rescue Plan

## Goal

Build and self-host a browser-only frontend that helps Secret Network NFT owners recover enough SNIP-721 data to preserve access before the proposed September 1, 2026 SCRT migration/support cutoff.

## Product Shape

The app should be a recovery console, not a custodial marketplace.

- No backend required for MVP.
- No mnemonic entry.
- No permit persistence.
- No private metadata sent to our servers.
- Public endpoints are selectable because shared LCD nodes can degrade.
- Collection discovery is manifest-based because private ownership prevents reliable global crawling.

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
   - Persist collection list in localStorage.

4. Recovery query
   - Resolve code hash by contract when missing.
   - Sign one SNIP-721 query permit for selected collections.
   - Query owned token IDs with `with_permit -> tokens`.
   - Query each token with `with_permit -> nft_dossier`.
   - Fall back to `all_nft_info` where dossier is unavailable.

5. Export
   - Download JSON archive.
   - Include app version, generated timestamp, owner address, endpoint, collections, token IDs, metadata/dossier payloads, and errors.
   - Exclude query permit signatures.

## Near-Term Iterations

1. Add ZIP export with downloaded media where CORS allows it.
2. Add community-maintained collection manifest URL loading.
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
