# Security Model

Secret NFT Rescue is designed as a self-hosted recovery tool with browser-side wallet queries and a local persistence API.

## Local By Default

- Wallet signing stays in the wallet extension.
- The app never asks for, accepts, or stores mnemonics.
- Query permits are kept in memory only.
- Token query results are cached in the local SQLite database after a scan.
- Export files are explicit user downloads.
- Fetching IPFS/HTTP token metadata is a browser-side request to the selected gateway or host. That gateway can see the requested CID/URL.

## Local Database

The API stores data in `.data/secret-nft-rescue.sqlite` by default:

- Collection registry records.
- Resolved contract code hashes learned during scans.
- Latest wallet recovery archive by owner address.

That cache can reveal wallet-to-NFT ownership relationships and recovered private metadata. Keep it on trusted infrastructure, back it up deliberately, and do not expose this app to the public internet without access control.

## Known Dependency Risk

`secretjs@1.22.1` currently pulls older Cosmos dependencies. `npm audit` reports issues in transitive packages including `protobufjs`, `@cosmjs/crypto`, and `bip32`.

Mitigation in this repo:

- `protobufjs` is overridden to `7.6.5`.
- The app uses injected wallet signers and does not derive keys from mnemonics.
- The backend stores recovery cache data only on the self-hosted machine.
- The backend never stores mnemonics or query permit signatures.

Residual risk remains in browser wallet/SecretJS dependency code. Do not paste seed phrases into any web app, including this one.

## Build Warning

Vite/Rolldown reports a direct `eval` warning inside `node_modules/secretjs/dist/browser.js` and a large JavaScript chunk. The non-browser SecretJS entrypoint was tested and rendered a blank page because it depends on Node core modules in the browser path. Keep the working browser bundle until SecretJS ships a cleaner browser-native ESM entrypoint or the app adds verified polyfills/code-splitting.
