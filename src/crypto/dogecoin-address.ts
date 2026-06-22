import { CryptoDerivative, ExtendedKeyPair, ExtendedPublicKey, ExtendedSecretKey, KeyPair, PublicKey, SecretKey } from '@airgap/module-kit'
import { encodeDerivative } from '@airgap/crypto'

const BitGo = require('@airgap/coinlib-core/dependencies/src/bitgo-utxo-lib-5d91049fd7a988382df81c8260e244ee56d57aac/src')
const Buffer = require('@airgap/coinlib-core/dependencies/src/safe-buffer-5.2.0/index').Buffer

export const DOGECOIN_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
  coin: 'dogecoin',
  hashFunctions: {
    address: BitGo.crypto.hash256,
    transaction: BitGo.crypto.hash256
  }
}

const DOGECOIN_BIP32_VERSION = {
  publicKey: DOGECOIN_NETWORK.bip32.public.toString(16).padStart(8, '0'),
  secretKey: DOGECOIN_NETWORK.bip32.private.toString(16).padStart(8, '0')
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex
  if (normalized.length % 2 !== 0) {
    throw new Error('Invalid hex string length')
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.substr(i * 2, 2), 16)
  }

  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function dogecoinAddressFromPublicKey(publicKeyHex: string): string {
  const publicKey = Buffer.from(hexToBytes(publicKeyHex))
  const publicKeyHash = BitGo.crypto.hash160(publicKey)

  return BitGo.address.toBase58Check(publicKeyHash, DOGECOIN_NETWORK.pubKeyHash, DOGECOIN_NETWORK)
}

function nodeFromDerivative(derivative: CryptoDerivative): any {
  const encoded = encodeDerivative('bip32', derivative, DOGECOIN_BIP32_VERSION)

  return BitGo.HDNode.fromBase58(encoded.secretKey, DOGECOIN_NETWORK)
}

function nodeFromExtendedSecretKey(extendedSecretKey: ExtendedSecretKey): any {
  return BitGo.HDNode.fromBase58(extendedSecretKey.value, DOGECOIN_NETWORK)
}

function nodeFromExtendedPublicKey(extendedPublicKey: ExtendedPublicKey): any {
  return BitGo.HDNode.fromBase58(extendedPublicKey.value, DOGECOIN_NETWORK)
}

function keyPairFromNode(node: any): KeyPair {
  const keyPair = node.keyPair
  if (!keyPair) {
    throw new Error('Failed to derive Dogecoin private key')
  }

  const privateKeyBytes = keyPair.getPrivateKeyBuffer()
  const publicKeyBytes = keyPair.getPublicKeyBuffer()

  return {
    secretKey: {
      type: 'priv',
      format: 'hex',
      value: bytesToHex(privateKeyBytes)
    },
    publicKey: {
      type: 'pub',
      format: 'hex',
      value: bytesToHex(publicKeyBytes)
    }
  }
}

export async function deriveDogecoinKeyPair(derivative: CryptoDerivative): Promise<KeyPair> {
  return keyPairFromNode(nodeFromDerivative(derivative).derive(0).derive(0))
}

export async function deriveDogecoinExtendedKeyPair(derivative: CryptoDerivative): Promise<ExtendedKeyPair> {
  const node = nodeFromDerivative(derivative)

  return {
    secretKey: {
      type: 'xpriv',
      format: 'encoded',
      value: node.toBase58()
    },
    publicKey: {
      type: 'xpub',
      format: 'encoded',
      value: node.neutered().toBase58()
    }
  }
}

export async function deriveDogecoinPublicKeyFromExtendedPublicKey(
  extendedPublicKey: ExtendedPublicKey,
  visibilityIndex: number,
  addressIndex: number
): Promise<PublicKey> {
  const child = nodeFromExtendedPublicKey(extendedPublicKey).derive(visibilityIndex).derive(addressIndex)

  return {
    type: 'pub',
    format: 'hex',
    value: bytesToHex(child.getPublicKeyBuffer())
  }
}

export async function deriveDogecoinSecretKeyFromExtendedSecretKey(
  extendedSecretKey: ExtendedSecretKey,
  visibilityIndex: number,
  addressIndex: number
): Promise<SecretKey> {
  const child = nodeFromExtendedSecretKey(extendedSecretKey).derive(visibilityIndex).derive(addressIndex)

  return {
    type: 'priv',
    format: 'hex',
    value: bytesToHex(child.getPrivateKeyBuffer())
  }
}

export async function dogecoinAddressFromExtendedPublicKey(extendedPublicKey: ExtendedPublicKey): Promise<string> {
  const publicKey = await deriveDogecoinPublicKeyFromExtendedPublicKey(extendedPublicKey, 0, 0)

  return dogecoinAddressFromPublicKey(publicKey.value)
}
