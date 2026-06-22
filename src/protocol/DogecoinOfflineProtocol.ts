import {
  AirGapTransaction,
  CryptoConfiguration,
  CryptoDerivative,
  ExtendedKeyPair,
  ExtendedPublicKey,
  KeyPair,
  ProtocolMetadata,
  PublicKey,
  SecretKey
} from '@airgap/module-kit'

import {
  DogecoinUnits,
  DogecoinUnsignedTransaction,
  DogecoinSignedTransaction
} from './DogecoinTypes'
import {
  deriveDogecoinExtendedKeyPair,
  deriveDogecoinKeyPair,
  deriveDogecoinPublicKeyFromExtendedPublicKey,
  dogecoinAddressFromExtendedPublicKey,
  dogecoinAddressFromPublicKey
} from '../crypto/dogecoin-address'
import { signDogecoinP2PKHTransaction } from '../crypto/dogecoin-tx'
import { decodeDogecoinP2PKHOutputs } from '../crypto/dogecoin-tx'
import { DOGECOIN_FEE_DEFAULTS, DOGECOIN_MAINNET } from './DogecoinProtocolNetwork'

function addDecimalStrings(left: string, right: string): string {
  let carry = 0
  let result = ''
  let i = left.length - 1
  let j = right.length - 1

  while (i >= 0 || j >= 0 || carry > 0) {
    const sum = (i >= 0 ? left.charCodeAt(i--) - 48 : 0) + (j >= 0 ? right.charCodeAt(j--) - 48 : 0) + carry
    result = String(sum % 10) + result
    carry = Math.floor(sum / 10)
  }

  return result.replace(/^0+(?=\d)/, '')
}

/**
 * Offline protocol implementation for Dogecoin. Lives on the AirGap Vault
 * device where no network connectivity is available. Responsible for key
 * derivation, address creation and transaction signing.
 */
export class DogecoinOfflineProtocol {
  /**
   * Provide basic metadata about the Dogecoin network such as name, units and
   * default fee recommendations. Uses koinu (1 DOGE = 100 000 000 koinu) as
   * the smallest unit【832165120621745†L320-L481】.
   */
  public async getMetadata(): Promise<ProtocolMetadata<DogecoinUnits, DogecoinUnits>> {
    return {
      identifier: 'dogecoin',
      name: 'Dogecoin',
      units: {
        DOGE: {
          symbol: { value: 'DOGE' },
          decimals: 8
        },
        koinu: {
          symbol: { value: 'koinu' },
          decimals: 0
        }
      },
      mainUnit: 'DOGE',
      fee: {
        defaults: DOGECOIN_FEE_DEFAULTS
      },
      account: {
        standardDerivationPath: "m/44'/3'/0'",
        address: {
          isCaseSensitive: true,
          placeholder: 'D...',
          regex: '^D[1-9A-HJ-NP-Za-km-z]{25,34}$'
        }
      }
    }
  }

  /**
   * Return the cryptographic configuration used by this protocol. Dogecoin uses
   * the secp256k1 curve and BIP39 mnemonic seeds【657915586261235†L203-L206】.
   */
  public async getCryptoConfiguration(): Promise<CryptoConfiguration> {
    return {
      algorithm: 'secp256k1',
      secret: {
        type: 'bip39'
      }
    } as CryptoConfiguration
  }

  /**
   * Derive the keypair from the provided derivative. The derivative is an
   * opaque container provided by the AirGap Vault environment. We convert it
   * into a BIP32 key and derive the Dogecoin path m/44'/3'/0'/0/0【183707501833369†L131-L149】.
   */
  public async getKeyPairFromDerivative(derivative: CryptoDerivative): Promise<KeyPair> {
    return deriveDogecoinKeyPair(derivative)
  }

  /**
   * Convert a public key into a Dogecoin P2PKH address. Only compressed public
   * keys are supported.
   */
  public async getAddressFromPublicKey(publicKey: PublicKey | ExtendedPublicKey): Promise<string> {
    switch (publicKey.type) {
      case 'pub':
        return dogecoinAddressFromPublicKey(publicKey.value)
      case 'xpub':
        return dogecoinAddressFromExtendedPublicKey(publicKey)
      default:
        throw new Error('Public key type is not supported.')
    }
  }

  /**
   * Sign an unsigned transaction using the provided secret key. This method
   * constructs a fully signed raw transaction hex. Only legacy P2PKH inputs
   * with SIGHASH_ALL are supported.
   */
  public async signTransactionWithSecretKey(
    transaction: DogecoinUnsignedTransaction,
    secretKey: SecretKey
  ): Promise<DogecoinSignedTransaction> {
    const rawHex = await signDogecoinP2PKHTransaction(transaction, secretKey.value)
    return {
      type: 'signed',
      transaction: rawHex
    }
  }

  /**
   * Extract human‑readable details from an unsigned or signed transaction. For
   * unsigned transactions this describes the recipient addresses, total amount
   * being sent and the fee. For signed transactions we cannot infer the
   * original signing intent so we return an empty array.
   */
  public async getDetailsFromTransaction(
    transaction: DogecoinUnsignedTransaction | DogecoinSignedTransaction,
    publicKey: PublicKey | ExtendedPublicKey
  ): Promise<AirGapTransaction<DogecoinUnits, DogecoinUnits>[]> {
    if (transaction.type === 'signed') {
      return this.getDetailsFromSignedTransaction(transaction, publicKey)
    }
    const paymentOutputs = transaction.outputs.filter((output) => !output.isChange && output.address !== transaction.changeAddress)
    let total = '0'
    for (const output of paymentOutputs) {
      total = addDecimalStrings(total, output.value)
    }
    return [
      {
        from: transaction.inputs.map((i) => i.address),
        to: paymentOutputs.map((o) => o.address),
        isInbound: false,
        amount: {
          value: total,
          unit: 'koinu'
        },
        fee: {
          value: transaction.fee,
          unit: 'koinu'
        },
        network: DOGECOIN_MAINNET
      }
    ]
  }

  private async getDetailsFromSignedTransaction(
    transaction: DogecoinSignedTransaction,
    publicKey: PublicKey | ExtendedPublicKey
  ): Promise<AirGapTransaction<DogecoinUnits, DogecoinUnits>[]> {
    const fromAddress = await this.getAddressFromPublicKey(publicKey)
    const outputs = decodeDogecoinP2PKHOutputs(transaction.transaction)
    const paymentOutputs = outputs.filter((output) => output.address !== fromAddress)
    const displayedOutputs = paymentOutputs.length > 0 ? paymentOutputs : outputs
    const total = displayedOutputs.reduce((sum, output) => addDecimalStrings(sum, output.value), '0')

    return [
      {
        from: [fromAddress],
        to: displayedOutputs.map((output) => output.address),
        isInbound: false,
        amount: {
          value: total,
          unit: 'koinu'
        },
        fee: {
          value: '0',
          unit: 'koinu'
        },
        network: DOGECOIN_MAINNET,
        transactionDetails: transaction.transaction
      } as AirGapTransaction<DogecoinUnits, DogecoinUnits>
    ]
  }
}
