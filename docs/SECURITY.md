# Security Model

Secret NFT Rescue is designed as a browser-only tool.

## Local By Default

- Wallet signing stays in the wallet extension.
- The app never asks for, accepts, or stores mnemonics.
- Query permits are kept in memory only.
- Token query results are not persisted automatically.
- Export files are explicit user downloads.

## Known Dependency Risk

`secretjs@1.22.1` currently pulls older Cosmos dependencies. `npm audit` reports issues in transitive packages including `protobufjs`, `@cosmjs/crypto`, and `bip32`.

Mitigation in this repo:

- `protobufjs` is overridden to `7.6.5`.
- The app uses injected wallet signers and does not derive keys from mnemonics.
- The app avoids backend custody and secret collection.

Residual risk remains in browser wallet/SecretJS dependency code. Do not paste seed phrases into any web app, including this one.

## Build Warning

Vite/Rolldown reports a direct `eval` warning inside `node_modules/secretjs/dist/browser.js` and a large JavaScript chunk. The non-browser SecretJS entrypoint was tested and rendered a blank page because it depends on Node core modules in the browser path. Keep the working browser bundle until SecretJS ships a cleaner browser-native ESM entrypoint or the app adds verified polyfills/code-splitting.
