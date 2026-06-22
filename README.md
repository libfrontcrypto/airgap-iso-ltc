# AirGap Isolated Module for Dogecoin

Dogecoin isolated module for AirGap Wallet and AirGap Vault.

This module adds Dogecoin account sync, address derivation, balance lookup, transaction preparation, offline signing, and signed transaction broadcast support through AirGap's isolated module system.

## Repository

https://github.com/libfrontcrypto/airgap-iso-doge

## Status

Version `0.1.17` is the source-first release line for the full Wallet/Vault flow tested during development:

- import isolated module
- derive Dogecoin receive address
- sync account from Vault to Wallet with QR Code V3
- load balance and prepare a transaction
- generate transaction QR in Wallet
- scan and sign in Vault
- scan signed QR back into Wallet
- decode signed transaction details for broadcast

## Source Layout

The GitHub project should contain the TypeScript source under `src/`, the signing script under `scripts/`, and the package/build metadata needed to reproduce the module locally.

Generated files such as `dist/`, `module/`, and release ZIPs are intentionally excluded from the source tree.

## Build

Install dependencies:

```bash
npm install
```

Compile TypeScript:

```bash
npm run build
```

Bundle the isolated module:

```bash
npm run browserify
```

Sign the module:

```bash
MODULE_ED25519_PRIVATE_KEY=<hex-private-key> npm run sign
```

The signing public key must match `module/manifest.json` in the built output, not the source tree.

## License

GPL-3.0-only. See `LICENSE`.
