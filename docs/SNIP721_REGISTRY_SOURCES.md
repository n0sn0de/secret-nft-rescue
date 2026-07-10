# SNIP-721 Registry Sources

Last reviewed: 2026-07-10.

## Why a registry is required

Secret NFTs are private. A wallet address alone is not enough to discover every
SNIP-721 holding. The rescue app needs a list of collection contracts to ask,
then the owner signs a local query permit and the app asks each contract for the
owner's token IDs / dossiers.

This registry is therefore a **contract discovery seed**, not an ownership index.
It does not bypass Secret NFT privacy and it does not prove that a wallet owns
anything.

## Current seed: Stashh contracts from Secret chain state

The current `data/community-collections.json` seed contains **2,001**
Stashh-labeled SNIP-721 collection contracts.

| Code ID | Code hash | Included contracts | Evidence |
| --- | --- | ---: | --- |
| `618` | `4dd433b8d9c234c33f27bcd14f3348bc57d96440a92b77cee7d0c925b8eed58e` | `685` | Known Stashh collection evidence plus `/compute/v1beta1/contracts/618` labels |
| `1279` | `5783910afb89189caf0ef246e40fef5f00541bfb33eb576bd3ebaf87ae3a8d4f` | `1,316` | Stashh static app `REACT_APP_DEFAULT_CODE_ID` plus `/compute/v1beta1/contracts/1279` labels |

The source extraction used public, read-only data only:

1. `https://stashh.io` still serves the Stashh static frontend bundle.
2. That bundle identifies the Secret mainnet context and Stashh collection code
   evidence, including current default collection code ID `1279`.
3. Secret REST compute endpoints confirm code hashes and instantiate lists:
   - `/compute/v1beta1/code_hash/by_code_id/{code_id}`
   - `/compute/v1beta1/contracts/{code_id}`
4. The generated manifest includes only contracts whose on-chain contract label
   starts with `Stashh` for the verified collection code IDs.

## Rebuild

Default live rebuild:

```bash
npm run registry:build -- --output data/community-collections.json
```

Use a different Secret REST endpoint if Lavender.Five is rate-limited:

```bash
npm run registry:build -- \
  --rest https://rest-secret.01node.com \
  --output data/community-collections.json
```

Use cached raw contract exports:

```bash
npm run registry:build -- \
  --input-dir /path/to/raw-secret-contract-files \
  --output data/community-collections.json
```

The cached directory must contain:

- `contracts-code-618.json`
- `contracts-code-1279.json`

with the REST response shape:

```json
{
  "contract_infos": []
}
```

## Trust tiers

### Tier A — included by default

- Secret chain state confirms the contract exists.
- Contract comes from a verified Stashh SNIP-721 collection code ID.
- Contract label starts with `Stashh`.
- Code hash is included in the manifest.

### Tier B — useful but not included automatically yet

- Stashh API/indexer responses, if a stable read-only endpoint can be reproduced.
- Stashh/community exports with matching Secret chain contract info.
- Known project/team-maintained SNIP-721 lists that can be cross-checked against
  `/compute/v1beta1/info/{contract}` and code hash lookup.

### Tier C — discovery only

- Social posts, Discord messages, marketplace screenshots, or dead UI pages.
- Any list without contract addresses and reproducible chain verification.

## Current limitations

- This is a Stashh-heavy seed, not a complete Secret NFT universe.
- Non-Stashh SNIP-721 contracts are not included unless they share the verified
  Stashh collection code IDs and labels.
- Contracts instantiated from custom SNIP-721 code may require manual/community
  submission and chain verification.
- Collection labels are sometimes ugly or duplicated. The app keys records by
  contract address, not name.
- Public LCD endpoints can rate-limit. Rebuild scripts use narrow code-ID scans;
  do not run broad scans aggressively against shared infrastructure.

## Recommended next sources

1. Ask Stashh operators for an export of collection contract addresses and
   metadata, then verify every contract against Secret chain state before import.
2. Accept community PRs adding manifests, but require contract address, code hash
   or code-hash lookup proof, source URL, and whether the contract responds to
   SNIP-721 permit queries.
3. Add a `community-submissions/` folder for lower-confidence candidate lists and
   promote only verified rows into `data/community-collections.json`.
4. Add optional per-collection adapters for major contracts that drift from the
   reference SNIP-721 query shape.

## Safety notes

Do not commit copied Stashh frontend bundles, endpoint credentials, private app
configuration, wallet material, or permit signatures. The registry only needs
public contract addresses, code hashes, labels, and provenance.
