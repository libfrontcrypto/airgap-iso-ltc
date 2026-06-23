# AirGap Isolated Module for Litecoin

Litecoin isolated module for AirGap Wallet and AirGap Vault.

This module adds Litecoin account sync, legacy P2PKH address derivation, balance lookup, transaction preparation, offline signing, and signed transaction broadcast support through AirGap's isolated module system.

## Repository

https://github.com/libfrontcrypto/airgap-iso-ltc

## Status

Version `0.1.1` is the current source-first Litecoin test build. Before publishing any final release, verify the full Wallet/Vault flow with a locally built module zip:

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

Generated bundles, signatures, and zip files under `module/` are build artifacts and should not be treated as source.

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

The checked-in manifest public key is suitable for the generated local test artifact in this workspace. Replace it with the release signing public key and sign with the corresponding private key before publishing any public release.

## License

GPL-3.0-only. See `LICENSE`.
