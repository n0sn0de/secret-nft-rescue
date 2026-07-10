# Research Notes

Last reviewed: 2026-07-09.

## Migration Context

- Secret Network's official forum thread says SCRT is proposed to move to Arbitrum, with a target snapshot/migration date of September 1, 2026.
- The same thread says SCRT Labs plans to end official support for the Cosmos-based Secret L1 on September 1, 2026. Continued operation after that depends on third-party validators and is not guaranteed.
- The proposal is about SCRT migration and does not automatically preserve Secret NFT access. SNIP-721 owners need a way to query and export their own NFT metadata while the Cosmos L1 and public endpoints remain usable.

Sources:

- https://forum.scrt.network/t/scrt-is-moving-to-arbitrum/8004
- https://scrt.network/blog/secret-network-2026-roadmap

## Secret NFT Constraints

- Secret NFTs use SNIP-721, a private NFT standard built on Secret Network/CosmWasm.
- Ownership and private metadata can be hidden by default.
- A normal public NFT crawler cannot reliably enumerate all wallet holdings because contracts may require owner authentication.
- The official Secret NFT page says private data is accessed through permits and viewing keys.
- SNIP-721 supports `tokens`, `all_nft_info`, `private_metadata`, and `nft_dossier` queries. `nft_dossier` is the richest per-token query when the owner is permitted to view private fields.
- SNIP-721 query permits wrap authenticated queries with `with_permit`; the permit grants permissions such as `owner`.

Sources:

- https://scrt.network/about/secret-nfts
- https://github.com/SecretFoundation/SNIPs/blob/master/SNIP-721.md
- https://github.com/SecretFoundation/SNIPs/blob/master/SNIP-24.md
- https://docs.scrt.network/secret-network-documentation/development/frontend/templates/usage-examples/snip721-secret-nfts

## Frontend Integration

- Mainnet chain ID is `secret-4`.
- SecretJS supports browser integrations with Keplr, Fina, Leap, StarShell, MetaMask, and Ledger paths.
- Query permits require Amino signing. For Keplr-compatible wallets, use `getOfflineSignerOnlyAmino` and `signAmino`.
- SecretJS exposes `query.compute.codeHashByContractAddress`, `query.compute.queryContract`, `query.snip721.GetOwnedTokens`, and `utils.accessControl.permit.sign`.

Sources:

- https://docs.scrt.network/secret-network-documentation/development/frontend/templates/usage-examples/wallet-integrations
- https://secretjs.scrt.network/

## Endpoint Notes

Public endpoints are free shared infrastructure. The app should avoid aggressive crawling and let users choose endpoints.

Mainnet LCD endpoints surfaced in official docs and chain-registry:

- `https://secretnetwork-api.lavenderfive.com:443`
- `https://lcd.mainnet.secretsaturn.net`
- `https://1rpc.io/scrt-lcd`
- `https://rest-secret.01node.com`
- `https://public.stakewolle.com/cosmos/secretnetwork/rest`

Browser check from the dev app found Lavender.Five returning `secret-4`. Some other public LCD endpoints failed browser `fetch`, likely due CORS or provider policy, even if they remain usable from server-side tools.

Sources:

- https://docs.scrt.network/secret-network-documentation/development/resources-api-contract-addresses/connecting-to-the-network/mainnet-secret-4
- https://github.com/cosmos/chain-registry/blob/master/secretnetwork/chain.json

## Registry Source Findings

- `https://stashh.io` still serves a static frontend bundle, even though obvious API hostnames such as `api.stashh.io` are not a reliable registry source.
- The surviving Stashh bundle identifies Secret mainnet context and Stashh collection-code evidence. Do not commit copied frontend bundles or sensitive-looking public app config; only contract/code evidence is needed.
- Secret REST compute endpoints on Lavender.Five exposed the reproducible chain paths needed for registry building:
  - `/compute/v1beta1/code_hash/by_code_id/{code_id}`
  - `/compute/v1beta1/contracts/{code_id}`
  - `/compute/v1beta1/info/{contract_address}`
  - `/compute/v1beta1/code_hash/by_contract_address/{contract_address}`
- Verified Stashh SNIP-721 collection code IDs:
  - `618`, code hash `4dd433b8d9c234c33f27bcd14f3348bc57d96440a92b77cee7d0c925b8eed58e`, `685` Stashh-labeled contracts.
  - `1279`, code hash `5783910afb89189caf0ef246e40fef5f00541bfb33eb576bd3ebaf87ae3a8d4f`, `1,316` Stashh-labeled contracts.
- `data/community-collections.json` now contains `2,001` Stashh-labeled contracts from those two verified code IDs.
- Broad all-code scans can trigger public endpoint rate limits. The rebuild script intentionally scans only verified Stashh collection code IDs unless the operator explicitly extends it.

Sources:

- https://stashh.io
- https://rest.lavenderfive.com:443/secretnetwork
- `docs/SNIP721_REGISTRY_SOURCES.md`
- `scripts/build-community-registry.mjs`

## Product Implication

The honest MVP is not a global marketplace clone. It is a wallet-authenticated recovery console:

1. Users connect a Secret wallet.
2. Users import or enter SNIP-721 collection contract addresses.
3. The app signs a local query permit for those contracts.
4. The app queries owned token IDs and token dossiers where contracts support them.
5. Users export a local archive JSON containing collection records, token IDs, metadata, raw query responses, and unresolved errors.

This keeps private metadata local and avoids pretending there is a universal public index.
