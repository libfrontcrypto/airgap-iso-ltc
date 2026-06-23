# AirGap Isolated Module for Litecoin

Litecoin isolated module for AirGap Wallet and AirGap Vault.

This module adds Litecoin account sync, legacy P2PKH address derivation, balance lookup, transaction preparation, offline signing, and signed transaction broadcast support through AirGap's isolated module system.

## Repository

https://github.com/libfrontcrypto/airgap-iso-ltc

## Status

Version `1.0.0` is the current Litecoin release build. The full Wallet/Vault flow was verified with the `0.1.1` test build before the first `1.0.0` release:

- import isolated module
- derive Litecoin receive address
- sync account from Vault to Wallet with QR Code V3
- load balance and prepare a transaction
- generate transaction QR in Wallet
- scan and sign in Vault
- scan signed QR back into Wallet
- decode signed transaction details for broadcast

## Source Layout

The GitHub project should contain the TypeScript source under `src/`, the signing script under `scripts/`, and the package/build metadata needed to reproduce the module locally.

Generated bundles and signatures under `module/`, and zip files under `build-artifacts/`, are build artifacts and should not be treated as source.

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

Package the module zip:

```bash
npm run package
```

The signing public key must match `module/manifest.json` in the built output, not the source tree.

The signing public key is published in `module/manifest.json`.

## Support Our Work

If you feel like supporting the developer, here are a couple of different tip addresses:

BTC: bc1q7p8ew76ehjrf9rmhdd93xe9lkqpufwkwl56r0e

BTC (LN): libfrontcrypto@coinos.pro

DOGE: DG5vRxuUjFj4SxFU3pcc3HAHgqh8kEiZyC

ETH/ERC-20: 0x523f461f87170b090732c49bb6722C975C66aa18

## License

GPL-3.0-only. See `LICENSE`.
