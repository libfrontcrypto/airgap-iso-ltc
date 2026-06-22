# AirGap Isolated Module for Dogecoin

Dogecoin isolated module for AirGap Wallet and AirGap Vault.

This module adds Dogecoin account sync, address derivation, balance lookup, transaction preparation, offline signing, and signed transaction broadcast support through AirGap's isolated module system.

## Repository

https://github.com/libfrontcrypto/airgap-iso-doge

## Status

Version `0.1.16` is the first working release candidate for the full Wallet/Vault flow tested during development:

- import isolated module
- derive Dogecoin receive address
- sync account from Vault to Wallet with QR Code V3
- load balance and prepare a transaction
- generate transaction QR in Wallet
- scan and sign in Vault
- scan signed QR back into Wallet
- decode signed transaction details for broadcast

## Module Package

The signed AirGap module ZIP contains:

- `index.js`
- `manifest.json`
- `dogecoin.svg`
- `module.sig`

The module manifest uses the `dogecoinModule` namespace and includes `index.js` and `dogecoin.svg`.

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

The signing public key must match `module/manifest.json`.

## Support Our Work
If you feel like supporting the developer, here are a couple of different tip addresses (DOGE goes straight to my own AirGap Vault!)

BTC: bc1q7p8ew76ehjrf9rmhdd93xe9lkqpufwkwl56r0e

BTC (LN): libfrontcrypto@coinos.pro

DOGE: DG5vRxuUjFj4SxFU3pcc3HAHgqh8kEiZyC

ETH/ERC-20: 0x523f461f87170b090732c49bb6722C975C66aa18

## License

GPL-3.0-only. See `LICENSE`.
